'use strict';

const modelLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß';
const letterPhones = [
  'a','be','tse','de','e','ɛf','ge','ha','i','jɔt',
  'ka','ɛl','ɛm','ɛn','o','pe','ku','ɛr','ɛs','te',
  'u','faʊ','ve','ɪks','ʏpsilɔn','tsɛt','ɛ','ø','y','ɛstsɛt'
];
const soundVariants = {'ɡ':'g', 'ʀ':'r', 'ʁ':'r', 'ɾ':'r', 'ɹ':'r', 'χ':'x'};
const soundKey = symbol => soundVariants[symbol] || symbol;
let phoneReferences;
let phoneWorker;
let phoneTaskId = 0;
const pendingPhones = new Map();

function phoneRequest(samples, progress) {
  if (!phoneWorker) {
    phoneWorker = new Worker('phoneme-worker.js?v=' + (window.DEUTSCHWEG_BUILD || '1'));
    phoneWorker.onmessage = ({data}) => {
      const request = pendingPhones.get(data.id);
      if (!request) return;
      if (data.percent !== undefined) {
        request.progress(data.percent);
      } else {
        pendingPhones.delete(data.id);
        data.failed ? request.reject(Error('model')) : request.resolve(data.phones);
      }
    };
    phoneWorker.onerror = () => {
      for (const request of pendingPhones.values()) request.reject(Error('model worker'));
      pendingPhones.clear();
      phoneWorker.terminate();
      phoneWorker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++phoneTaskId;
    pendingPhones.set(id, {resolve,reject,progress});
    phoneWorker.postMessage({id,samples}, [samples.buffer]);
  });
}

function getPhoneReferences() {
  phoneReferences ||= fetch('phonemes.json?v=' + (window.DEUTSCHWEG_BUILD || '1')).then(response => {
    if (!response.ok) throw Error('references');
    return response.json();
  }).catch(error => {
    phoneReferences = null;
    throw error;
  });
  return phoneReferences;
}

async function decodeVoice(bytes) {
  const context = new OfflineAudioContext(1, 1, 16000);
  return context.decodeAudioData(bytes);
}

function equivalentPhones(a, b) {
  return soundKey(a.symbol) === soundKey(b.symbol) || a.accepts?.includes(b.symbol);
}

// Align expected and recognized IPA. Leave a slot for a sound that was not detected.
function alignSounds(reference, attempt) {
  const n = reference.length;
  const m = attempt.length;
  const costs = Array.from({length:n + 1}, () => new Float32Array(m + 1));
  for (let i = 0; i <= n; i++) costs[i][0] = i;
  for (let j = 0; j <= m; j++) costs[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const replace = equivalentPhones(reference[i-1], attempt[j-1]) ? 0 : 1;
      costs[i][j] = Math.min(costs[i-1][j] + 1, costs[i][j-1] + 1, costs[i-1][j-1] + replace);
    }
  }
  const aligned = Array(n).fill(null);
  let i = n, j = m;
  while (i && j) {
    const replace = equivalentPhones(reference[i-1], attempt[j-1]) ? 0 : 1;
    if (costs[i][j] === costs[i-1][j-1] + replace) {
      aligned[--i] = attempt[--j];
    } else if (costs[i][j] === costs[i-1][j] + 1) {
      i--;
    } else {
      j--;
    }
  }
  return aligned;
}

function referenceSounds(item, refs, voice) {
  const letters = item.model.alphabetAnswer ? [...item.model.alphabetAnswer] : [];
  if (letters.length) {
    return letters.flatMap((value,index) => {
      const letter = value === 'ß' ? value : value.toUpperCase();
      const slot = modelLetters.indexOf(letter);
      return [...letterPhones[slot]].map(symbol => ({
        symbol, letter, index, clip:'letters/' + slot, probability:1,
        accepts:symbol === 'e' && 'BCDGPTW'.includes(letter) ? 'iɪɛ' :
          symbol === 'ɪ' ? 'i' : symbol === 'ʊ' ? 'w' : symbol === 'ø' ? 'œ' : '',
        optional:symbol === 't' && letter === 'C'
      }));
    });
  }
  return (refs[item.sample]?.[voice] || []).map(([symbol,start,end,probability]) =>
    ({symbol,start,end,probability,clip:item.sample,index:0}));
}

function comparePhones(item, refs, heard, voice) {
  const primary = referenceSounds(item, refs, voice);
  if (!primary.length || !heard.length) return {unclear:true, issues:[]};
  const otherVoice = referenceSounds(item, refs, voice === 'female' ? 'male' : 'female');
  const alternate = alignSounds(primary, otherVoice);
  const attempt = alignSounds(primary, heard);
  const hits = attempt.filter((entry,index) => entry && equivalentPhones(primary[index], entry)).length;
  const distinct = new Set();
  const issues = [];
  for (const [index, wanted] of primary.entries()) {
    const found = attempt[index];
    const other = alternate[index];
    const agreed = other && other.index === wanted.index && equivalentPhones(wanted, other);
    if (!agreed || wanted.probability < .6 || other.probability < .55 || (found && equivalentPhones(wanted, found))) continue;
    if (found && found.probability < .57) continue;
    if (!found && wanted.optional) continue;
    if (!found && hits < Math.max(1, primary.length * .4)) continue;
    const group = wanted.letter ? wanted.index : wanted.symbol + ':' + index;
    if (distinct.has(group)) continue;
    distinct.add(group);
    issues.push({...wanted, heard:found?.symbol});
  }
  return {issues:issues.slice(0,3), unclear:hits < Math.max(1, primary.length * .52) && !issues.length};
}

function waveSegment(buffer, start, end) {
  const rate = buffer.sampleRate;
  const first = Math.max(0, Math.floor((start - .08) * rate));
  const last = Math.min(buffer.length, Math.ceil((end + .10) * rate));
  const samples = buffer.getChannelData(0).subarray(first, last);
  const wave = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(wave);
  for (const [offset, value] of [[0,'RIFF'],[8,'WAVEfmt '],[36,'data']]) {
    [...value].forEach((character,i) => view.setUint8(offset + i, character.charCodeAt(0)));
  }
  for (const [offset,value] of [[4,wave.byteLength - 8],[16,16],[24,rate],[28,rate * 2],[40,samples.length * 2]]) {
    view.setUint32(offset, value, true);
  }
  for (const [offset,value] of [[20,1],[22,1],[32,2],[34,16]]) view.setUint16(offset, value, true);
  for (let i = 0; i < samples.length; i++) {
    const fade = Math.min(1, i / 130, (samples.length - 1 - i) / 130);
    view.setInt16(44 + 2 * i, Math.max(-1, Math.min(1, samples[i])) * fade * 32767, true);
  }
  return new Blob([wave], {type:'audio/wav'});
}

function bindSoundFeedback(card, item, voice, getTake, retry) {
  const analyze = $('[data-analyze-sounds]', card);
  const feedback = $('[data-sound-feedback]', card);
  const replay = $('[data-target-audio]', card);
  let url = null;
  let generation = 0;
  const invalidate = () => {
    generation++;
    analyze.disabled = false;
    feedback.replaceChildren();
    replay.pause();
    replay.removeAttribute('src');
    if (url) URL.revokeObjectURL(url);
    url = null;
  };
  const valid = token => token === generation && card.isConnected;
  async function hear(issue, selected, button, token) {
    try {
      const path = pronunciationClip(issue.clip, selected);
      let source = path;
      if (!issue.letter) {
        const response = await fetch(path);
        if (!response.ok) throw Error('sound');
        const buffer = await decodeVoice(await response.arrayBuffer());
        if (!valid(token)) return;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(waveSegment(buffer, issue.start, issue.end));
        source = url;
      }
      if (!valid(token)) return;
      replay.src = source;
      replay.preservesPitch = true;
      replay.playbackRate = .70;
      await replay.play();
    } catch {
      if (valid(token)) button.textContent = 'Réessayer l’écoute lente';
    }
  }
  analyze.onclick = async () => {
    const blob = getTake();
    if (!blob) return;
    const token = ++generation;
    const selected = voice.value;
    analyze.disabled = true;
    stopOtherMedia(null);
    feedback.textContent = 'Analyse de ta prise…';
    try {
      const recording = await decodeVoice(await blob.arrayBuffer());
      if (!valid(token)) return;
      const progress = percent => {
        if (valid(token)) feedback.textContent = percent < 100 ? 'Chargement du modèle · ' + percent + ' %' : 'Analyse de ta prise…';
      };
      const [refs, heard] = await Promise.all([getPhoneReferences(), phoneRequest(recording.getChannelData(0), progress)]);
      if (!valid(token)) return;
      const {issues, unclear} = comparePhones(item, refs, heard, selected);
      if (!issues.length) {
        feedback.textContent = unclear ? 'J’ai distingué trop peu de sons. Refais une prise en parlant près du micro.' : 'Aucun écart net repéré sur cette prise.';
        return;
      }
      feedback.innerHTML = '<strong>À retravailler</strong><ul>' + issues.map((issue,index) => `<li>
        <span><strong>${esc(issue.letter ? 'Lettre ' + issue.letter : 'Son /' + issue.symbol + '/')}</strong>
        ${issue.heard ? '<small>Entendu par le modèle : /' + esc(issue.heard) + '/</small>' : '<small>Son peu distinct dans la prise</small>'}</span>
        <button class="secondary" data-review-phoneme="${index}">${icon('volume')} Écouter lentement</button></li>`).join('') +
        '</ul><button class="secondary" data-retry-sounds>Réessayer au micro</button>';
      $$('[data-review-phoneme]', feedback).forEach((button,index) => {
        button.onclick = () => hear(issues[index], selected, button, token);
      });
      $('[data-retry-sounds]', feedback).onclick = retry;
    } catch {
      if (valid(token)) feedback.textContent = 'Analyse indisponible. Réessaie le chargement ou compare ta prise au modèle.';
    } finally {
      if (valid(token)) analyze.disabled = false;
    }
  };
  return invalidate;
}
