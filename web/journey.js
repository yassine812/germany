'use strict';

let foxJourney = null;
let mapObserver = null;
const preparationLevel = 'preparation';
const levels = [preparationLevel, 'A1.1', 'A1.2', 'A2.1'];
const levelNames = {
  preparation: 'Alphabet et premiers échanges',
  'A1.1': 'Les premiers mots',
  'A1.2': 'L’allemand au quotidien',
  'A2.1': 'Des phrases qui voyagent'
};
const levelIcons = ['file', 'leaf', 'book', 'star'];

function levelLabel(level) {
  return level === preparationLevel ? 'Préparation' : 'Niveau ' + level;
}

function recordingJourneyHTML() {
  const {level} = state;
  const all = [...recordingsBySession.values()].filter(recording => recording.level === level);
  const remaining = all.filter(recording => !groupDone(recording));
  const remembered = state.journeyNext?.[level];
  const savedNext = groupsByClip.get(remembered)?.session || remembered;
  const current = remaining.find(recording => recording.id === savedNext) || remaining[0] || all.at(-1);
  if (!current) return `<div class="journey-header"><h1>Mon parcours</h1>${journeyLevels()}</div>`;
  const completed = all.length - remaining.length;
  const finished = !remaining.length;
  const nextLevel = levels[levels.indexOf(level) + 1];
  const label = levelLabel(level);
  const assessment = assessments[level];
  const answered = assessment ? Object.values(assessmentProgress(level).pages).filter(Boolean).length : 0;
  const assessed = !assessment || answered === assessment.pages.length;
  const assessmentUrl = '#assessment/' + level;
  const notes = level === preparationLevel ? book('notes') : null;
  return `<div class="journey-header"><h1>Mon parcours</h1><a class="roadmap-library secondary" href="#library">${icon('book')} Bibliothèque</a></div>
    ${journeyLevels()}
    <div class="journey-grid"><section class="journey-trail" aria-label="Parcours ${label}">
      <header class="journey-current">
        <img src="assets/journey.svg" alt="">
        <div><span class="world-kicker">${label}</span><h2>${levelNames[level]}</h2>
        <p>${completed} / ${all.length} séances terminées</p>
        <div class="world-supports" aria-label="Dans une séance">${icon('play')} Cours ${icon('book')} PDF ${icon('mic')} Oral</div>
        ${finished && !assessed ? `<a class="primary" href="${assessmentUrl}">Faire le bilan ${level}</a>` :
          finished && nextLevel ? `<a class="primary" href="#path/${nextLevel}">Continuer en ${nextLevel}</a>` : `
        <button class="primary" data-start="${groupStart(current).id}">${icon('play')} ${finished ? 'Revoir la dernière séance' : groupProgress(current).position ? 'Reprendre ma séance' : 'Commencer ma séance'}</button>
        <p class="world-next">${esc(current.title)} · ${current.chapters.length} chapitres</p>`}</div>
      </header>
      ${notes ? `<div class="level-boundary preparation-pdf">
        <span class="boundary-icon">${icon('book')}</span>
        <div><strong>Préparation · PDF</strong><span>${notes.pages.length} pages</span></div>
        <a class="secondary" href="#book/${notes.id}/1/reference">Feuilleter le PDF</a>
      </div>` : `<div class="level-boundary">
        <span class="boundary-icon">${icon('play')}</span>
        <div><strong>Début du niveau ${level}</strong></div>
        <button class="secondary jump-finish" data-jump-finish>Voir la fin</button>
      </div>`}
      ${journeyTrail(all, current)}
      ${assessment ? `<section class="level-boundary level-assessment" aria-label="Bilan de fin de niveau">
        <span class="boundary-icon">${icon('book')}</span><div><strong>Bilan de fin de niveau ${level}</strong>
        <span>${assessment.exercises ? 'Tests du cahier Menschen' : 'Ton PDF Test A1.1'} · ${answered} / ${assessment.pages.length} pages validées</span></div>
        <a class="secondary" href="${assessmentUrl}${assessed ? '/result' : ''}">${assessed ? 'Voir mon bilan' : answered ? 'Reprendre le bilan' : 'Ouvrir le bilan'}</a>
      </section>` : ''}
      <footer class="level-boundary level-finish" id="level-finish" tabindex="-1">
        <span class="boundary-icon">${icon('trophy')}</span>
        <div><strong>${level===preparationLevel ? 'Fin de la préparation' : (finished && assessed ? 'Niveau terminé · ' : 'Fin du niveau ')+level}</strong></div>
        ${nextLevel && assessed ? `<a class="secondary" href="#path/${nextLevel}">Niveau ${nextLevel}</a>` : ''}
      </footer>
    </section><aside class="journey-rail">${dailyPanel()}</aside></div>`;
}

function lessonMinutes(l) {
  return Math.max(1, Math.ceil(l.effectiveDuration / 60));
}

function journeyTrail(lessons, current) {
  const firstUnfinished = lessons.findIndex(l => !groupDone(l));
  const trailProgress = firstUnfinished < 0 ? 100 : 100 * firstUnfinished / Math.max(1, lessons.length - 1);
  const height = lessons.length * 104 + 16;
  const points = lessons.map((_, i) => [50 + Math.sin(i * 1.4) * 9, i * 104 + 60]);
  const line = points.map(([x,y],i) => {
    if (!i) return `M ${x*6} ${y}`;
    const [previousX, previousY] = points[i-1];
    return `C ${previousX*6} ${previousY+50} ${x*6} ${y-50} ${x*6} ${y}`;
  }).join(' ');
  return `<section class="journey-chapter" aria-label="Séances du niveau">
    <div class="chapter-road" style="height:${height}px"><svg class="road-line" viewBox="0 0 600 ${height}" preserveAspectRatio="none" aria-hidden="true">
    <path class="road-ahead" d="${line}"/><path class="road-done" pathLength="100" style="--travelled:${trailProgress}" d="${line}"/></svg>
    ${lessons.map((l, i) => {
      const next = l.id === (foxJourney?.to || current.id);
      const completed = groupDone(l);
      const start = groupStart(l).id;
      const chaptersDone = l.chapters.filter(groupDone).length;
      return `<div id="map-${l.id}" class="map-step ${i%2 ? 'label-right' : 'label-left'} ${next ? 'is-current' : ''} ${completed ? 'is-complete' : ''}" style="--stop-x:${points[i][0]}%;top:${i*104+29}px">
        ${next ? '<img class="journey-mascot" src="assets/fox.svg" alt="Ta position sur la carte">' : ''}
        <button class="map-orbit" data-start="${start}" aria-label="${esc(l.title)}${completed ? ' · terminée' : ''}">${icon(completed ? 'check' : l.kind === 'audio' ? 'headphones' : 'play')}</button>
        <button class="map-step-label" data-start="${start}" tabindex="-1"><strong>${esc(l.title)}</strong><span>${chaptersDone} / ${l.chapters.length} chapitres</span></button>
      </div>`;
    }).join('')}</div>
  </section>`;
}

function journeyLevels() {
  return `<nav class="journey-levels" aria-label="Niveaux d’allemand">${levels.map((level, index) => {
    const lessons = [...recordingsBySession.values()].filter(l => l.level === level);
    const done = lessons.filter(groupDone).length;
    return `<a class="world-card" data-world="${level}" href="#path/${level}" ${level === state.level ? 'aria-current="page"' : ''}>
      <span class="world-card-icon">${icon(levelIcons[index])}</span>
      <span class="world-card-body"><strong>${levelLabel(level)}</strong><span>${levelNames[level]}</span>
      <progress value="${done}" max="${lessons.length || 1}" aria-label="Progression ${level}"></progress>
      <small>${done} / ${lessons.length} séances</small></span>
    </a>`;
  }).join('')}</nav>`;
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
    $('[data-daily-streak]').textContent = `${completed} chapitre${completed > 1 ? 's' : ''} aujourd’hui · ${count} jour${count > 1 ? 's' : ''} de suite`;
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
  const group = reviewedGroup(current);
  const unfinished = reviewedGroups.filter(chapter => !groupDone(chapter));
  const later = reviewedGroups.slice(reviewedGroups.indexOf(group) + 1);
  return later.find(chapter => chapter.session === group.session && !groupDone(chapter))
    || unfinished.find(chapter => chapter.session === group.session)
    || later.find(chapter => chapter.level === group.level && !groupDone(chapter))
    || unfinished.find(chapter => chapter.level === group.level)
    || later.find(chapter => !groupDone(chapter))
    || null;
}

function animateJourney() {
  updateDailyPanel();
  mapObserver?.disconnect();
  if (route.page === 'path' && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    mapObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('step-arrived');
        mapObserver.unobserve(entry.target);
      }
    },{threshold:.12});
    $$('.map-step').forEach(step => mapObserver.observe(step));
  }
  if (route.page !== 'path' || !foxJourney) return;
  const move = foxJourney;
  foxJourney = null;
  requestAnimationFrame(() => {
    const destination = document.getElementById('map-'+move.to);
    const mascot = destination?.querySelector('.journey-mascot');
    if (!destination || !mascot) return;
    const origin = move.from ? document.getElementById('map-'+move.from) : null;
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
