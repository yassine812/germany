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

function studyPercent(done, total) {
  return total ? Math.round(100 * done / total) : 0;
}

function levelJourneyPercent(level) {
  const lessons = reviewedGroups.filter(group=>group.level===level);
  const assessment = assessments[level];
  const passed = assessment && assessment.pages.every((_,index)=>assessmentProgress(level).pages[index]);
  return studyPercent(lessons.filter(groupDone).length + Number(Boolean(passed)), lessons.length + Number(Boolean(assessment)));
}

function showJourneyCelebration({level,before,title,target,reward=0}) {
  const dialog = $('#journey-celebration');
  const after = levelJourneyPercent(level);
  persistMedia();
  dialog.dataset.from = location.hash;
  dialog.dataset.next = target;
  dialog.dataset.world = level;
  dialog.innerHTML = `<img src="assets/fox.svg" alt="">
    <h2 id="journey-celebration-title">Bravo !</h2><p>${esc(title)}</p>
    ${reward ? `<strong class="journey-reward">+ ${reward} XP</strong>` : ''}
    <div class="journey-celebration-progress"><span>${levelLabel(level)}</span><strong>${after} %</strong></div>
    <div class="journey-celebration-track" role="progressbar" aria-label="Progression du niveau"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="${after}"><span style="width:${after}%"></span></div>
    <form method="dialog"><button class="primary" autofocus>Continuer</button></form>`;
  dialog.showModal();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && after > before) {
    $('.journey-celebration-track span',dialog).animate(
      [{width:before+'%'},{width:after+'%'}], {duration:650,easing:'ease-out'});
  }
}

document.getElementById('journey-celebration').addEventListener('close', event=>{
  const {from,next} = event.currentTarget.dataset;
  if (!next || location.hash!==from) return;
  readerState = null;
  quiz = null;
  navigate(next);
});

function recordingJourneyHTML() {
  const recordings = [...recordingsBySession.values()];
  const zones = levels.map(level => ({level, stops:journeyStops(level, recordings)}));
  const stops = zones.flatMap(zone => zone.stops);
  const remembered = state.journeyNext?.[state.level];
  const savedGroup = groupsByClip.get(remembered);
  const resumeId = savedGroup ? journeyStopId(savedGroup) : remembered;
  const current = stops.find(stop => stop.id === foxJourney?.to)
    || stops.find(stop => stop.id === resumeId && !stop.complete)
    || stops.find(stop => stop.recording?.level === state.level && stop.started && !stop.complete)
    || stops.find(stop => (stop.recording || stop.assessment) && !stop.complete)
    || stops.at(-1);
  return `<div class="journey-header">
    <h1>Mon parcours</h1>
    ${current ? `<button class="journey-locate" data-journey-locate>${icon('path')} Ma position</button>` : ''}
  </div>
  <div class="journey-toolbar">
    <nav class="journey-shortcuts" aria-label="Accès aux niveaux">
      ${levels.map(level => `<a data-world="${level}" href="#path/${level}">${level===preparationLevel ? levelLabel(level) : level}</a>`).join('')}
    </nav>
    <details class="journey-daily">
      <summary>${icon('flame')} Objectif du jour</summary>
      ${dailyPanel()}
    </details>
  </div>
  <div class="journey-trail" aria-label="Parcours complet d’allemand">
    ${zones.map(({level, stops}, index) => journeyZone(level, stops, index, current)).join('')}
  </div>`;
}

function journeyStops(level, recordings) {
  const preparation = level === preparationLevel;
  const lessons = preparation ? reviewedGroups.filter(l=>l.level===level) : recordings.filter(l=>l.level===level);
  const stops = lessons.map(lesson => {
    const {completed:complete,position:started} = groupProgress(lesson);
    const pages = lesson.preparationPages || [];
    const pageText = pages.length > 1 ? `p. ${pages.join(', ')}` : `p. ${pages[0]}`;
    const subtitle = preparation
      ? [pages.length ? pageText : '', `${lessonMinutes(lesson)} min`].filter(Boolean).join(' · ')
      : `${lesson.chapters.filter(groupDone).length} / ${lesson.chapters.length} chapitres`;
    return {id:lesson.id, recording:lesson, title:lesson.title, complete, started, subtitle,
      symbol:lesson.kind === 'audio' ? 'headphones' : 'play', clip:groupStart(lesson).id,
      exercises:lesson.parts.some(lessonHasExercises)};
  });
  const assessment = assessments[level];
  if (assessment) {
    const answered = Object.values(assessmentProgress(level).pages).filter(Boolean).length;
    const complete = answered === assessment.pages.length;
    stops.push({id:'bilan-'+level, assessment:true, title:'Bilan '+level, complete,
      subtitle:`Fin du niveau · ${answered} / ${assessment.pages.length} pages`,
      symbol:'trophy', href:`#assessment/${level}${complete ? '/result' : ''}`});
  }
  return stops;
}

function lessonMinutes(l) {
  return Math.max(1, Math.ceil(l.effectiveDuration / 60));
}

function journeyZone(level, stops, index, current) {
  const stepGap = 108;
  const height = (stops.length + 1) * stepGap;
  const positions = stops.map((_, i) => [50 + 9 * Math.sin((i + 1) * 1.47), (i + 1) * stepGap + 42]);
  const points = [[50,42], ...positions];
  if (index > 0) points.unshift([50,0]);
  if (index < levels.length-1) points.push([50,height]);
  const path = points.map(([x,y], i) => {
    if (!i) return `M ${x*6} ${y}`;
    const [prevX,prevY] = points[i-1];
    const mid = (prevY+y)/2;
    return `C ${prevX*6} ${mid} ${x*6} ${mid} ${x*6} ${y}`;
  }).join(' ');
  const firstNew = stops.findIndex(stop => (stop.recording || stop.assessment) && !stop.complete);
  const travelled = firstNew < 0 ? 100 : 100 * (firstNew + .46) / (stops.length + 1);
  const heading = 'journey-'+level;
  const percent = levelJourneyPercent(level);
  return `<section class="journey-zone" id="${heading}" aria-labelledby="${heading}-title" data-world="${level}" style="--zone-height:${height}px">
    <svg class="journey-line" viewBox="0 0 600 ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path class="journey-line-bed" d="${path}"/>
      <path class="journey-line-dots" d="${path}"/>
      <path class="journey-line-progress" pathLength="100" style="--travelled:${travelled}" d="${path}"/>
    </svg>
    <header class="journey-marker" style="--stop-x:50%;top:42px">
      <span class="journey-marker-icon">${icon(levelIcons[index])}</span>
      <div class="journey-step-copy">
        <h2 id="${heading}-title">${levelLabel(level)}</h2><p>${levelNames[level]}</p>
        <div class="journey-level-progress"><progress max="100" value="${percent}" aria-label="Progression du niveau"></progress><small>${percent} %</small></div>
      </div>
    </header>
    ${stops.map((stop,i) => journeyStep(stop, positions[i], i, stop === current)).join('')}
  </section>`;
}

function journeyStep(stop, [x,y], index, current) {
  const label = `<span class="journey-pin">${icon(stop.complete ? 'check' : stop.symbol)}</span>
    <span class="journey-step-copy">
      <span class="journey-step-types">${stop.assessment ? '<span class="exercise-type">Exercices du bilan</span>' :
        `<span class="lesson-type">Leçon</span><span class="exercise-type">${stop.exercises ? 'Exercices PDF' : 'Exercice oral'}</span>`}</span>
      <strong>${esc(stop.title)}</strong><small>${esc(stop.subtitle)}</small>
    </span>`;
  const linkState = current ? ' aria-current="step"' : '';
  return `<div class="map-step ${index%2 ? 'label-right' : 'label-left'} ${stop.complete ? 'is-complete' : ''} ${current ? 'is-current' : ''}"
      id="map-${stop.id}" style="--stop-x:${x}%;top:${y}px">
    ${current ? '<img class="journey-mascot" src="assets/fox.svg" alt="Ta position sur le parcours">' : ''}
    ${stop.href ? `<a class="journey-step" href="${stop.href}"${linkState}>${label}</a>` :
      `<button class="journey-step" type="button" data-start="${stop.clip}"${linkState}>${label}</button>`}
  </div>`;
}

function dailyPanel() {
  return `<section class="daily-card" aria-label="Suivi quotidien">
    <p data-daily-streak></p>
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
  if (group.level === preparationLevel) {
    return later.find(chapter=>chapter.level===preparationLevel && !groupDone(chapter))
      || unfinished.find(chapter=>chapter.level===preparationLevel)
      || unfinished.find(chapter=>chapter.level!==preparationLevel)
      || null;
  }
  const sameSession = chapter => chapter.level===group.level && chapter.session===group.session;
  return later.find(chapter => sameSession(chapter) && !groupDone(chapter))
    || unfinished.find(sameSession)
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
  if (route.page !== 'path') return;
  if (!foxJourney) {
    if (levels.includes(route.id)) requestAnimationFrame(() => {
      document.getElementById('journey-'+route.id)?.scrollIntoView({block:'start'});
    });
    return;
  }
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
  const shortcut = event.target.closest('.journey-shortcuts a');
  if (shortcut?.getAttribute('href') === location.hash) {
    event.preventDefault();
    document.getElementById('journey-'+route.id)?.scrollIntoView({block:'start'});
  }
  if (event.target.closest('[data-journey-locate]')) {
    const current = $('.map-step.is-current .journey-step');
    current?.focus({preventScroll:true});
    current?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
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
