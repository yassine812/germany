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

document.addEventListener('click',event => {
  if (!event.target.closest('[data-open-lesson-notes]') || route.page!=='lesson') return;
  const l = lesson(route.id);
  const paper = activePaper();
  const previous = paper && state.answers[paper.book+':'+paper.page];
  const point = l.focusRule || data.topics[l.topic]?.rule;
  $('#settings-content').innerHTML = `<h2>Mes notes</h2>${point?`<p>${esc(point)}</p>`:''}
    <textarea class="note-area" id="lesson-notes" aria-label="Mes notes sur cette leçon" placeholder="Écris tes notes ici…">${esc(state.notes[l.id]||'')}</textarea>
    ${previous?`<details><summary>Ma note précédente sur cette page</summary><p>${esc(previous)}</p></details>`:''}`;
  $('#settings').showModal();
});
