'use strict';

let courseAccount = null;
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
  $('#app').innerHTML = `<main id="main" class="sign-in-page" tabindex="-1">
    <section class="sign-in-card" aria-labelledby="sign-in-title">
      <div class="sign-in-brand"><img src="assets/fox.svg" alt=""><span>Deutschweg</span></div>
      <h1 id="sign-in-title">${unavailable?'Connexion indisponible':'Connecte-toi'}</h1>
      ${unavailable ? `<p>Ton espace est momentanément inaccessible.</p>
        <button class="primary full" type="button" data-retry-session>Réessayer</button>` :
        `<form id="sign-in-form">
          <label>Identifiant<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="64"></label>
          <label>Mot de passe<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label>
          <p data-sign-in-error role="alert" hidden></p>
          <button class="primary full" type="submit">Se connecter</button>
        </form>`}
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
  const {username,password} = Object.fromEntries(new FormData(form));
  button.disabled = true;
  error.hidden = true;
  try {
    const response = await fetch('/api/session',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username,password})
    });
    if (!response.ok) {
      error.textContent = response.status===401 ? 'Identifiant ou mot de passe incorrect.' : 'La connexion est momentanément indisponible.';
      error.hidden = false;
      return;
    }
    form.reset();
    courseAccount = (await response.json()).user;
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
