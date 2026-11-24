'use strict';

let foxJourney = null;
const levels = ['A1.1', 'A1.2', 'A2.1'];
const levelNames = {
  'A1.1': 'Les premiers mots',
  'A1.2': 'L’allemand au quotidien',
  'A2.1': 'Des phrases qui voyagent'
};
const levelIcons = ['leaf', 'book', 'star'];

function recordingJourneyHTML() {
  const all = data.lessons.filter(l => l.level === state.level);
  const remaining = all.filter(l => !isDone(l.id));
  const current = remaining.find(l => l.id === state.journeyNext?.[state.level]) || remaining[0] || all.at(-1);
  const completed = all.filter(l => isDone(l.id)).length;
  if (!current) return `<div class="journey-header"><h1>Mon parcours</h1>${journeyLevels()}</div>`;
  const openUnit = foxJourney ? current.unit : state.journeyOpen?.[state.level] ?? current.unit;
  const nextLevel = levels[levels.indexOf(state.level) + 1];
  const first = all[0], last = all.at(-1);
  const finished = completed === all.length;
  return `<div class="journey-header"><h1>Mon parcours</h1>${journeyModes()}</div>
    ${journeyLevels()}
    <div class="journey-grid"><section class="journey-trail" aria-label="Carte du niveau ${state.level}">
      <header class="journey-current">
        <img src="assets/journey.svg" alt="">
        <div><span class="world-kicker">Niveau ${state.level}</span><h2>${levelNames[state.level]}</h2>
        <p>${completed} / ${all.length} leçons terminées</p>
        ${finished && nextLevel ? `<a class="primary" href="#path/${nextLevel}">Continuer en ${nextLevel}</a>` : `
        <button class="primary" data-start="${current.id}">${icon('play')} ${finished ? 'Revoir la dernière leçon' : progress(current.id).position ? 'Reprendre ma leçon' : 'Commencer ma prochaine leçon'}</button>
        <p class="world-next">${esc(current.title)} · ${lessonMinutes(current)} min</p>`}</div>
      </header>
      <div class="level-boundary">
        <span class="boundary-icon">${icon('play')}</span>
        <div><strong>Début du niveau ${state.level}</strong><button data-start="${first.id}" class="link-button">${esc(first.title)}</button></div>
        <button class="secondary jump-finish" data-jump-finish>Voir la fin</button>
      </div>
      ${data.units[state.level].map((title, index) => journeyChapter(all, current, title, index, openUnit)).join('')}
      <footer class="level-boundary level-finish" id="level-finish" tabindex="-1">
        <span class="boundary-icon">${icon('trophy')}</span>
        <div><strong>${finished ? 'Niveau terminé · ' : 'Fin du niveau '}${state.level}</strong><button data-start="${last.id}" class="link-button">${esc(last.title)}</button></div>
        ${nextLevel ? `<a class="secondary" href="#path/${nextLevel}">Niveau ${nextLevel}</a>` : ''}
      </footer>
    </section><aside class="journey-rail">${dailyPanel()}</aside></div>`;
}

function lessonMinutes(l) {
  return Math.max(1, Math.ceil(l.effectiveDuration / 60));
}

function journeyChapter(all, current, title, unit, openUnit) {
  const lessons = all.filter(l => l.unit === unit);
  if (!lessons.length) return '';
  const done = lessons.filter(l => isDone(l.id)).length;
  const height = lessons.length * 104 + 16;
  const points = lessons.map((_, i) => [50 + Math.sin(i * 1.4) * 9, i * 104 + 60]);
  const line = points.map(([x,y],i) => {
    if (!i) return `M ${x*6} ${y}`;
    const [previousX, previousY] = points[i-1];
    return `C ${previousX*6} ${previousY+50} ${x*6} ${y-50} ${x*6} ${y}`;
  }).join(' ');
  return `<details class="map-chapter journey-chapter" data-map-unit="${unit}" ${unit === openUnit ? 'open' : ''}>
    <summary><span class="chapter-emblem">${icon(done === lessons.length ? 'trophy' : 'book')}</span>
    <span><small>CHAPITRE ${unit+1}</small><strong>${esc(title)}</strong><span>${done} / ${lessons.length} étapes</span></span>
    <span class="chapter-chevron">${icon('chevron')}</span></summary>
    <div class="chapter-road" style="height:${height}px"><svg class="road-line" viewBox="0 0 600 ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${line}"/></svg>
    ${lessons.map((l, i) => {
      const next = l.id === (foxJourney?.to || current.id);
      const p = state.lessons[l.id] || {};
      return `<div id="map-${l.id}" class="map-step ${i%2 ? 'label-right' : 'label-left'} ${next ? 'is-current' : ''} ${p.completed ? 'is-complete' : ''}" style="--stop-x:${points[i][0]}%;top:${i*104+29}px">
        ${next ? '<img class="journey-mascot" src="assets/fox.svg" alt="Ta position sur la carte">' : ''}
        <button class="map-orbit" data-start="${l.id}" aria-label="${esc(l.title)}${p.completed ? ' · terminée' : ''}">${icon(p.completed ? 'check' : l.kind === 'audio' ? 'headphones' : 'play')}</button>
        <button class="map-step-label" data-start="${l.id}" tabindex="-1"><strong>${esc(l.title)}</strong><span>${next && !p.completed ? (p.position ? 'À reprendre · ' : 'Prochaine leçon · ') : ''}${lessonMinutes(l)} min</span></button>
      </div>`;
    }).join('')}</div>
  </details>`;
}

function journeyLevels() {
  const reading = route.page === 'books-path';
  return `<nav class="journey-levels" aria-label="Niveaux d’allemand">${levels.map((level, index) => {
    const lessons = reading ? data.books.filter(b => b.level === level).flatMap(b => b.pages.map(p => [b, p])) : data.lessons.filter(l => l.level === level);
    const done = reading ? lessons.filter(([b, p]) => readingProgress(b)[p.page]).length : lessons.filter(l => isDone(l.id)).length;
    return `<a class="world-card" data-world="${level}" href="#${reading ? 'books-path' : 'path'}/${level}" ${level === state.level ? 'aria-current="page"' : ''}>
      <span class="world-card-icon">${icon(levelIcons[index])}</span>
      <span class="world-card-body"><strong>Niveau ${level}</strong><span>${levelNames[level]}</span>
      <progress value="${done}" max="${lessons.length || 1}" aria-label="Progression ${level}"></progress>
      <small>${done} / ${lessons.length} ${reading ? 'pages' : 'leçons'}</small></span>
    </a>`;
  }).join('')}</nav>`;
}

function journeyModes() {
  return `<nav class="journey-modes" aria-label="Mes parcours">
    <a href="#path/${state.level}" ${route.page !== 'books-path' ? 'aria-current="page"' : ''}>${icon('play')} Leçons enregistrées</a>
    <a href="#books-path/${state.level}" ${route.page === 'books-path' ? 'aria-current="page"' : ''}>${icon('book')} Parcours des livres</a>
  </nav>`;
}

function dailyPanel() {
  return `<section class="daily-card" aria-label="Suivi quotidien">
    <div class="daily-title"><span class="daily-icon">${icon('flame')}</span><div><h2>Objectif du jour</h2><p data-daily-streak></p></div></div>
    <div id="daily-week">${week()}</div>
    <progress id="daily-minutes" max="${state.goal * 60}" value="${state.days[today()]?.seconds || 0}" aria-label="Minutes étudiées aujourd’hui"></progress>
    <p id="daily-label">${Math.floor((state.days[today()]?.seconds || 0) / 60)} / ${state.goal} min aujourd’hui</p>
    <button class="link-button" data-action="settings">Ajuster mon objectif</button>
  </section>`;
}

function updateDailyPanel() {
  const elapsed = state.days[today()]?.seconds || 0;
  const bar = $('#daily-minutes');
  if (bar) {
    bar.max = state.goal * 60;
    bar.value = elapsed;
    $('#daily-label').textContent = `${Math.floor(elapsed / 60)} / ${state.goal} min aujourd’hui`;
    const count = streak(state.days);
    const completed = state.days[today()]?.lessons || 0;
    $('[data-daily-streak]').textContent = `${completed} leçon${completed > 1 ? 's' : ''} aujourd’hui · ${count} jour${count > 1 ? 's' : ''} de suite`;
    const weekHTML = week();
    const calendar = $('#daily-week');
    if (calendar.dataset.calendar !== weekHTML) {
      calendar.innerHTML = weekHTML;
      calendar.dataset.calendar = weekHTML;
    }
  }
  const streakStat = $('#streak-stat');
  if (streakStat) streakStat.textContent = streak(state.days);
}

function nextJourneyLesson(current) {
  const index = data.lessons.findIndex(l => l.id === current.id);
  return data.lessons.slice(index + 1).find(l => l.level === current.level && !isDone(l.id))
    || data.lessons.find(l => l.level === current.level && !isDone(l.id))
    || data.lessons.slice(index + 1).find(l => !isDone(l.id))
    || null;
}

function animateJourney() {
  updateDailyPanel();
  if (route.page !== 'path' || !foxJourney) return;
  const move = foxJourney;
  foxJourney = null;
  requestAnimationFrame(() => {
    const destination = document.getElementById('map-'+move.to);
    const mascot = destination?.querySelector('.journey-mascot');
    if (!destination || !mascot) return;
    const origin = document.getElementById('map-'+move.from);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = origin?.getBoundingClientRect();
    const end = destination.getBoundingClientRect();
    const nearby = start?.width && Math.abs(start.top - end.top) < 850;
    destination.scrollIntoView({behavior: reduceMotion ? 'instant' : 'smooth', block:'center'});
    if (reduceMotion) return;
    const dx = nearby ? start.left - end.left : -90;
    const dy = nearby ? start.top - end.top : -32;
    mascot.animate([
      {transform:`translate(${dx}px,${dy}px) rotate(-10deg)`},
      {transform:`translate(${dx * .48}px,${dy * .48 - 28}px) rotate(12deg)`,offset:.55},
      {transform:'translate(0,0) rotate(0)'}
    ], {duration:850,easing:'cubic-bezier(.2,.8,.3,1)'});
  });
}

function readingProgress(book) {
  return (state.studyPages || {})[book.id] || {};
}

function bookJourneyHTML() {
  const books = data.books.filter(b => b.level === state.level);
  return `<div class="journey-header"><h1>Parcours des livres</h1>${journeyModes()}</div>
  ${journeyLevels()}<div class="journey-grid"><section class="reading-journey" aria-label="Livres du niveau ${state.level}">
  ${books.map(book => {
    const pagesDone = readingProgress(book);
    const count = book.pages.filter(p => pagesDone[p.page]).length;
    const next = book.pages.find(p => !pagesDone[p.page]) || book.pages[0];
    return `<article class="reading-stop">
      <img src="${book.pages[0].image}" loading="lazy" alt="">
      <div><h2>${esc(book.title)}</h2><p>${count} / ${book.pages.length} pages travaillées</p>
      <progress max="${book.pages.length}" value="${count}" aria-label="Pages travaillées"></progress>
      <a class="secondary" href="#book/${book.id}/${next.page}">${count ? 'Reprendre le livre' : 'Ouvrir le livre'}</a></div>
    </article>`;
  }).join('')}</section><aside>${dailyPanel()}</aside></div>`;
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-jump-finish]')) {
    const end = document.getElementById('level-finish');
    end.focus({preventScroll:true});
    end.scrollIntoView({block:'center'});
  }
  const button = event.target.closest('[data-finish-page]');
  if (!button || route.page !== 'book') return;
  const current = activePaper();
  const source = book(current.book);
  state.studyPages ||= {};
  state.studyPages[source.id] ||= {};
  if (!state.studyPages[source.id][current.page]) {
    state.studyPages[source.id][current.page] = true;
    const day = state.days[today()] ||= {seconds:0};
    day.pages = (day.pages || 0) + 1;
  }
  save();
  if (current.page < source.pages.length) {
    readerState = null;
    navigate(`#book/${source.id}/${current.page + 1}`);
  } else {
    navigate(`#books-path/${source.level}`);
  }
});
