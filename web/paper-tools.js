'use strict';

let wordHoverTimer;
let wordPositionFrame;
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
  hoveredPDFWord?.classList.remove('is-word-anchored');
  hoveredPDFWord = null;
  const actions = $('#pdf-word-actions');
  if (actions) actions.hidden = true;
}

function wordInteractionOpen() {
  const menu = $('#pdf-word-actions');
  const result = $('#pdf-word-card');
  return Boolean((menu && !menu.hidden) || (result && !result.hidden));
}

function positionWordActions() {
  const area = $('#pdf-word-actions');
  if (!area || area.hidden || !hoveredPDFWord?.isConnected) return;
  const bounds = hoveredPDFWord.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > innerHeight) return;
  const height = area.offsetHeight;
  area.style.left = Math.max(8,Math.min(innerWidth-area.offsetWidth-8,bounds.left))+'px';
  area.style.top = (bounds.bottom+height+12<innerHeight ? bounds.bottom+4 : Math.max(8,bounds.top-height-4))+'px';
}

function showWordActions(target, focus = false) {
  clearTimeout(wordHoverTimer);
  const word = cleanPDFWord(target.dataset.pdfWord);
  if (!word || word.length > 64 || !target.isConnected) return;
  hoveredPDFWord?.classList.remove('is-word-anchored');
  hoveredPDFWord = target;
  target.classList.add('is-word-anchored');
  let area = $('#pdf-word-actions');
  if (!area) {
    area = document.createElement('div');
    area.id = 'pdf-word-actions';
    area.className = 'pdf-word-actions';
    area.setAttribute('role','group');
    document.body.append(area);
  }
  area.setAttribute('aria-label','Actions pour '+word);
  area.innerHTML = `<strong lang="de">${esc(word)}</strong><button type="button" data-pdf-word-action="translate">Traduire</button>
    <button type="button" data-pdf-word-action="listen" aria-label="Écouter ${esc(word)}">${icon('volume')} Écouter</button>`;
  area.hidden = false;
  positionWordActions();
  if (focus) $('button',area).focus({preventScroll:true});
}

function scheduleWordPosition() {
  if (wordPositionFrame || !hoveredPDFWord) return;
  wordPositionFrame = requestAnimationFrame(()=>{
    wordPositionFrame = null;
    positionWordActions();
  });
}

document.addEventListener('pointerover', event => {
  if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
  const target = event.target.closest('[data-pdf-word]');
  if (!target || wordInteractionOpen() || window.getSelection()?.toString()) return;
  clearTimeout(wordHoverTimer);
  wordHoverTimer = setTimeout(()=>showWordActions(target),240);
});
document.addEventListener('pointerout', event => {
  if (!wordInteractionOpen() && event.target instanceof Element && event.target.closest('[data-pdf-word]')) {
    clearTimeout(wordHoverTimer);
  }
});
document.addEventListener('scroll',scheduleWordPosition,{capture:true,passive:true});
window.addEventListener('resize',scheduleWordPosition);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (wordInteractionOpen()) hideWordCard();
  else toggleReaderFocus(false);
});
document.addEventListener('click', event => {
  const action = event.target.closest('[data-pdf-word-action]');
  if (action && hoveredPDFWord) {
    const anchor = hoveredPDFWord;
    openPDFWord(anchor.dataset.pdfWord,anchor,action.dataset.pdfWordAction === 'listen');
  } else if (!event.target.closest('[data-pdf-word],#pdf-word-actions,#pdf-word-card')) {
    hideWordActions();
  }
  if (event.target.closest('[data-pdf-expand]')) toggleReaderFocus();
  if (event.target.closest('[data-paper-view]')) {
    state.paperLayout = paperView() === 'page' ? 'width' : 'page';
    state.bookZoom = 1;
    save();
    updateReader();
  }
});
