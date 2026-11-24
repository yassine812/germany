'use strict';

let speechModels = {};
let disposeSpeech = () => {};

function pronunciationClip(sample, voice) {
  return 'speech/' + sample + '-' + voice + '.mp3?v=' + (window.DEUTSCHWEG_BUILD || '1');
}

function speechQuestion(topic, index, mode) {
  const model = speechModels[topic]?.[index];
  return {
    model,
    kind: mode,
    sample: topic + '-' + index,
    prompt: mode === 'say' ? (model.fullAlphabet ? 'Récite l’alphabet allemand' : model.alphabetAnswer ? 'Prononce chaque lettre' : 'Écoute et répète') :
      (model.alphabetAnswer ? 'Écris les lettres entendues' : topic === 'alphabet' ? 'Écris le mot entendu' : 'Écris la phrase entendue'),
    answer: model.alphabetAnswer || model.text,
    explanation: model.tip || model.meaning
  };
}

const spokenLetters = {
  ah:'a', bé:'b', beh:'b', ce:'c', ze:'c', zee:'c', zeh:'c', de:'d',
  eh:'e', eff:'f', geh:'g', ha:'h', ie:'i', ih:'i', jot:'j', jott:'j', ka:'k',
  ell:'l', em:'m', enn:'n', oh:'o', pe:'p', ku:'q', err:'r', ess:'s',
  te:'t', uh:'u', fau:'v', vau:'v', weh:'w', we:'w', iks:'x', ix:'x',
  ypsilon:'y', zet:'z', zett:'z', äh:'ä', öh:'ö', üh:'ü', eszett:'ß', eszet:'ß'
};

function matchesSpeechAnswer(item, response) {
  if (item.model.alphabetAnswer) {
    const tokens = response.normalize('NFC').toLocaleLowerCase('de-DE').match(/[\p{L}]+/gu) || [];
    return tokens.map(token => spokenLetters[token] || token).join('') === item.model.alphabetAnswer;
  }
  return normalize(response) === normalize(item.answer);
}

function pronunciationHTML(item) {
  const say = item.kind === 'say';
  const voice = state.voice === 'male' ? 'male' : 'female';
  return `<div class="pronunciation">
    ${say ? `<div class="say-target"><strong class="${item.model.fullAlphabet ? 'alphabet-line' : ''}" lang="de">${esc(item.model.text)}</strong><p>${esc(item.model.tip || item.model.meaning)}</p></div>` : ''}
    <div class="model-controls">
      <button class="primary" data-play-model aria-pressed="false">${icon('volume')} Écouter le modèle</button>
      <button class="secondary" data-slow-model>${icon('repeat')} Très lentement</button>
      <label>Voix <select data-model-voice aria-label="Voix du modèle"><option value="female" ${voice === 'female' ? 'selected' : ''}>Femme · Katja</option>
        <option value="male" ${voice === 'male' ? 'selected' : ''}>Homme · Conrad</option></select></label>
    </div>
    <audio data-model-audio preload="none" src="${pronunciationClip(item.sample, voice)}" aria-label="Modèle allemand"></audio>
    ${say ? `<div class="speak-tools">
      <button class="secondary" data-record-voice hidden>${icon('mic')} Enregistrer ma voix</button>
    </div>
    <audio data-recorded-voice controls hidden aria-label="Réécouter ma voix"></audio>
    <div class="sound-analysis" data-sound-analysis hidden>
      <button class="primary" data-analyze-sounds>Analyser mes sons</button>
      <small>Analyse sur ton appareil · 71 Mo au premier chargement</small>
      <div class="sound-feedback" data-sound-feedback role="status" aria-live="polite"></div>
      <audio data-target-audio preload="none"></audio>
    </div>
    <div class="speech-feedback" role="status" data-speech-feedback></div>` :
      '<p class="model-feedback" data-speech-feedback role="status"></p>'}
  </div>`;
}

function bindPronunciation() {
  const card = $('.pronunciation');
  if (!card) return;
  const item = quiz.questions[quiz.index];
  const model = $('[data-model-audio]', card);
  const play = $('[data-play-model]', card);
  const slow = $('[data-slow-model]', card);
  const voice = $('[data-model-voice]', card);
  const feedback = $('[data-speech-feedback]', card);
  const record = $('[data-record-voice]', card);
  const take = $('[data-recorded-voice]', card);
  let disposed = false;
  let recorder, stream, timer, recordingUrl, recordedBlob;
  const resetFeedback = record ? bindSoundFeedback(card, item, voice, () => recordedBlob, () => {
    record.focus();
    record.click();
  }) : () => {};
  const feedbackText = text => { feedback.textContent = text; };
  const allowContinue = () => {
    const button = $('[data-finish-speaking]');
    if (button) button.disabled = false;
  };
  function setPlayer() {
    play.setAttribute('aria-pressed', String(!model.paused));
    play.innerHTML = icon('volume') + (model.paused ? ' Écouter le modèle' : ' Mettre en pause');
  }
  function releaseCapture() {
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
  }
  function stopCapture() {
    record.disabled = true;
    recorder.stop();
  }
  disposeSpeech = () => {
    disposed = true;
    disposeSpeech = () => {};
    if (recorder?.state === 'recording') recorder.stop();
    resetFeedback();
    releaseCapture();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  };
  function playModel(extraSlow) {
    if (recorder?.state === 'recording') {
      feedbackText('Arrête le micro pour réécouter le modèle.');
      return;
    }
    model.currentTime = 0;
    model.playbackRate = extraSlow ? .78 : 1;
    model.play().catch(() => feedbackText('Le modèle audio ne se charge pas. Réessaie.'));
  }
  model.preservesPitch = true;
  model.addEventListener('play', setPlayer);
  model.addEventListener('pause', setPlayer);
  model.addEventListener('ended', () => {
    item.modelPlayed = true;
    allowContinue();
    setPlayer();
  });
  play.onclick = () => model.paused ? playModel(item.modelPlayed) : model.pause();
  slow.onclick = () => playModel(true);
  voice.onchange = () => {
    model.pause();
    model.src = pronunciationClip(item.sample, voice.value);
    state.voice = voice.value;
    save();
  };
  if (item.kind !== 'say') return;

  if (navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
    record.hidden = false;
    record.onclick = async () => {
      if (recorder?.state === 'recording') {
        stopCapture();
        return;
      }
      record.disabled = true;
      resetFeedback();
      $('[data-sound-analysis]', card).hidden = true;
      take.hidden = true;
      recordedBlob = null;
      stopOtherMedia(null);
      try {
        const capture = await navigator.mediaDevices.getUserMedia({audio:true});
        if (disposed) {
          capture.getTracks().forEach(track => track.stop());
          return;
        }
        stream = capture;
        stopOtherMedia(null);
        recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = () => {
          releaseCapture();
          if (disposed) return;
          record.innerHTML = icon('mic') + ' Refaire ma prise';
          record.disabled = false;
          if (!chunks.length) {
            feedbackText('Aucun son enregistré. Tu peux réessayer.');
            return;
          }
          if (recordingUrl) URL.revokeObjectURL(recordingUrl);
          recordedBlob = new Blob(chunks, {type:recorder.mimeType});
          recordingUrl = URL.createObjectURL(recordedBlob);
          take.src = recordingUrl;
          take.hidden = false;
          $('[data-sound-analysis]', card).hidden = !window.Worker || !window.OfflineAudioContext;
          feedbackText('Réécoute ta prise, puis compare-la au modèle.');
          allowContinue();
        };
        recorder.onerror = () => feedbackText('L’enregistrement est indisponible. Tu peux répéter en écoutant le modèle.');
        recorder.start();
        feedbackText('Micro ouvert. Parle maintenant.');
        record.innerHTML = icon('mic') + ' Arrêter l’enregistrement';
        timer = setTimeout(() => { if (recorder.state === 'recording') stopCapture(); }, 40000);
      } catch {
        releaseCapture();
        if (!disposed) {
          feedbackText('Micro indisponible. Tu peux écouter le modèle et répéter à voix haute.');
        }
      } finally {
        record.disabled = false;
      }
    };
  }
}
