'use strict';

let courseAccount = null;
let sessionMode = 'login';
const sessionChannel = 'BroadcastChannel' in window ? new BroadcastChannel('deutschweg-session') : null;

function accountMenuHTML() {
  const name = courseAccount?.name || 'Mon compte';
  return `<details class="account-menu">
    <summary class="avatar" aria-label="Mon compte" title="${esc(name)}">${esc(name[0].toUpperCase())}</summary>
    <div class="account-menu-content">
      <strong>${esc(name)}</strong>
      <button type="button" class="link-button" data-sign-out>Se déconnecter</button>
    </div>
  </details>`;
}

function signInHTML(unavailable = false) {
  const register = sessionMode==='register';
  $('#app').innerHTML = `<main id="main" class="sign-in-page" tabindex="-1">
    <section class="sign-in-card" aria-labelledby="sign-in-title">
      <div class="sign-in-brand"><img src="assets/fox.svg" alt=""><span>Deutschweg</span></div>
      <h1 id="sign-in-title">${unavailable?'Connexion indisponible':register?'Créer un compte':'Connecte-toi'}</h1>
      ${unavailable ? `<p>Ton espace est momentanément inaccessible.</p>
        <button class="primary full" type="button" data-retry-session>Réessayer</button>` :
        `<form id="sign-in-form" method="post" action="/api/session" data-mode="${sessionMode}">
          ${register?'<label>Prénom ou nom<input name="name" autocomplete="name" required maxlength="64"></label>':''}
          <label>Identifiant<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required
            ${register?'minlength="3" maxlength="32" aria-describedby="signup-username-hint"':'maxlength="64"'}>
            ${register?'<small id="signup-username-hint">3 à 32 caractères, avec lettres, chiffres, point, tiret ou trait de soulignement.</small>':''}</label>
          <label>Mot de passe<input type="password" name="password" autocomplete="${register?'new-password':'current-password'}" required maxlength="256"
            ${register?'minlength="12" aria-describedby="signup-password-hint"':''}>
            ${register?'<small id="signup-password-hint">12 caractères minimum.</small>':''}</label>
          ${register?'<label>Confirmer le mot de passe<input type="password" name="confirmation" autocomplete="new-password" required maxlength="256"></label>':''}
          <p data-sign-in-error role="alert" hidden></p>
          <button class="primary full" type="submit">${register?'S’inscrire':'Se connecter'}</button>
        </form>
        <div class="session-alternative"><button class="link-button" type="button" data-session-mode="${register?'login':'register'}">
          ${register?'J’ai déjà un compte':'Créer un compte'}
        </button></div>`}
    </section>
  </main>`;
}

async function startSession() {
  try {
    const response = await fetch('/api/session',{cache:'no-store'});
    if (!response.ok) throw Error();
    const {user} = await response.json();
    if (!user) {
      signInHTML();
      return;
    }
    courseAccount = user;
    loadAccountProgress(user);
    await init();
  } catch {
    signInHTML(true);
  }
}

document.addEventListener('submit',async event => {
  if (event.target.id!=='sign-in-form') return;
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('[type="submit"]');
  const error = form.querySelector('[data-sign-in-error]');
  const fields = Object.fromEntries(new FormData(form));
  const action = form.dataset.mode==='register' ? 'register' : 'login';
  button.disabled = true;
  error.hidden = true;
  try {
    const response = await fetch('/api/session',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...fields,action})
    });
    const payload = await response.json().catch(()=>({}));
    if (!response.ok) {
      error.textContent = typeof payload.error==='string' ? payload.error : 'La connexion est momentanément indisponible.';
      error.hidden = false;
      return;
    }
    form.reset();
    courseAccount = payload.user;
    loadAccountProgress(courseAccount);
    await init();
  } catch {
    error.textContent = 'Connexion interrompue. Réessaie.';
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('click',async event => {
  if (event.target.closest('[data-retry-session]')) startSession();
  const mode = event.target.closest('[data-session-mode]');
  if (mode && !courseAccount) {
    sessionMode = mode.dataset.sessionMode;
    signInHTML();
    return;
  }
  const button = event.target.closest('[data-sign-out]');
  if (!button) return;
  button.disabled = true;
  try {
    const result = await fetch('/api/session',{method:'DELETE'});
    if (!result.ok) throw Error();
    sessionChannel?.postMessage('sign-out');
    location.reload();
  } catch {
    button.disabled = false;
    toast('Déconnexion interrompue. Réessaie.');
  }
});

sessionChannel?.addEventListener('message',event => {
  if (event.data==='sign-out' && courseAccount) location.reload();
});

window.addEventListener('pageshow',event => {
  if (event.persisted) location.reload();
});
