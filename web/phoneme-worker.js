'use strict';

const runtime = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
const modelOrigin = 'https://huggingface.co/anyspeech/zipa-small-crctc-300k/resolve/2f458a4dd4102d49d2c7e54d9ccf69c660866256/';
const modelSize = 70677672;
const fftSize = 512;
const windowSize = 400;
const windowStep = 160;
const sampleRate = 16000;
const bands = 80;
const ignoredSymbols = new Set(['<blk>', '<sos/eos>', '<unk>', '▁', 'ʔ', ...'ʰʲʷʼː˞ˠˤ̴̥̩̪̺̃̚']);
const windowWeights = Float64Array.from({length:windowSize}, (_, index) =>
  (.5 - .5 * Math.cos(2 * Math.PI * index / (windowSize - 1))) ** .85);
const mel = hz => 1127 * Math.log1p(hz / 700);
const lowerMel = mel(20);
const melStep = (mel(8000) - lowerMel) / (bands + 1);
const melFilters = Array.from({length:bands}, (_, band) => {
  const center = lowerMel + (band + 1) * melStep;
  return Array.from({length:fftSize / 2}, (_, index) => [
    index, 1 - Math.abs(mel(index * sampleRate / fftSize) - center) / melStep
  ]).filter(([, weight]) => weight > 0);
});
const reverseIndex = Array.from({length:fftSize}, (_, index) =>
  parseInt(index.toString(2).padStart(9, '0').split('').reverse().join(''), 2));

function frameSample(samples, index) {
  while (index < 0 || index >= samples.length) {
    index = index < 0 ? -1 - index : 2 * samples.length - 1 - index;
  }
  return samples[index];
}

function fft(real, imaginary) {
  for (let size = 2; size <= fftSize; size *= 2) {
    const half = size / 2;
    for (let offset = 0; offset < half; offset++) {
      const angle = -2 * Math.PI * offset / size;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      for (let first = offset; first < fftSize; first += size) {
        const second = first + half;
        const r = real[second] * cosine - imaginary[second] * sine;
        const i = real[second] * sine + imaginary[second] * cosine;
        real[second] = real[first] - r;
        imaginary[second] = imaginary[first] - i;
        real[first] += r;
        imaginary[first] += i;
      }
    }
  }
}

// Kaldi-style 25 ms frames, 10 ms shift, reflecting edges, log mel energies.
function filterbank(samples, scale) {
  const rows = Math.floor((samples.length + windowStep / 2) / windowStep);
  const values = new Float32Array(rows * bands);
  const frame = new Float64Array(windowSize);
  const real = new Float64Array(fftSize);
  const imaginary = new Float64Array(fftSize);
  const power = new Float64Array(fftSize / 2);
  for (let row = 0; row < rows; row++) {
    const start = row * windowStep + (windowStep - windowSize) / 2;
    let mean = 0;
    for (let i = 0; i < windowSize; i++) {
      frame[i] = frameSample(samples, start + i) * scale;
      mean += frame[i];
    }
    mean /= windowSize;
    real.fill(0);
    imaginary.fill(0);
    for (let i = 0; i < windowSize; i++) {
      const previous = frame[Math.max(0, i - 1)];
      real[reverseIndex[i]] = (frame[i] - mean - .97 * (previous - mean)) * windowWeights[i];
    }
    fft(real, imaginary);
    for (let i = 0; i < power.length; i++) power[i] = real[i] ** 2 + imaginary[i] ** 2;
    for (let band = 0; band < bands; band++) {
      let energy = 0;
      for (const [index, weight] of melFilters[band]) energy += power[index] * weight;
      values[row * bands + band] = Math.log(Math.max(1.1920928955078125e-7, energy));
    }
  }
  return values;
}

let engine;
async function openEngine(reportProgress) {
  if (!self.ort) importScripts(runtime + 'ort.wasm.min.js');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = runtime;
  const url = modelOrigin + 'model.int8.onnx';
  const cache = await self.caches?.open('deutschweg-phonemes-v1').catch(() => null);
  const cached = await cache?.match(url).catch(() => null);
  const response = cached || await fetch(url, {credentials:'omit'});
  if (!response.ok) throw Error('model');
  const bytes = new Uint8Array(modelSize);
  const reader = response.body.getReader();
  let position = 0;
  let progress = -1;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    bytes.set(value, position);
    position += value.length;
    const percent = Math.floor(position / modelSize * 100);
    if (!cached && percent >= progress + 3) {
      reportProgress(percent);
      progress = percent;
    }
  }
  if (position !== modelSize) throw Error('model length');
  if (cache && !cached) cache.put(url, new Response(bytes)).catch(() => {});
  const tokensResult = await fetch(modelOrigin + 'tokens.txt', {credentials:'omit'});
  if (!tokensResult.ok) throw Error('vocabulary');
  const vocabulary = (await tokensResult.text()).trim().split(/\r?\n/).map(line => line.split(' ')[0]);
  const session = await ort.InferenceSession.create(bytes, {executionProviders:['wasm']});
  return {session, vocabulary};
}

function decode(output, vocabulary) {
  const [, frames, symbols] = output.dims;
  const phones = [];
  let previous = -1;
  for (let frame = 0; frame < frames; frame++) {
    const start = frame * symbols;
    let token = 0;
    for (let id = 1; id < symbols; id++) {
      if (output.data[start + id] > output.data[start + token]) token = id;
    }
    const probability = Math.exp(output.data[start + token]);
    const symbol = vocabulary[token];
    if (token !== previous) {
      phones.push({symbol, probability});
    } else {
      phones.at(-1).probability = Math.max(phones.at(-1).probability, probability);
    }
    previous = token;
  }
  return phones.filter(phone => !ignoredSymbols.has(phone.symbol) && phone.probability >= .25);
}

self.onmessage = async ({data:{samples, id}}) => {
  try {
    let peak = 0;
    let squares = 0;
    for (const value of samples) {
      peak = Math.max(peak, Math.abs(value));
      squares += value * value;
    }
    if (samples.length < 3200 || peak < .015 || Math.sqrt(squares / samples.length) < .0015) {
      self.postMessage({id, phones:[]});
      return;
    }
    engine ||= openEngine(percent => self.postMessage({id, percent})).catch(error => {
      engine = null;
      throw error;
    });
    const {session, vocabulary} = await engine;
    const values = filterbank(samples, .9 / peak);
    const frames = values.length / bands;
    const outputs = await session.run({
      x:new ort.Tensor('float32', values, [1, frames, bands]),
      x_lens:new ort.Tensor('int64', BigInt64Array.of(BigInt(frames)), [1])
    });
    self.postMessage({id, phones:decode(outputs.log_probs, vocabulary)});
  } catch {
    self.postMessage({id, failed:true});
  }
};
