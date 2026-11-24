'use strict';

let pageLessons;

function findPageLesson(bookId, page) {
  if (!pageLessons) {
    pageLessons = new Map();
    for (const l of data.lessons) {
      if (!l.mediaUrl) continue;
      for (const ref of l.refs) {
        for (let number = ref.start; number <= ref.end; number++) {
          const key = ref.book + ':' + number;
          const onScreen = l.pageCues?.some(cue => cue.book === ref.book && cue.page === number);
          const score = onScreen ? 3 : ref.purpose === 'À l’écran' ? 2 : 1;
          if ((pageLessons.get(key)?.score || 0) < score) pageLessons.set(key, {l,score});
        }
      }
    }
  }
  return pageLessons.get(bookId + ':' + page)?.l;
}

function lessonPageURL(l, bookId, page) {
  return '#lesson/' + l.id + '/watch/' + bookId + '/' + page;
}

function libraryBookURL(b) {
  if (b.kind === 'test') return '#assessment/' + b.level;
  for (const page of b.pages) {
    const linked = findPageLesson(b.id, page.page);
    if (linked) return lessonPageURL(linked,b.id,page.page);
  }
  return '#book/' + b.id + '/1/reference';
}

function resolveLinkedCourse() {
  if (route.page === 'books-path') {
    history.replaceState(null,'','#path/' + (levels.includes(route.id) ? route.id : state.level));
    route = parseRoute();
    return;
  }
  if (route.page !== 'book' || route.bookId === 'reference') return;
  const source = book(route.id);
  if (!source) return;
  const page = Number(route.tab) || 1;
  const linked = findPageLesson(source.id,page);
  if (!linked && source.kind !== 'test') return;
  history.replaceState(null,'',source.kind === 'test' ? '#assessment/' + source.level : lessonPageURL(linked,source.id,page));
  route = parseRoute();
}

function linkedPageCue(l) {
  if (!route.bookId || !route.pdfPage) return null;
  return l.pageCues?.find(cue => cue.book === route.bookId && cue.page === route.pdfPage) || null;
}

function lessonApplication(l) {
  if (l.topic === 'alphabet' && speechModels.alphabet) {
    return alphabetQuestions(l).find(question => question.kind === 'dictation');
  }
  return l.questions?.find(question => !question.options)
    || data.topics[l.topic]?.questions.find(question => !question.options);
}

function lessonGuideHTML(l) {
  const focus = l.focusRule || data.topics[l.topic]?.rule;
  const application = lessonApplication(l);
  const key = 'application:' + l.id;
  const audio = application?.sample ? exerciseAudioHTML({title:'Dictée du cours',src:pronunciationClip(application.sample,state.voice==='male'?'male':'female')}) : '';
  return `<section class="lesson-guide">
    <h2>${icon('leaf')} À retenir dans cette leçon</h2>
    <p>${esc(focus)}</p>
    ${application ? `<details><summary>${icon('check')} Appliquer la notion</summary>
      <div class="application-body">${audio}${answerField(key,application.prompt,state.answers[key])}
      <button class="secondary" data-check-application>Vérifier</button>
      <div class="task-feedback" data-application-feedback role="status"></div></div></details>` : ''}
  </section>`;
}

document.addEventListener('click', event => {
  if (!event.target.closest('[data-check-application]') || route.page !== 'lesson') return;
  const l = lesson(route.id);
  const q = lessonApplication(l);
  const answer = $('.lesson-guide [data-guided-answer]').value.trim();
  const feedback = $('[data-application-feedback]');
  if (!answer) {
    feedback.textContent = 'Écris ta réponse pour la vérifier.';
    return;
  }
  const ok = q.kind === 'dictation' ? matchesSpeechAnswer(q,answer) : normalize(answer) === normalize(q.answer);
  feedback.innerHTML = `<div class="part-result ${ok?'correct':'review'}"><strong>${ok?'Correct ✓':'Réponse attendue'}</strong>
    ${ok?'':` <span lang="de">${esc(q.model?.text || q.answer)}</span>`}
    <p>${esc(q.explanation)}</p></div>`;
});
