'use strict';
let solutionData={answers:{}},pdfWordLayers=new Map(),pdfLookupSequence=0,pdfWordResult=null,pdfSyncLesson=null,pdfHeldCue=null,lastGuidedField=null;

function activePaper(){return readerState?.pages?.[readerState.index]||null;}
function classroomLessonHTML(l){
  if(!l)return '<p class="empty">Cette leçon n’existe pas.</p>';
  const group = reviewedGroup(l);
  if(route.tab==='practice'){
    if(!quiz||quiz.lesson!==l.id)startQuiz(l.id,false);
    return `<div class="practice-heading"><button class="back" data-tab="watch">${icon('back')} Cours et PDF</button><span>Niveau ${l.level}</span></div>
      <div class="quiz-shell"><header class="practice-title"><span class="practice-symbol">${icon('mic')}</span><div><h1>Atelier de pratique</h1><p>${esc(group.title)}</p></div></header>
      ${(l.topics||[l.topic]).length > 1 ? notionTabs(l) : ''}<div id="quiz-area">${quizHTML()}</div></div>`;
  }
  if (pdfSyncLesson !== l.id) {
    pdfSyncLesson = l.id;
    pdfHeldCue = null;
    appliedPDFCue = null;
  }
  const p = progress(l.id);
  const paper = readerHTML(l);
  const split = percentSplit(state.studySplit);
  return `<div class="classroom-heading">
    <button class="icon-btn" data-nav="path" aria-label="Retour à la carte">${icon('back')}</button>
    <div><small>Niveau ${l.level} · Leçon ${group.number}</small><h1>${esc(group.title)}</h1></div>
    <button class="secondary practice-entry" data-tab="practice">${icon('mic')} Pratiquer à l’oral</button>
    <button class="primary" data-complete="${l.id}" data-course-completion ${canFinishLesson(l)?'':'hidden'}>${groupDone(group) ? 'Mon parcours' : 'Terminer la leçon'}</button>
  </div>
  <div class="classroom-layout split-classroom" style="--study-split:${split}%">
    <section class="classroom-document" id="study-document" aria-label="Le PDF de ton cours">${paper}</section>
    <div class="study-divider" role="separator" aria-label="Ajuster la largeur du PDF" aria-orientation="vertical" aria-controls="study-document" aria-valuemin="35" aria-valuemax="65" aria-valuenow="${split}" tabindex="0"></div>
    <aside class="classroom-coach">
      <section class="classroom-video" aria-label="Ton enregistrement">
        <h2 class="video-label">${icon(l.kind==='audio'?'headphones':'play')} Enregistrement du cours</h2>
        ${mediaHTML(l)}
        ${passageListHTML(l)}
        <div class="classroom-video-actions">
          <button class="link-button ${p.watch?'checked':''}" data-study-mark="watch">${icon('check')}${p.watch?'Écoute terminée':'Valider l’écoute'}</button>
          <button class="link-button" data-jump-exercises ${lessonExerciseIndex()<0?'hidden':''}>${icon('book')} ${pdfTasks(activePaper()).length?'Exercices de la page':'Voir les exercices'}</button>
          <button class="link-button" data-open-lesson-notes>${icon('book')} Mes notes</button>
        </div>
      </section>
      <section class="classroom-answers" id="classroom-answers" tabindex="-1" aria-label="Réponses et correction" ${pdfTasks(activePaper()).length?'':'hidden'}>${exercisePanelHTML(l)}</section>
    </aside>
  </div>`;
}

function classroomBookHTML(bid){
  const b=book(bid);if(!b)return '<p class="empty">Livre introuvable.</p>';
  const paper=readerHTML(null,bid,Number(route.tab)||1);
  return `<div class="classroom-heading"><a class="icon-btn" href="#library" aria-label="Retour à la bibliothèque">${icon('back')}</a><div><small>${b.level} · Document de référence</small><h1 title="${esc(b.title)}">${esc(b.title)}</h1></div><button class="secondary" data-toggle-exercises data-book-answers-toggle ${pdfTasks(activePaper()).length?'':'hidden'}>${icon('book')} Répondre</button></div><div class="classroom-layout book-classroom"><section class="classroom-document">${paper}</section><aside class="classroom-coach"><section class="classroom-answers book-answers" id="classroom-answers" ${pdfTasks(activePaper()).length?'':'hidden'}>${exercisePanelHTML(null)}</section></aside></div>`;
}

function fullPDFPageHTML(b,p){
  const linked = route.page === 'book' ? findPageLesson(b.id,p.page) : null;
  const linkedButton = linked ? `<a class="pdf-course-link" href="${lessonPageURL(linked,b.id,p.page)}">${icon('play')} Étudier cette page avec le cours</a>` : '';

  return `<div class="pdf-tools">${linkedButton || '<span>Survole un mot pour le traduire ou l’écouter.</span>'}<form id="pdf-word-search"><input name="word" maxlength="64" aria-label="Un mot à traduire" placeholder="Traduire un mot…"><button aria-label="Traduire ce mot">${icon('search')}</button></form></div><div class="pdf-stage ${paperView()==='page'?'fit-paper':''}" id="pdf-stage"><div class="pdf-paper" id="pdf-paper" data-book="${b.id}" data-page="${p.page}" style="--pdf-zoom:${readerZoom()}"><img class="pdf-page-image" src="${p.image}" alt="${esc(b.title)}, page ${p.printed||p.page}" draggable="false"><div class="pdf-text-layer" id="pdf-text-layer" lang="de" aria-label="Texte sélectionnable de la page"></div><div class="pdf-exercise-focus" id="pdf-exercise-focus" hidden></div></div></div>`;
}

function solutionFor(b,t,p=activePaper()){
  const custom=p?solutionData.custom?.[`${b.id}:${p.page}:${t.id}`]:null;if(custom)return custom;
  if(!t.lesson)return null;
  const section=b.kind==='coursebook'?'Cours':t.section;
  return solutionData.answers?.[`${b.id}:${t.lesson}:${section}:${t.number}`]||null;
}
function answerBase(p,t){return `${p.book}:${p.page}:ex${t.id}`;}
function answerField(key,label,value,multiline=false){
  return `<label class="guided-answer-label">${esc(label)}${multiline?`<textarea data-guided-answer="${esc(key)}" lang="de" spellcheck="false" placeholder="Ta réponse en allemand…">${esc(value||'')}</textarea>`:`<input data-guided-answer="${esc(key)}" value="${esc(value||'')}" lang="de" spellcheck="false" autocomplete="off" placeholder="Ta réponse…">`}</label>`;
}
function choiceAnswerField(key,label,value,choices) {
  return `<label class="guided-answer-label">${esc(label)}
    <select data-guided-answer="${esc(key)}"><option value="">Choisir</option>${choices.map(option =>
      `<option value="${esc(option)}" ${normalizedAnswer(value)===normalizedAnswer(option)?'selected':''}>${esc(option)}</option>`).join('')}</select>
    </label>`;
}

function taskChoices(part) {
  if (part.open) return null;
  const answer = normalizedAnswer(part.expected);
  if (['richtig','falsch'].includes(answer)) return ['Richtig','Falsch'];
  if (['ja','nein'].includes(answer)) return ['Ja','Nein'];
  return null;
}

function taskResponse(t) {
  const label = t.label || '';
  const writing = /verfass|schreiben sie (?:über|eine?n? (?:e-mail|brief|text|bericht|einladung))|schriftlich beantworten/iu.test(label);
  if (writing) return 'writing';
  if (/sprechen|aussprache/iu.test(t.section || '') || /^sprechen sie|^spielen sie|^sprechen sie nach|^lesen sie laut/iu.test(label)) return 'oral';
  return 'short';
}

function printedTaskHTML(b,p,l,t,index) {
  const correction = solutionFor(b,t);
  const key = answerBase(p,t);
  const pack = data.bookAudio?.[b.id]?.tracks || [];
  const tracks = (t.tracks || []).map(id => pack.find(audio => audio.id===id)).filter(track => track?.src.startsWith('assets/book-audio/'));
  const mode = taskResponse(t);
  const oral = !correction && mode==='oral';
  let fields = '';
  if (correction) {
    fields = correction.parts.map((part,i) => {
      const fieldKey = key + ':part' + i;
      const choices = taskChoices(part);
      return choices ? choiceAnswerField(fieldKey,part.label,state.answers[fieldKey],choices) :
        answerField(fieldKey,part.label,state.answers[fieldKey],part.open || part.expected.length>90);
    }).join('');
  } else if (!oral) {
    fields = answerField(key, mode==='writing' ? 'Rédige le texte demandé' : 'Réponse à cet exercice',state.answers[key],mode==='writing');
  }
  const action = oral ? (l ? `<button class="secondary" data-tab="practice">${icon('mic')} S’entraîner à l’oral</button>` : '') :
    `<button class="primary full" data-check-task="${t.id}">${correction?'Vérifier mes réponses':'Relire ma réponse'}</button>`;
  return `<details class="guided-task" data-guided-task="${t.id}" ${index===0?'open':''}>
    <summary><span class="exercise-number">${t.number}</span><span>${esc(t.label||'Exercice '+t.number)}<small>${esc(t.section)}</small></span>
    ${oral?'<span class="task-correction-label">Oral</span>':''}</summary>
    <div class="guided-task-body">
      ${tracks.map(exerciseAudioHTML).join('')}${correction?.instruction?`<p class="exercise-prompt">${esc(correction.instruction)}</p>`:''}
      ${fields}${fields?'<div class="answer-save-message" data-guided-status></div>':''}
      <button class="link-button focus-task-button" data-focus-task="${t.id}">${icon('book')} Voir dans le PDF</button>
      ${action}<div class="task-feedback" data-task-feedback="${t.id}" aria-live="polite"></div>
      ${correction?`<details class="answer-reference"><summary>Voir le corrigé</summary>
        <dl>${correction.parts.map(part=>`<dt>${esc(part.label)}</dt><dd lang="de">${esc(part.open?'Réponse personnelle':part.expected)}</dd>`).join('')}</dl>
        <a href="${esc(correction.source)}" target="_blank" rel="noopener">${esc(correction.sourceName||'Source du corrigé · Hueber')}</a></details>`:''}
      ${state.answers[key]&&correction?`<details class="old-answer"><summary>Ma réponse précédente</summary><p>${esc(state.answers[key])}</p></details>`:''}
    </div></details>`;
}

function pdfTasks(p) {
  return data.exercisePages?.books?.[p?.book]?.[p?.page]?.tasks || [];
}

function lessonExerciseIndex() {
  const pages = readerState?.pages || [];
  const start = readerState?.index || 0;
  const next = pages.findIndex((page,i) => i>=start && pdfTasks(page).length);
  return next>=0 ? next : pages.findIndex(page => pdfTasks(page).length);
}

function lessonHasExercises(l) {
  return getPages(l).some(page => pdfTasks(page).length);
}

function canFinishLesson(l) {
  const group = reviewedGroup(l);
  if (groupDone(group)) return true;
  const saved = group.parts.map(clip => state.lessons[clip.id]);
  if (!saved.every(p => p?.watch || p?.completed) || !saved.some(p => p?.practice || p?.completed)) return false;
  return saved.some(p => p?.read) || !group.parts.some(lessonHasExercises);
}

function updateCourseFinish() {
  const button = $('[data-course-completion]');
  if (button && route.page==='lesson') button.hidden = !canFinishLesson(lesson(route.id));
}

function exercisePanelHTML(l) {
  const p = activePaper();
  const printed = pdfTasks(p);
  if (!printed.length) return '';
  const b = book(p.book);
  const pageFinish = route.page === 'assessment' ? assessmentFinishPageHTML() :
    l ? `<button class="study-check ${progress(l.id).read?'checked':''}" data-study-mark="read">${icon('check')}
      ${progress(l.id).read ? 'Exercices terminés' : 'Terminer les exercices'}</button>` :
    '<button class="study-check" data-finish-page>' + icon('check') + ' Valider cette page</button>';
  return `<div class="coach-heading"><button class="answers-close" data-toggle-exercises aria-label="Fermer les réponses">×</button>
    <h2>Exercices de la page</h2><span>${p.printed?'p. '+p.printed:'PDF '+p.page}</span></div>
    <div class="page-task-list">${printed.map((task,i) => printedTaskHTML(b,p,l,task,i)).join('')}</div>${pageFinish}`;
}

function normalizedAnswer(text){return String(text||'').normalize('NFC').toLocaleLowerCase('de-DE').replace(/[’‘`]/g,"'").replace(/[.,;:!?–—_()\[\]«»"']/g,' ').replace(/\s+/g,' ').trim();}
function gradeClosedAnswer(answer,part){
  if(part.open)return {status:'open',message:'Réponse personnelle : consulte les conseils de langue.'};
  if(!answer.trim())return {status:'empty',message:'Complète cette réponse.'};
  const expected=part.expected.replace(/\((?:von oben|von links|in der Reihenfolge)[^)]*\)/gi,'').trim();
  const accepted=[expected,...(expected.includes('/')?expected.split('/'):[])].filter(x=>x.trim());
  const matched=accepted.find(value=>normalizedAnswer(value)===normalizedAnswer(answer));
  if(matched){
    const targetWords=matched.match(/[\p{L}]+/gu)||[],answerWords=answer.match(/[\p{L}]+/gu)||[];
    if(targetWords.some((w,i)=>w.length>1&&/^[A-ZÄÖÜ]/u.test(w)&&/^[a-zäöü]/u.test(answerWords[i]||'')))return {status:'review',message:'La réponse est juste : vérifie les majuscules.',expected:matched.trim()};
    return {status:'correct',message:'Correct ✓'};
  }
  return {status:'review',message:'À revoir',expected:part.expected};
}

function grammarAdvice(text){
  const issues=[];let corrected=text;
  const groups=[
    ['ich','bin',['bist','ist','sind','seid']],['du','bist',['bin','ist','sind','seid']],['er|es','ist',['bin','bist','sind','seid']],['wir','sind',['bin','bist','ist','seid']],['ihr','seid',['bin','bist','ist','sind']],
    ['ich','habe',['hast','hat','haben','habt']],['du','hast',['habe','hat','haben','habt']],['er|es','hat',['habe','hast','haben','habt']],['wir','haben',['habe','hast','hat','habt']],['ihr','habt',['habe','hast','hat','haben']]
  ];
  for(const [subject,right,wrong] of groups){const pattern=new RegExp('\\b('+subject+')\\s+('+wrong.join('|')+')\\b','gi');corrected=corrected.replace(pattern,(whole,pronoun)=>{issues.push({before:whole,after:pronoun+' '+right,message:'Accorde le verbe avec « '+pronoun+' ».'});return pronoun+' '+right;});}
  for(const verb of ['machen','wohnen','kommen','lernen','leben','spielen','arbeiten']){
    const stem=verb.slice(0,-2),forms=[stem+'e',stem+(verb==='arbeiten'?'est':'st'),stem+(verb==='arbeiten'?'et':'t'),verb];
    for(const [subject,right] of [['ich',forms[0]],['du',forms[1]],['er|es',forms[2]],['wir',verb],['ihr',forms[2]]]){
      const wrong=[...new Set(forms)].filter(v=>v!==right),pattern=new RegExp('\\b('+subject+')\\s+('+wrong.join('|')+')\\b','gi');
      corrected=corrected.replace(pattern,(whole,pronoun)=>{issues.push({before:whole,after:pronoun+' '+right,message:'Au présent, vérifie la terminaison de « '+verb+' ».'});return pronoun+' '+right;});
    }
  }
  if(/^[a-zäöüß]/u.test(corrected.trim())){const first=corrected.search(/\S/);issues.push({before:corrected[first],after:corrected[first].toUpperCase(),message:'Une phrase commence par une majuscule.'});corrected=corrected.slice(0,first)+corrected[first].toUpperCase()+corrected.slice(first+1);}
  return {issues,corrected,scope:'Vérification de base : conjugaison des verbes courants et majuscule initiale.'};
}

function grammarHTML(text){const result=grammarAdvice(text);if(!text.trim())return '<p>Écris une phrase pour obtenir des conseils.</p>';return `${result.issues.length?`<strong>${result.issues.length} point${result.issues.length>1?'s':''} à corriger</strong><ul>${result.issues.map(i=>`<li>${esc(i.message)} <del>${esc(i.before)}</del> <strong lang="de">${esc(i.after)}</strong></li>`).join('')}</ul><p lang="de" class="suggested-sentence">${esc(result.corrected)}</p>`:'<p>Aucun point repéré par les règles de base. Compare aussi ta réponse avec la consigne et le corrigé.</p>'}<small>${result.scope} Une rédaction personnelle peut avoir plusieurs formulations correctes.</small>`;}

function checkCurrentTask(id){
  const p=activePaper(),b=book(p.book),task=data.exercisePages?.books?.[b.id]?.[String(p.page)]?.tasks.find(t=>t.id===id);if(!task)return;
  const correction=solutionFor(b,task),key=answerBase(p,task),feedback=document.querySelector(`[data-task-feedback="${id}"]`);
  if(!correction){feedback.innerHTML=grammarHTML(state.answers[key]||'');return;}
  const checked=correction.parts.map((part,i)=>{
    const value=state.answers[key+':part'+i]||'';
    const exactChoice=taskChoices(part)&&normalizedAnswer(value)===normalizedAnswer(part.expected);
    const result=exactChoice?{status:'correct',message:'Correct ✓'}:gradeClosedAnswer(value,part);
    return {...result,part,index:i};
  });
  feedback.innerHTML=checked.map(c=>`<div class="part-result ${c.status}"><strong>${esc(c.part.label)} · ${esc(c.message)}</strong>${c.expected?`<p>Réponse attendue : <span lang="de">${esc(c.expected)}</span></p>`:''}${c.status==='open'?grammarHTML(state.answers[key+':part'+c.index]||''):''}</div>`).join('');
  const closed=checked.filter(c=>c.status!=='open');if(closed.length&&closed.every(c=>c.status==='correct')&&route.page==='lesson'){progress(route.id).read=true;save();updateCourseFinish();}
}

async function loadPDFWords(){
  const paper=document.getElementById('pdf-paper'),layer=document.getElementById('pdf-text-layer');if(!paper||!layer)return;
  const key=paper.dataset.book+':'+paper.dataset.page;layer.dataset.pageKey=key;
  try{
    if(!pdfWordLayers.has(key)){const r=await fetch(`assets/text/${paper.dataset.book}/${paper.dataset.page}.json?v=${window.DEUTSCHWEG_BUILD||'2'}`);if(!r.ok)throw Error();pdfWordLayers.set(key,await r.json());}
    if(!layer.isConnected||layer.dataset.pageKey!==key)return;
    const image=paper.querySelector('img');try{await image.decode()}catch{}const ratio=image.naturalHeight/image.naturalWidth||1.414;
    layer.innerHTML=pdfWordLayers.get(key).words.map(([x,y,w,h,text])=>`<span class="pdf-word" data-pdf-word="${esc(text)}" style="left:${x*100}%;top:${y*100}%;width:${w*100}%;height:${h*100}%;font-size:${h*ratio*80}cqw">${esc(text)} </span>`).join('');
  }catch{layer.innerHTML='';const hint=document.querySelector('.pdf-tools>span');if(hint)hint.textContent='Utilise le champ pour traduire un mot de cette page.';}
}

function focusPDFExercise(id){
  const p=activePaper(),task=data.exercisePages?.books?.[p?.book]?.[String(p?.page)]?.tasks.find(t=>t.id===id),focus=document.getElementById('pdf-exercise-focus'),paper=document.getElementById('pdf-paper'),stage=document.getElementById('pdf-stage');
  if(!task||!focus||!paper||!stage)return;
  focus.hidden=false;focus.style.cssText=`left:${(task.left||0)*100}%;top:${task.top*100}%;width:${((task.right??1)-(task.left??0))*100}%;height:${(task.bottom-task.top)*100}%`;
  stage.scrollTo({top:Math.max(0,task.top*paper.clientHeight-30),behavior:'smooth'});
}
function focusCourseRegion(cue,manual=false) {
  const paper = document.getElementById('pdf-paper');
  const stage = document.getElementById('pdf-stage');
  if (!paper || !stage) return;
  const image = paper.querySelector('img');
  const focus = () => {
    if (!paper.isConnected || (!manual && (appliedPDFCue !== cue || pdfHeldCue !== null))) return;
    if (cue.exercise) {
      focusPDFExercise(cue.exercise);
      const task = document.querySelector(`[data-guided-task="${cue.exercise}"]`);
      if (task && !task.open) task.open = true;
      return;
    }
    const [top, bottom] = cue.region;
    const highlight = document.getElementById('pdf-exercise-focus');
    if (highlight) {
      highlight.hidden = false;
      highlight.style.cssText = `left:1%;width:98%;top:${top*100}%;height:${(bottom-top)*100}%`;
    }
    stage.scrollTo({top:Math.max(0, top * paper.clientHeight - 14), behavior:'smooth'});
  };
  if (image.complete) focus();
  else image.addEventListener('load', focus, {once:true});
}

function percentSplit(value) {
  return Number.isFinite(value) ? Math.round(Math.min(65, Math.max(35, value))) : 55;
}

function bindStudyDivider() {
  const divider = $('.study-divider');
  if (!divider) return;
  const layout = divider.parentElement;
  const resize = value => {
    state.studySplit = percentSplit(value);
    layout.style.setProperty('--study-split', state.studySplit + '%');
    divider.setAttribute('aria-valuenow', state.studySplit);
  };
  divider.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const size = percentSplit(state.studySplit);
    resize(({ArrowLeft:size - 3, ArrowRight:size + 3, Home:35, End:65})[event.key]);
    save();
  });
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    divider.setPointerCapture(event.pointerId);
    divider.classList.add('dragging');
  });
  divider.addEventListener('pointermove', event => {
    if (!divider.hasPointerCapture(event.pointerId)) return;
    const bounds = layout.getBoundingClientRect();
    resize((event.clientX - bounds.left) / bounds.width * 100);
  });
  divider.addEventListener('lostpointercapture', () => {
    divider.classList.remove('dragging');
    save();
  });
  divider.addEventListener('dblclick', () => { resize(percentSplit()); save(); });
}

function bindClassroom(){
  hideWordCard();
  document.body.classList.remove('answers-open');
  document.body.classList.toggle('in-classroom',(route.page==='lesson'&&route.tab!=='practice')||route.page==='book'||(route.page==='assessment'&&route.tab!=='result'));
  appliedPDFCue = null;
  loadPDFWords();bindPaperAspect();bindExerciseAudio();bindStudyDivider();
  if(!document.getElementById('pdf-word-card')){const box=document.createElement('aside');box.id='pdf-word-card';box.className='word-card';box.hidden=true;box.setAttribute('aria-label','Traduction du mot');document.body.append(box);}
}
function afterPDFPageChange() {
  const panel = $('#classroom-answers');
  const l = route.page==='lesson' ? lesson(route.id) : null;
  if (route.page==='assessment') {
    if (panel) panel.innerHTML = assessmentPaperHTML();
    saveAssessmentPage(readerState.index);
  } else {
    const hasExercises = pdfTasks(activePaper()).length > 0;
    if (panel) {
      panel.hidden = !hasExercises;
      panel.innerHTML = exercisePanelHTML(l);
    }
    const jumper = $('[data-jump-exercises]');
    if (jumper) {
      jumper.hidden = lessonExerciseIndex() < 0;
      jumper.innerHTML = icon('book') + (hasExercises?' Exercices de la page':' Voir les exercices');
    }
    const bookToggle = $('[data-book-answers-toggle]');
    if (bookToggle) bookToggle.hidden = !hasExercises;
    if (!hasExercises) document.body.classList.remove('answers-open');
  }
  bindPaperAspect();
  loadPDFWords();
  bindBookAudio();
  hideWordCard();
  const resume = $('[data-rejoin-course]');
  if (resume && pdfHeldCue!==null) resume.hidden = false;
}
function holdCurrentPDFCue() {
  const media = document.getElementById('recording');
  if (!media || route.page !== 'lesson') return;
  pdfHeldCue = currentPDFCue(media, lesson(route.id)) || false;
  const resume = $('[data-rejoin-course]');
  if (resume) resume.hidden = false;
}
function hideWordCard(){pdfLookupSequence++;pdfWordResult=null;hideWordActions();const card=document.getElementById('pdf-word-card');if(card)card.hidden=true;}
const wordLookupCache=new Map();

async function openPDFWord(raw,anchor=null,play=false){
  const word=cleanPDFWord(raw);if(!word||word.length>64)return;
  const card=document.getElementById('pdf-word-card');if(!card)return;
  hideWordActions();holdCurrentPDFCue();const sequence=++pdfLookupSequence;pdfWordResult=null;
  card.hidden=false;card.innerHTML=`<button class="word-close" data-close-word aria-label="Fermer">×</button><h2 lang="de">${esc(word)}</h2><p>Traduction, prononciation et exemple…</p>`;
  card.style.removeProperty('left');card.style.removeProperty('top');
  if(anchor&&innerWidth>650){const r=anchor.getBoundingClientRect();card.style.left=Math.max(12,Math.min(innerWidth-405,r.left))+'px';card.style.top=Math.max(80,Math.min(innerHeight-430,r.bottom+8))+'px';}
  try{
    let result=wordLookupCache.get(word);
    if(!result){
      const r=await fetch('/api/word?q='+encodeURIComponent(word));result=await r.json();
      if(!r.ok)throw Error(result.error||'Traduction indisponible');
      if(wordLookupCache.size>=250)wordLookupCache.delete(wordLookupCache.keys().next().value);
      wordLookupCache.set(word,result);
    }
    if(sequence!==pdfLookupSequence)return;pdfWordResult=result;
    card.innerHTML=`<button class="word-close" data-close-word aria-label="Fermer">×</button><small>ALLEMAND · FRANÇAIS</small><h2 lang="de">${esc(result.word)}</h2>${result.lemma!==result.word?`<p class="word-lemma">Forme de ${esc(result.lemma)}</p>`:''}<p class="word-translation">${result.translations.slice(0,4).map(esc).join(' · ')}</p>${result.ipa?`<p class="word-ipa">[${esc(result.ipa)}]</p>`:''}<div class="word-buttons"><button class="primary" data-pronounce-word>${icon('volume')}${result.pronunciation?.text&&normalizedAnswer(result.pronunciation.text)!==normalizedAnswer(result.word)?'Écouter : '+esc(result.pronunciation.text):'Écouter le mot'}</button><button class="secondary" data-pronounce-word="slow">Plus lent</button></div>${result.examples.map(e=>`<div class="word-example"><strong>Dans une phrase</strong><p lang="de">${esc(e.de)}</p><p>${esc(e.fr)}</p><a href="${esc(e.url)}" target="_blank" rel="noopener">Tatoeba · ${esc(e.author||'contributeurs')} / ${esc(e.translationAuthor||'contributeurs')} · ${esc(e.license||'CC BY')}</a></div>`).join('')}${!result.examples.length?'<p class="word-example">Pas d’exemple trouvé pour cette forme. Essaie le mot de base.</p>':''}<div class="word-credits"><a href="${result.dictionarySource==='MyMemory'?'https://mymemory.translated.net/':'https://download.freedict.org/dictionaries/deu-fra/2025.11.23/'}" target="_blank" rel="noopener">${esc(result.dictionarySource||'Dictionnaire')}</a><a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">Données FreeDict/WikDict · CC BY-SA 3.0</a>${result.pronunciation?`<a href="${esc(result.pronunciation.source)}" target="_blank" rel="noopener">Audio : ${esc(result.pronunciation.artist||'Wikimedia Commons')} · ${esc(result.pronunciation.license)}</a>`:''}</div>`;
    }catch(error){
    if(sequence!==pdfLookupSequence)return;
    pdfWordResult={word,lemma:word};
    card.innerHTML=`<button class="word-close" data-close-word aria-label="Fermer">×</button><h2 lang="de">${esc(word)}</h2><p class="word-error">${esc(error.message)}</p><button class="primary" data-pronounce-word>${icon('volume')} Écouter le mot</button>`;
  }
  if(play&&sequence===pdfLookupSequence)pronouncePDFWord();
}
async function pronouncePDFWord(slow=false){
  if(!pdfWordResult)return;const result=pdfWordResult,lemma=result.lemma;
  const keys=[result.word,'der '+result.word,'die '+result.word,'das '+result.word,...(normalizedAnswer(result.word)===normalizedAnswer(lemma)?[lemma,'der '+lemma,'die '+lemma,'das '+lemma]:[])];
  const cached=keys.map(k=>wordAudio[k]?.[state.voice||'female']).find(Boolean),src=cached||result.pronunciation?.url;
  if(src){if(wordPlayer)wordPlayer.pause();wordPlayer=new Audio(src);stopOtherMedia(wordPlayer);wordPlayer.preservesPitch=true;wordPlayer.playbackRate=slow?.7:.9;wordPlayer.play().catch(()=>toast('La prononciation de ce mot est momentanément indisponible.'));return;}
  if('speechSynthesis' in window){const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('de'));if(voice){stopOtherMedia(null);speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(result.word);utterance.voice=voice;utterance.lang='de-DE';utterance.rate=slow?.65:.85;speechSynthesis.speak(utterance);return;}}
  toast('Pas d’enregistrement disponible pour cette forme. Essaie le mot de base.');
}

document.addEventListener('input',e=>{
  const field=e.target,key=field.dataset.guidedAnswer;if(!key)return;lastActive=Date.now();state.answers[key]=field.value;save();
  const status=field.closest('.guided-task-body')?.querySelector('[data-guided-status]');if(status)status.textContent=storageError?'Pense à exporter tes réponses':'Enregistré ✓';
});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-reader]'))holdCurrentPDFCue();
  const summary=e.target.closest('.guided-task>summary');if(summary&&!summary.parentElement.open){holdCurrentPDFCue();focusPDFExercise(summary.parentElement.dataset.guidedTask);}
  const word=e.target.closest('[data-pdf-word]');if(word){const selection=window.getSelection()?.toString().trim();openPDFWord(selection&&selection.length<65?selection:word.dataset.pdfWord,word);return;}
  if(e.target.closest('[data-close-word]'))hideWordCard();
  const pronounce=e.target.closest('[data-pronounce-word]');if(pronounce)pronouncePDFWord(pronounce.dataset.pronounceWord==='slow');
  const focus=e.target.closest('[data-focus-task]');if(focus){holdCurrentPDFCue();focusPDFExercise(focus.dataset.focusTask);}
  const check=e.target.closest('[data-check-task]');if(check)checkCurrentTask(check.dataset.checkTask);
  const grammar=e.target.closest('[data-grammar-key]');if(grammar){const key=grammar.dataset.grammarKey;document.querySelector(`[data-grammar-result="${key}"]`).innerHTML=grammarHTML(state.answers[key]||'');}
  const key=e.target.closest('[data-guided-letter]');if(key){const body=key.closest('.guided-task-body'),field=lastGuidedField&&body.contains(lastGuidedField)?lastGuidedField:body.querySelector('[data-guided-answer]');if(field){const a=field.selectionStart,b=field.selectionEnd;field.setRangeText(key.dataset.guidedLetter,a,b,'end');field.focus();field.dispatchEvent(new Event('input',{bubbles:true}));}}
  if(e.target.closest('[data-toggle-exercises]'))document.body.classList.toggle('answers-open');
  if (e.target.closest('[data-jump-exercises]')) {
    const index = lessonExerciseIndex();
    if (index < 0) return;
    if (readerState.index !== index) {
      holdCurrentPDFCue();
      readerState.index = index;
      updateReader();
    }
    const answers = $('#classroom-answers');
    answers.focus({preventScroll:true});
    answers.scrollIntoView({block:'start'});
  }

});
document.addEventListener('change',e=>{if(e.target.id==='reader-page')holdCurrentPDFCue();});
document.addEventListener('focusin',e=>{if(e.target.matches('[data-guided-answer]'))lastGuidedField=e.target;});
document.addEventListener('submit',e=>{if(e.target.id==='pdf-word-search'){e.preventDefault();openPDFWord(new FormData(e.target).get('word'));}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideWordCard();});
async function checkClassroomVersion(){if(!window.DEUTSCHWEG_BUILD)return;try{const r=await fetch('/api/version',{cache:'no-store'}),v=await r.json();if(v.id!==window.DEUTSCHWEG_BUILD&&!document.getElementById('version-refresh')){const button=document.createElement('button');button.id='version-refresh';button.className='version-refresh';button.textContent='Une nouvelle version est prête · Actualiser';button.onclick=()=>{persistMedia();save();location.reload()};document.body.append(button);}}catch{}}
window.addEventListener('focus',checkClassroomVersion);setInterval(checkClassroomVersion,90000);
