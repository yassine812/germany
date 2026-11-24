'use strict';

const alphabetPractice = {
  overview:[0,1,2,3,4,5],
  aToG:[0,6,7,0],
  hToM:[8,9,4,8],
  nToQ:[10,11,11,10],
  rToU:[12,13,14,12],
  umlauts:[2,16,15,17],
  vowels:[18,19,20,18],
  consonants:[5,21,22,23,24,5],
  review:[25,3,26,17,2,21]
};

const alphabetLessonTopics = [
  'overview','aToG','aToG','hToM','nToQ','rToU','rToU','review','umlauts','umlauts','umlauts',
  'review','vowels','consonants','consonants','consonants','consonants','consonants','consonants','review','review'
];

function alphabetQuestions(l) {
  const match = /^A1\.1-s1-l(\d+)$/.exec(l.id);
  const focus = match ? alphabetLessonTopics[Number(match[1]) - 1] : 'overview';
  return (alphabetPractice[focus] || alphabetPractice.overview)
    .map((index, position) => speechQuestion('alphabet', index, position % 2 ? 'dictation' : 'say'));
}

function startQuiz(id, go = true, topicKey = null) {
  const l = lesson(id);
  const topics = l.topics || [l.topic];
  const saved = progress(id).practicedTopics || {};
  const topic = topics.includes(topicKey) ? topicKey : topics.find(t => !saved[t]) || l.topic;
  const written = (topic === l.topic && l.questions ? l.questions : data.topics[topic].questions)
    .map(question => ({...question, options:question.options ? shuffleOptions(question.options) : null}));
  const listening = audios[topic];
  if (listening) {
    written.push({prompt:listening.question, options:shuffleOptions(listening.options), answer:listening.answer,
      explanation:'Réécoute le dialogue et ouvre la transcription pour retrouver cette information.', audio:topic});
  }
  let questions = written;
  if (speechModels[topic]) {
    if (topic === 'alphabet') {
      questions = alphabetQuestions(l);
    } else {
      questions = [speechQuestion(topic, 0, 'say'), ...written.slice(0, 2), speechQuestion(topic, 1, 'dictation'),
        ...written.slice(2), speechQuestion(topic, 1, 'say')];
    }
  }
  quiz = {lesson:id, topic, questions, reward:0, index:0, correct:0, spoken:0, selected:null, checked:false, done:false};
  if (go) navigate('#lesson/' + id + '/practice');
}

function quizHTML() {
  const q = quiz;
  if (q.done) return quizResult();
  const item = q.questions[q.index];
  const say = item.kind === 'say';
  const dictation = item.kind === 'dictation';
  const label = say ? 'Prononciation' : dictation ? 'Dictée' : item.audio ? 'Compréhension orale' : item.options ? 'Choix de réponse' : 'Écriture';
  return `<div class="quiz-top"><progress value="${q.index}" max="${q.questions.length}" aria-label="Progression dans cet atelier"></progress><span>${q.index + 1} / ${q.questions.length}</span></div>
    <section class="question-card ${say || dictation ? 'oral-question' : ''}"><div class="eyebrow">${label}</div><h2 id="practice-question" tabindex="-1">${esc(item.prompt)}</h2>
    ${item.kind ? pronunciationHTML(item) : ''}
    ${item.audio ? audioHTML(item.audio, true) : ''}
    ${say ? '' : responseHTML(q, item)}
    </section>
    <div class="quiz-actions">
      ${say ? '<button class="primary" data-finish-speaking disabled>J’ai répété</button>' :
        `<button class="primary" data-action="${q.checked ? 'next-question' : 'check-answer'}">${q.checked ? 'Continuer' : 'Vérifier'}</button>`}
    </div>`;
}

function responseHTML(q, item) {
  const response = item.options ?
    `<div class="options">${item.options.map((value, index) => `<button class="option ${q.selected === value ? 'selected' : ''} ${q.checked && value === item.answer ? 'correct' : ''} ${q.checked && value === q.selected && value !== item.answer ? 'wrong' : ''}" data-option="${index}" ${q.checked ? 'disabled' : ''}><span class="key">${index + 1}</span><span lang="de">${esc(value)}</span></button>`).join('')}</div>` :
    `<input class="type-answer" id="type-answer" autocomplete="off" aria-label="Ta réponse en allemand" lang="de" placeholder="${item.model?.alphabetAnswer ? 'Entre les lettres…' : 'Écris en allemand…'}" value="${esc(q.selected || '')}" ${q.checked ? 'disabled' : ''}>
      <div class="umlauts">${['ä', 'ö', 'ü', 'ß'].map(letter => `<button data-letter="${letter}" ${q.checked ? 'disabled' : ''}>${letter}</button>`).join('')}</div>`;
  const correction = item.model?.text || item.answer;
  return response + (q.checked ? `<div class="feedback ${q.selectedCorrect ? '' : 'wrong'}" role="status">
    <strong>${q.selectedCorrect ? 'Gut gemacht !' : 'La réponse attendue'}</strong>
    ${q.selectedCorrect ? '' : ` <span lang="de">${esc(correction)}</span>`}
    <p>${esc(item.explanation)}</p></div>` : '');
}

function quizScore() {
  const graded = quiz.questions.length - quiz.questions.filter(item => item.kind === 'say').length;
  return {graded, passed:quiz.correct >= Math.ceil(graded * .8)};
}

function quizResult() {
  const q = quiz;
  const p = progress(q.lesson);
  const l = lesson(q.lesson);
  const next = (l.topics || [l.topic]).find(t => !p.practicedTopics?.[t]);
  const {graded, passed} = quizScore();
  const nextButton = passed && next ? `<button class="primary" data-topic="${next}">Notion suivante</button>` :
    passed && canFinishLesson(l,p) ? `<button class="primary" data-complete="${q.lesson}">${p.completed ? 'Mon parcours' : 'Valider ma leçon'}</button>` :
      `<button class="primary" data-start="${q.lesson}">Revenir au cours</button>`;
  return `<div class="card success">
    <img src="assets/fox.svg" alt=""><h2>${passed ? 'Wunderbar !' : 'Encore un tour ?'}</h2>
    <p>${q.correct} / ${graded} réponses correctes${q.spoken ? ' · ' + q.spoken + ' exercices de prononciation' : ''}.</p>
    <p>${passed ? 'Notion validée.' : 'Il faut 80 % de bonnes réponses pour valider cette notion.'}</p>
    ${q.reward ? '<div class="reward">+ 20 XP</div>' : ''}
    <div class="action-row"><button class="secondary" data-action="retry-quiz">Recommencer</button>${nextButton}</div>
  </div>`;
}

function notionTabs(l) {
  return `<div class="notion-tabs filters">${(l.topics || [l.topic]).map(t => `<button class="chip ${quiz?.topic === t ? 'active' : ''}" data-topic="${t}">${progress(l.id).practicedTopics?.[t] ? '✓ ' : ''}${esc(data.topics[t].title)}</button>`).join('')}</div>`;
}

function renderQuiz(focusTarget) {
  disposeSpeech();
  const area = $('#quiz-area');
  $$('audio', area).forEach(audio => audio.pause());
  area.innerHTML = quizHTML();
  const tabs = $('.notion-tabs');
  if (tabs) tabs.outerHTML = notionTabs(lesson(quiz.lesson));
  bindAudios();
  bindPronunciation();
  $(focusTarget || '#practice-question')?.focus({preventScroll:true});
}

function checkAnswer() {
  if (!quiz || quiz.checked || quiz.done) return;
  const item = quiz.questions[quiz.index];
  if (item.kind === 'say') return;
  if (!item.options) quiz.selected = $('#type-answer').value.trim();
  if (!quiz.selected) {
    toast('Choisis ou écris une réponse pour continuer.');
    return;
  }
  quiz.selectedCorrect = item.kind === 'dictation' ? matchesSpeechAnswer(item, quiz.selected) :
    normalize(quiz.selected) === normalize(item.answer);
  if (quiz.selectedCorrect) quiz.correct++;
  quiz.checked = true;
  renderQuiz('[data-action="next-question"]');
}

function nextQuestion() {
  quiz.index++;
  quiz.selected = null;
  quiz.checked = false;
  if (quiz.index >= quiz.questions.length) {
    quiz.done = true;
    const l = lesson(quiz.lesson);
    const saved = progress(quiz.lesson);
    const {graded, passed} = quizScore();
    saved.score = Math.max(saved.score || 0, quiz.correct / graded);
    if (passed) {
      saved.practicedTopics ||= {};
      if (!saved.practicedTopics[quiz.topic]) {
        state.xp += 20;
        saved.practicedTopics[quiz.topic] = true;
        quiz.reward = 20;
      }
      saved.practice = (l.topics || [l.topic]).every(topic => saved.practicedTopics[topic]);
      state.reviews[quiz.topic] = today();
    }
    save();
    $('#xp-stat').textContent = state.xp + ' XP';
  }
  renderQuiz();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-finish-speaking]');
  if (!button || button.disabled || quiz?.questions[quiz.index]?.kind !== 'say') return;
  quiz.spoken++;
  nextQuestion();
});
