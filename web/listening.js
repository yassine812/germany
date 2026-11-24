'use strict';

const listeningBooks = new Map();

async function listeningLines(track) {
  const book = /^(a\d\d-(?:kb|ab))-[a-f0-9]+$/u.exec(track)?.[1];
  if (!book) return [];
  if (!listeningBooks.has(book)) {
    const request = fetch(`assets/book-audio/listening-${book}.json?v=${window.DEUTSCHWEG_BUILD || '1'}`)
      .then(response => {
        if (!response.ok) throw Error('Transcription indisponible');
        return response.json();
      })
      .catch(error => { listeningBooks.delete(book); throw error; });
    listeningBooks.set(book,request);
  }
  const tracks = await listeningBooks.get(book);
  return tracks[track] || [];
}

function listeningWordAt(words, time) {
  let low = 0, high = words.length;
  while (low < high) {
    const middle = (low+high) >>> 1;
    if (words[middle][0] <= time) low = middle+1;
    else high = middle;
  }
  const index = low-1;
  return index >= 0 && time < words[index][1] ? index : -1;
}

function listeningWordKey(word) {
  return word.normalize('NFC').toLocaleLowerCase('de-DE').replace(/[^\p{L}\p{N}]/gu,'');
}

function matchListeningWords(words, pdfWords) {
  const tokens = pdfWords.map(node => listeningWordKey(node.dataset.pdfWord));
  const matches = new Map();
  for (let index=0; index+2<tokens.length; index++) {
    const phrase = tokens.slice(index,index+3);
    if (phrase.some(token => !token)) continue;
    const first = pdfWords[index], last = pdfWords[index+2];
    const sameLine = Math.abs(parseFloat(first.style.top)-parseFloat(last.style.top)) < parseFloat(first.style.height);
    if (!sameLine || parseFloat(first.style.left)>=parseFloat(last.style.left)) continue;
    const key = phrase.join(' ');
    matches.set(key,matches.has(key) ? null : index);
  }
  const spoken = words.map(word => listeningWordKey(word[2]));
  const result = new Map();
  for (let index=0; index+2<spoken.length; index++) {
    if (words[index+2][0]-words[index][1] > 1800) continue;
    const match = matches.get(spoken.slice(index,index+3).join(' '));
    if (match == null) continue;
    for (let offset=0; offset<3; offset++) result.set(index+offset,pdfWords[match+offset]);
  }
  return result;
}

function exercisePDFWords(layer,taskId) {
  const page = activePaper();
  const task = pdfTasks(page).find(item => item.id===taskId);
  if (!task || layer?.dataset.pageKey !== page.book+':'+page.page) return [];
  return [...layer.children].filter(node => {
    const x = (parseFloat(node.style.left)+parseFloat(node.style.width)/2)/100;
    const y = (parseFloat(node.style.top)+parseFloat(node.style.height)/2)/100;
    return x >= (task.left ?? 0) && x <= (task.right ?? 1) && y >= task.top && y <= task.bottom;
  });
}

function keepListeningWordVisible(scroller, word) {
  if (!scroller?.clientHeight) return;
  const bounds = scroller.getBoundingClientRect();
  const target = word.getBoundingClientRect();
  if (target.top < bounds.top+5 || target.bottom > bounds.bottom-5) {
    scroller.scrollTop += (target.top+target.bottom-bounds.top-bounds.bottom)/2;
  }
  if (target.left < bounds.left+5 || target.right > bounds.right-5) {
    scroller.scrollLeft += (target.left+target.right-bounds.left-bounds.right)/2;
  }
}

function bindListeningTranscript(audio) {
  const card = audio.closest('[data-listening-track]');
  if (!card) return;
  const details = card.querySelector('.listening-follow');
  const transcript = card.querySelector('.listening-transcript');
  const status = card.querySelector('[data-listening-status]');
  const task = card.closest('[data-guided-task]')?.dataset.guidedTask;
  let words = [], labels = [], pending, frame = 0, index = -1, pdfAnchor, pdfMatches = new Map(), pdfWord;

  function update() {
    const time = audio.currentTime*1000;
    const current = audio.ended ? -1 : listeningWordAt(words,time);
    if (index !== current) {
      labels[index]?.removeAttribute('aria-current');
      index = current;
      const word = labels[index];
      if (word) {
        word.setAttribute('aria-current','true');
        keepListeningWordVisible(transcript,word);
      }
    }
    const layer = document.getElementById('pdf-text-layer');
    if (pdfAnchor !== layer?.firstElementChild) {
      pdfAnchor = layer?.firstElementChild;
      pdfMatches = matchListeningWords(words,exercisePDFWords(layer,task));
    }
    const highlight = audio.paused ? null : pdfMatches.get(index);
    if (pdfWord !== highlight) {
      pdfWord?.classList.remove('is-listening-word');
      pdfWord = highlight;
      if (pdfWord) {
        pdfWord.classList.add('is-listening-word');
        if (!wordInteractionOpen()) keepListeningWordVisible(document.getElementById('pdf-stage'),pdfWord);
      }
    }
  }

  function follow() {
    update();
    if (!audio.paused && audio.isConnected) frame = requestAnimationFrame(follow);
  }

  audio.addEventListener('play',async () => {
    if (!pending) {
      details.hidden = false;
      details.open = true;
      status.textContent = 'Chargement de la transcription…';
      pending = listeningLines(card.dataset.listeningTrack).then(lines => {
        words = lines.flat();
        if (!words.length) {
          status.textContent = 'Aucun passage transcrit pour cette piste.';
          return;
        }
        transcript.innerHTML = lines.map(line => '<p>'+line.map(word => '<span>'+esc(word[2])+'</span>').join(' ')+'</p>').join('');
        labels = [...transcript.querySelectorAll('span')];
        transcript.hidden = false;
        status.hidden = true;
        pdfAnchor = null;
      }).catch(() => {
        pending = null;
        status.textContent = 'Transcription indisponible pour cette piste.';
      });
    }
    await pending;
    if (!audio.isConnected || !words.length) return;
    cancelAnimationFrame(frame);
    follow();
  });
  for (const event of ['seeking','seeked','pause','ended']) {
    audio.addEventListener(event,update);
  }
  details.addEventListener('toggle',() => {
    if (details.open && labels[index]) keepListeningWordVisible(transcript,labels[index]);
  });
}
