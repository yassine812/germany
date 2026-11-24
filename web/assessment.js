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
  return `<div class="coach-heading"><button class="answers-close" data-toggle-exercises aria-label="Fermer les réponses">×</button>
    <h2>Exercices de la leçon ${spec.firstLesson + index}</h2><span>${done} / ${spec.pages.length} pages validées</span></div>
    <div class="assessment-fields">${Array.from({length:spec.exercises[index]}, (_,i) => {
      const key = assessmentAnswerKey(page, i);
      return answerField(key,'Exercice ' + (i + 1),state.answers[key],true);
    }).join('')}</div>
    <div class="assessment-actions"><button class="secondary" data-key-page="${keyPage}">${icon('book')} Corrigé imprimé · p. ${book(page.book).pages[keyPage-1].printed}</button>
    ${assessmentFinishPageHTML()}</div>`;
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
  let details = 'Tu peux reprendre chaque page avec le corrigé du cahier.';
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
  <p>${count} / ${spec.pages.length} pages validées</p><p>${details}</p>
  <div class="action-row"><a class="secondary" href="#assessment/${level}">Revoir mes réponses</a>
  ${next && count === spec.pages.length ? `<button class="primary" data-continue-level="${next}">Continuer en ${next}</button>` :
    `<a class="primary" href="#path/${level}">Revenir à mon parcours</a>`}</div></section>`;
}

function assessmentHTML(level) {
  const spec = assessments[level];
  const b = spec && book(spec.book);
  if (!b) return '<p class="empty">Bilan indisponible.</p>';
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

document.addEventListener('click', event => {
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
