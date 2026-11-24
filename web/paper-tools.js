'use strict';

let wordHoverTimer;
let wordDismissTimer;
let hoveredPDFWord;

function paperView() {
  return state.paperLayout || 'width';
}

function bindPaperAspect() {
  const image = $('.pdf-page-image');
  if (!image) return;
  function setAspect() {
    if (image.naturalHeight) image.parentElement.style.setProperty('--page-aspect',image.naturalWidth / image.naturalHeight);
  }
  if (image.complete) setAspect();
  else image.addEventListener('load',setAspect,{once:true});
}

function toggleReaderFocus(force) {
  const reader = $('#reader');
  if (!reader) return;
  const active = reader.classList.toggle('is-expanded',force ?? !reader.classList.contains('is-expanded'));
  const button = $('[data-pdf-expand]',reader);
  button.textContent = active ? '×' : '⛶';
  button.setAttribute('aria-label',active ? 'Fermer la vue agrandie' : 'Agrandir dans le cours');
  button.title = button.getAttribute('aria-label');
}

function cleanPDFWord(value) {
  return String(value || '').trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu,'');
}

function hideWordActions() {
  clearTimeout(wordHoverTimer);
  clearTimeout(wordDismissTimer);
  hoveredPDFWord = null;
  const actions = $('#pdf-word-actions');
  if (actions) actions.hidden = true;
}

function showWordActions(target) {
  const word = cleanPDFWord(target.dataset.pdfWord);
  if (!word || word.length > 64 || !target.isConnected) return;
  let area = $('#pdf-word-actions');
  if (!area) {
    area = document.createElement('div');
    area.id = 'pdf-word-actions';
    area.className = 'pdf-word-actions';
    document.body.append(area);
  }
  area.innerHTML = `<strong lang="de">${esc(word)}</strong><button data-pdf-word-action="translate">Traduire</button>
    <button data-pdf-word-action="listen" aria-label="Écouter ${esc(word)}">${icon('volume')} Écouter</button>`;
  area.hidden = false;
  const bounds = target.getBoundingClientRect();
  const height = area.offsetHeight;
  area.style.left = Math.max(8,Math.min(innerWidth - area.offsetWidth - 8,bounds.left)) + 'px';
  area.style.top = (bounds.bottom + height + 12 < innerHeight ? bounds.bottom + 4 : Math.max(8,bounds.top - height - 4)) + 'px';
}

document.addEventListener('pointerover', event => {
  if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
  if (event.target.closest('#pdf-word-actions')) {
    clearTimeout(wordDismissTimer);
    return;
  }
  const target = event.target.closest('[data-pdf-word]');
  if (!target || !$('#pdf-word-card')?.hidden || window.getSelection()?.toString()) return;
  clearTimeout(wordHoverTimer);
  clearTimeout(wordDismissTimer);
  hoveredPDFWord = target;
  wordHoverTimer = setTimeout(() => showWordActions(target),240);
});
document.addEventListener('pointerout', event => {
  if (!(event.target instanceof Element) || !event.target.closest('[data-pdf-word],#pdf-word-actions')) return;
  if (event.relatedTarget instanceof Element && event.relatedTarget.closest('#pdf-word-actions')) return;
  clearTimeout(wordHoverTimer);
  clearTimeout(wordDismissTimer);
  wordDismissTimer = setTimeout(hideWordActions,360);
});
document.addEventListener('scroll',hideWordActions,{capture:true,passive:true});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!$('#pdf-word-card')?.hidden) return;
  toggleReaderFocus(false);
  hideWordActions();
});
document.addEventListener('click', event => {
  const action = event.target.closest('[data-pdf-word-action]');
  if (action && hoveredPDFWord) {
    const anchor = hoveredPDFWord;
    hideWordActions();
    openPDFWord(anchor.dataset.pdfWord,anchor,action.dataset.pdfWordAction === 'listen');
  }
  if (event.target.closest('[data-pdf-expand]')) toggleReaderFocus();
  if (event.target.closest('[data-paper-view]')) {
    state.paperLayout = paperView() === 'page' ? 'width' : 'page';
    state.bookZoom = 1;
    save();
    updateReader();
  }
});
