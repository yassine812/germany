'use strict';

const bookSeries = 'https://www.hueber.de/reihe/menschen/';
const editionCatalog = 'https://legacy.hueber.de/media/36/9783198903346-Sprachprogramm-fuer-Hochschulen.pdf';
const editions = {
  'a11-kb':'978-3-19-301901-1', 'a11-ab':'978-3-19-311901-8',
  'a12-kb':'978-3-19-501901-9', 'a12-ab':'978-3-19-511901-6',
  'a21-kb':'978-3-19-301902-8', 'a21-ab':'978-3-19-311902-5'
};
const assessments = {
  'A1.1':{book:'test', pages:[1,2,3,4,5]},
  'A1.2':{book:'a12-ab', pages:[12,18,24,36,42,48,60,66,72,84,90,96], exercises:[4,4,3,5,4,4,4,4,4,4,4,4], keyPages:[108,109], firstLesson:13},
  'A2.1':{book:'a21-ab', pages:[11,17,23,35,41,47,59,65,71,83,89,95], exercises:[5,3,3,3,3,3,4,4,3,4,3,3], keyPages:[107,108], firstLesson:1}
};
const pdfChannels = {
  'notes':'Téléchargé via WhatsApp Web',
  'test':'Téléchargé via WhatsApp Web',
  'a11-ab':'Téléchargé via WhatsApp Web',
  'a11-kb':'Téléchargé via WhatsApp Web',
  'a21-ab':'Le nom du fichier indique feismo.com',
  'a21-kb':'Le nom du fichier indique toaz.info'
};

const workbookAnchors = {"a12-ab":{"12":[0.107,0.327,0.506,0.671],"18":[0.115,0.299,0.459,0.549],"24":[0.118,0.31,0.531],"36":[0.131,0.273,0.396,0.553,0.676],"42":[0.124,0.311,0.49,0.687],"48":[0.128,0.233,0.424,0.579],"60":[0.128,0.284,0.44,0.643],"66":[0.125,0.275,0.521,0.679],"72":[0.124,0.28,0.428,0.596],"84":[0.126,0.297,0.47,0.61],"90":[0.127,0.292,0.459,0.65],"96":[0.127,0.318,0.529,0.686]},"a21-ab":{"11":[0.107,0.188,0.359,0.529,0.646],"17":[0.103,0.292,0.438],"23":[0.104,0.312,0.529],"35":[0.109,0.313,0.561],"41":[0.107,0.402,0.617],"47":[0.108,0.33,0.507],"59":[0.108,0.313,0.456,0.652],"65":[0.1,0.363,0.562,0.626],"71":[0.103,0.391,0.607],"83":[0.109,0.366,0.482,0.642],"89":[0.112,0.377,0.519],"95":[0.113,0.298,0.589]}};
let workbookKeys = null;
let workbookKeysRequest = null;

function loadWorkbookKeys() {
  if (workbookKeys || workbookKeysRequest) return;
  workbookKeysRequest = fetch('/api/workbook-keys').then(response => {
    if (!response.ok) throw Error('workbook keys');
    return response.json();
  }).then(keys => {
    workbookKeys = keys;
    if (route.page !== 'assessment' || !assessments[route.id]?.exercises) return;
    if (route.tab === 'result') {
      $('#main').innerHTML = assessmentResult(route.id);
    } else {
      $('#classroom-answers').innerHTML = assessmentPaperHTML();
    }
  }).catch(() => {
    const status = $('[data-workbook-key-status]');
    if (status) status.innerHTML = 'Le corrigé automatique ne se charge pas. <button class="link-button" data-retry-workbook>Réessayer</button>';
  }).finally(() => { workbookKeysRequest = null; });
}

function workbookPartKey(page, exercise, label) {
  return assessmentAnswerKey(page, exercise) + ':' + label;
}

function gradeWorkbookPart(answer, expected) {
  const variants = text => text.replace(/\bgerne\b/giu,'gern').replace(/\bzuhause\b/giu,'zu Hause');
  return gradeClosedAnswer(variants(answer),{expected:variants(expected)});
}

function workbookStats(level) {
  const spec = assessments[level];
  const pages = workbookKeys?.[spec.book];
  if (!pages) return null;
  const stats = {correct:0, answered:0, total:0, review:[]};
  for (const page of spec.pages) {
    let issues = 0;
    for (const [exercise,parts] of pages[page].entries()) {
      for (const [label, expected] of parts) {
        const text = state.answers[workbookPartKey({book:spec.book,page},exercise,label)] || '';
        const result = gradeWorkbookPart(text, expected);
        stats.total++;
        if (text.trim()) stats.answered++;
        if (result.status === 'correct') stats.correct++;
        else issues++;
      }
    }
    if (issues) stats.review.push({page, issues});
  }
  return stats;
}

function highlightWorkbookExercise(exercise) {
  const paper = activePaper();
  const bounds = workbookAnchors[paper?.book]?.[paper.page];
  if (!bounds || bounds[exercise] === undefined) return;
  focusCourseRegion({region:[Math.max(0,bounds[exercise] - .009),(bounds[exercise + 1] || .84) - .009]},true);
}

function workbookFeedbackHTML(value, expected, result) {
  if (result.status === 'correct') return 'Correct ✓';
  if (result.status === 'empty') return 'À compléter';
  const cleanValue = normalizedAnswer(value);
  const cleanExpected = normalizedAnswer(expected);
  const unaccented = text => text.normalize('NFD').replace(/\p{M}/gu,'');
  let hint = result.message;
  if (hint === 'À revoir' && cleanValue !== cleanExpected) {
    if (unaccented(cleanValue) === unaccented(cleanExpected)) hint = 'Vérifie l’umlaut';
    else if (cleanValue.split(' ').sort().join(' ') === cleanExpected.split(' ').sort().join(' ')) hint = 'Vérifie l’ordre des mots';
    else if (cleanExpected.length >= 5 && !cleanExpected.includes(' ') && !cleanValue.includes(' ') && cleanValue.startsWith(cleanExpected.slice(0,-2))) hint = 'Vérifie la terminaison';
  }
  const before = value.trim().split(/\s+/u);
  const after = expected.trim().split(/\s+/u);
  let start = 0, end = 0;
  while (start < Math.min(before.length,after.length) && before[start] === after[start]) start++;
  while (end < Math.min(before.length,after.length) - start && before[before.length - end - 1] === after[after.length - end - 1]) end++;
  const display = `<span lang="de">${esc(after.slice(0,start).join(' '))} <ins>${esc(after.slice(start,after.length-end).join(' '))}</ins> ${esc(after.slice(after.length-end).join(' '))}</span>`;
  return `${esc(hint)} · ${display}`;
}

function correctWorkbookPage() {
  const p = activePaper();
  const exercises = workbookKeys?.[p?.book]?.[p.page];
  if (!exercises) return;
  let correct = 0, total = 0, answered = 0;
  let firstIssue = -1;
  for (const [index, parts] of exercises.entries()) {
    const group = $("[data-workbook-exercise='" + index + "']");
    const fields = $$('[data-guided-answer]',group);
    let issues = 0;
    for (const [i, [, expected]] of parts.entries()) {
      const field = fields[i];
      const result = gradeWorkbookPart(field.value,expected);
      const feedback = document.getElementById(field.getAttribute('aria-describedby'));
      feedback.innerHTML = workbookFeedbackHTML(field.value,expected,result);
      feedback.className = 'workbook-part-status ' + result.status;
      field.setAttribute('aria-invalid',String(result.status === 'review'));
      field.closest('label').dataset.grade = result.status;
      total++;
      if (field.value.trim()) answered++;
      if (result.status === 'correct') correct++;
      else issues++;
    }
    $('[data-workbook-section-result]',group).textContent = (parts.length - issues) + ' / ' + parts.length + ' justes';
    if (issues && firstIssue < 0) firstIssue = index;
  }
  $('[data-workbook-page-result]').textContent = correct + ' / ' + total + ' réponses justes · ' + (total - answered) + ' à compléter';
  if (firstIssue >= 0) {
    const first = $("[data-workbook-exercise='" + firstIssue + "']");
    first.open = true;
    $('summary',first).focus({preventScroll:true});
    first.scrollIntoView({block:'nearest'});
    highlightWorkbookExercise(firstIssue);
  }
}

function assessmentProgress(level) {
  return state.assessments?.[level] || {index:0, pages:{}};
}

function saveAssessmentPage(index) {
  state.assessments ||= {};
  const saved = state.assessments[route.id] ||= {index:0, pages:{}};
  saved.index = index;
  save();
  return saved;
}

function assessmentReaderHTML() {
  const level = route.id;
  const spec = assessments[level];
  const b = book(spec.book);
  const key = 'assessment:' + level;
  if (readerState?.key !== key) {
    const pages = spec.pages.map((number,index) => ({
      ...b.pages[number-1], book:b.id, title:b.title,
      purpose:spec.exercises ? 'Lektion ' + (spec.firstLesson + index) : 'Épreuve A1.1'
    }));
    const index = Math.max(0, Math.min(pages.length-1, assessmentProgress(level).index || 0));
    readerState = {key,pages,index};
  }
  return readerHTML(null,b.id,1,readerState);
}

function assessmentPaperHTML() {
  const level = route.id;
  const spec = assessments[level];
  const index = readerState.index;
  const page = readerState.pages[index];
  const saved = assessmentProgress(level);
  const done = Object.values(saved.pages).filter(Boolean).length;
  if (!spec.exercises) return exercisePanelHTML(null);
  const keyPage = spec.keyPages[index < 8 ? 0 : 1];
  const exercises = workbookKeys?.[page.book]?.[page.page];
  const reference = `<button class="secondary" data-key-page="${keyPage}">${icon('book')} Corrigé imprimé · p. ${book(page.book).pages[keyPage-1].printed}</button>`;
  return `<div class="coach-heading">
    <h2>Exercices de la leçon ${spec.firstLesson + index}</h2><span>${done} / ${spec.pages.length} pages validées</span></div>
    ${exercises ? `<p class="coach-instruction">Saisis les réponses repérées par les lettres et les numéros de la page.</p>
    <div class="assessment-fields">${exercises.map((parts,i) => {
      const oldAnswer = state.answers[assessmentAnswerKey(page,i)];
      return `<details class="guided-task workbook-task" data-workbook-exercise="${i}" ${i===0?'open':''}>
      <summary><span class="exercise-number">${i+1}</span><strong>Exercice ${i+1}</strong><span class="task-correction-label" data-workbook-section-result></span></summary>
      <div class="guided-task-body workbook-fields">
      ${parts.map(([label,expected],j) => {
        const key = workbookPartKey(page,i,label);
        const description = 'workbook-feedback-' + i + '-' + j;
        const field = answerField(key,label,state.answers[key],expected.length>74).replace('data-guided-answer=','aria-describedby="'+description+'" data-guided-answer=');
        return field.replace('</label>',`<span id="${description}" class="workbook-part-status"></span></label>`);
      }).join('')}
      ${oldAnswer ? `<details class="old-answer"><summary>Ma réponse précédente</summary><p>${esc(oldAnswer)}</p></details>` : ''}
      </div></details>`;
    }).join('')}</div>
    <div class="assessment-actions"><button class="primary" data-correct-workbook>Corriger cette page</button>${reference}${assessmentFinishPageHTML()}</div>
    <p class="workbook-page-result" data-workbook-page-result role="status"></p>` :
    `<p data-workbook-key-status role="status">Chargement du corrigé automatique…</p><div class="assessment-actions">${reference}</div>`}`;
}

function assessmentAnswerKey(page, index) {
  return 'assessment:' + page.book + ':' + page.page + ':' + index;
}

function assessmentFinishPageHTML() {
  return '<button class="study-check" data-finish-assessment-page>' + icon('check') + ' Valider cette page</button>';
}

function assessmentResult(level) {
  const spec = assessments[level];
  const next = levels[levels.indexOf(level) + 1];
  const count = Object.values(assessmentProgress(level).pages).filter(Boolean).length;
  let details = 'Chargement du corrigé automatique…';
  let replay = '';
  if (spec.exercises) {
    const stats = workbookStats(level);
    if (stats) {
      details = stats.correct + ' / ' + stats.total + ' réponses justes · ' + stats.answered + ' renseignées';
      replay = `<ul class="assessment-review">${stats.review.map(({page,issues}) => `<li><button class="link-button" data-workbook-return="${spec.pages.indexOf(page)}">Page ${book(spec.book).pages[page-1].printed} · ${issues} à revoir</button></li>`).join('')}</ul>`;
    }
  }
  if (!spec.exercises) {
    let correct = 0, count = 0;
    const b = book(spec.book);
    for (const page of spec.pages) {
      const entries = data.exercisePages?.books?.[b.id]?.[page]?.tasks || [];
      const paper = {book:b.id,page};
      for (const task of entries) {
        const corrected = solutionFor(b, task, paper);
        corrected?.parts.forEach((part,index) => {
          if (part.open) return;
          count++;
          if (gradeClosedAnswer(state.answers[answerBase(paper,task) + ':part' + index] || '',part).status === 'correct') correct++;
        });
      }
    }
    details = correct + ' / ' + count + ' réponses corrigées sont justes. La présentation écrite se relit avec les conseils de la dernière page.';
  }
  return `<section class="assessment-result card"><img src="assets/fox.svg" alt=""><h1>Bilan ${level} ${count === spec.pages.length ? 'terminé' : 'en cours'}</h1>
  <p>${count} / ${spec.pages.length} pages validées</p><p>${details}</p>${replay}${spec.exercises && !workbookKeys ? '<p data-workbook-key-status></p>' : ''}
  <div class="action-row"><a class="secondary" href="#assessment/${level}">Revoir mes réponses</a>
  ${next && count === spec.pages.length ? `<button class="primary" data-continue-level="${next}">Continuer en ${next}</button>` :
    `<a class="primary" href="#path/${level}">Revenir à mon parcours</a>`}</div></section>`;
}

function assessmentHTML(level) {
  const spec = assessments[level];
  const b = spec && book(spec.book);
  if (!b) return '<p class="empty">Bilan indisponible.</p>';
  if (spec.exercises) loadWorkbookKeys();
  if (route.tab === 'result') return assessmentResult(level);
  const paper = assessmentReaderHTML();
  return `<div class="classroom-heading">
    <a class="icon-btn" href="#path/${level}" aria-label="Retour au parcours">${icon('back')}</a>
    <div><small>${spec.exercises ? 'Tests du cahier Menschen' : 'Ton PDF de formation'}</small><h1>Bilan de fin de niveau ${level}</h1></div>
    <button class="secondary assessment-jump" data-jump-assessment>${icon('book')} Répondre</button>
  </div><div class="classroom-layout book-classroom assessment-layout"><section class="classroom-document">${paper}</section>
    <aside class="classroom-coach"><section class="classroom-answers book-answers" id="classroom-answers" tabindex="-1">${assessmentPaperHTML()}</section></aside></div>`;
}

function showPDFDetails(bid) {
  const b = book(bid);
  if (!b) return;
  const isbn = editions[bid];
  const dialog = $('#course-document-dialog');
  $('.document-dialog-body', dialog).innerHTML = `<h2 id="course-document-title">Origine du PDF</h2><dl>
    <dt>Support</dt><dd>${esc(b.title)}</dd>
    <dt>Fichier d’origine</dt><dd>${esc(b.file)}</dd>
    <dt>Provenance de la copie</dt><dd>${pdfChannels[bid] || 'PDF fourni avec le cours. L’adresse de téléchargement n’est pas disponible.'}</dd>
    ${isbn ? `<dt>Édition</dt><dd>Hueber Verlag · ISBN ${isbn}</dd>` : ''}
    </dl>${isbn ? `<div class="action-row"><a class="secondary" href="${bookSeries}" target="_blank" rel="noopener">Collection chez Hueber</a><a href="${editionCatalog}" target="_blank" rel="noopener">Catalogue et ISBN</a></div>` : ''}`;
  dialog.showModal();
}

document.addEventListener('toggle', event => {
  if (event.target.open && event.target.matches('[data-workbook-exercise]')) {
    highlightWorkbookExercise(Number(event.target.dataset.workbookExercise));
  }
}, true);

document.addEventListener('input', event => {
  const field = event.target;
  const group = field.closest?.('[data-workbook-exercise]');
  if (!group) return;
  const feedback = document.getElementById(field.getAttribute('aria-describedby'));
  if (feedback) feedback.textContent = '';
  field.removeAttribute('aria-invalid');
  delete field.closest('label').dataset.grade;
  $('[data-workbook-section-result]',group).textContent = '';
  $('[data-workbook-page-result]').textContent = '';
});

document.addEventListener('click', event => {
  if (event.target.closest('[data-retry-workbook]')) {
    $('[data-workbook-key-status]').textContent = 'Chargement du corrigé automatique…';
    loadWorkbookKeys();
  }
  if (event.target.closest('[data-correct-workbook]')) correctWorkbookPage();
  const review = event.target.closest('[data-workbook-return]');
  if (review && route.page === 'assessment') {
    saveAssessmentPage(Number(review.dataset.workbookReturn));
    readerState = null;
    navigate('#assessment/' + route.id);
  }
  const source = event.target.closest('[data-source-pdf]');
  if (source) showPDFDetails(source.dataset.sourcePdf);
  const correction = event.target.closest('[data-key-page]');
  if (correction && route.page === 'assessment') {
    const b = book(assessments[route.id].book);
    const page = b.pages[Number(correction.dataset.keyPage) - 1];
    const dialog = $('#course-document-dialog');
    $('.document-dialog-body', dialog).innerHTML = `<h2 id="course-document-title">Corrigé du cahier · p. ${page.printed}</h2>
      <img class="assessment-key" src="${esc(page.image)}" alt="Lösungsschlüssel Tests, page ${page.printed}">`;
    dialog.showModal();
  }
  if (event.target.closest('[data-jump-assessment]')) {
    const answers = $('#classroom-answers');
    answers.focus({preventScroll:true});
    answers.scrollIntoView({block:'start'});
  }
  const next = event.target.closest('[data-continue-level]');
  if (next && route.page === 'assessment') {
    const following = data.lessons.find(l => l.level === next.dataset.continueLevel && !isDone(l.id));
    if (following) foxJourney = {to:following.id};
    navigate('#path/' + next.dataset.continueLevel);
  }
  if (!event.target.closest('[data-finish-assessment-page]') || route.page !== 'assessment') return;
  if (!$$('[data-guided-answer]', $('#classroom-answers')).some(field => field.value.trim())) {
    toast('Écris au moins une réponse sur cette page.');
    return;
  }
  const index = readerState.index;
  const saved = saveAssessmentPage(index);
  saved.pages[index] = true;
  save();
  const following = readerState.pages.findIndex((_, position) => position > index && !saved.pages[position]);
  const earlier = readerState.pages.findIndex((_, position) => !saved.pages[position]);
  readerState.index = following === -1 ? earlier : following;
  if (readerState.index < 0) {
    readerState.index = index;
    navigate('#assessment/' + route.id + '/result');
  } else {
    updateReader();
    const answers = $('#classroom-answers');
    answers.focus({preventScroll:true});
    answers.scrollIntoView({block:'nearest'});
  }
});
