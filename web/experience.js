'use strict';

function roadmapHTML(){return recordingJourneyHTML()}

function integratedLessonHTML(l){return classroomLessonHTML(l)}

const listeningRate = .75;
const replayRate = .6;

function listeningSpeedOptions() {
  return '<option value=".75">Lent · 0,75×</option><option value=".6">Très lent · 0,60×</option><option value="1">Original · 1×</option>';
}

function exerciseAudioHTML(track){
  return `<div class="exercise-listen"><label>${icon('headphones')} Piste originale du manuel</label><small>${esc(track.title.replace('Lektion','Chapitre'))}</small><audio controls preload="none" src="${esc(track.src)}" aria-label="${esc(track.title)}"></audio><div class="exercise-audio-tools"><select aria-label="Vitesse de cette écoute" data-exercise-speed>${listeningSpeedOptions()}</select><button data-exercise-replay aria-label="Réécouter cet exercice plus lentement">${icon('repeat')} Plus lent</button></div></div>`;
}

function bindExerciseAudio(){
  document.querySelectorAll('.exercise-listen audio').forEach(audio=>{
    if(audio.dataset.exerciseBound)return;audio.dataset.exerciseBound='true';audio.preservesPitch=true;audio.playbackRate=listeningRate;
    audio.addEventListener('ended',()=>{audio.playbackRate=replayRate;audio.closest('.exercise-listen').querySelector('select').value='.6';});
  });
}

let appliedPDFCue = null;

function pageSyncHTML(l) {
  return `<div class="page-sync">
    <span data-pdf-sync-status>${icon('book')} PDF du cours</span>
    ${l?.pageCues?.length ? '<span class="sync-badge" data-following-course>Suit le cours</span><button class="link-button" data-rejoin-course hidden>Reprendre le suivi</button>' : ''}
  </div>`;
}

function jumpQuietInterval(media, l) {
  if (media.seeking || media.paused || !Number.isFinite(media.duration)) return false;
  const cut = l.silenceSkips?.find(([start, end]) => media.currentTime >= start && media.currentTime < end - .05);
  if (!cut) return false;
  // Seeking to the duration lets the normal ended event run on a trailing gap.
  media.currentTime = Math.min(l.mediaEnd ?? media.duration, cut[1]);
  return true;
}

function currentPDFCue(media, l) {
  if (!l?.pageCues?.length) return null;
  return l.pageCues.findLast(c => c.time <= media.currentTime + .35) || null;
}

function syncCoursePage(media) {
  if (route.page !== 'lesson' || media.seeking || wordInteractionOpen() || document.activeElement?.matches('textarea,input:not([type="checkbox"]):not([data-clip-position]),select')) return;
  const l = lesson(route.id);
  if (readerState?.lessonId !== l?.id) return;
  const cue = currentPDFCue(media, l);
  if (pdfHeldCue !== null) {
    if (cue === pdfHeldCue || !cue) {
      const resume = $('[data-rejoin-course]');
      if (resume) resume.hidden = false;
      return;
    }
    pdfHeldCue = null;
  }
  if (!cue || cue === appliedPDFCue) return;
  const index = readerState.pages.findIndex(p => p.book === cue.book && p.page === cue.page);
  if (index < 0) return;
  const resume = $('[data-rejoin-course]');
  if (resume) resume.hidden = true;
  if (index !== readerState.index) {
    readerState.index = index;
    updateReader();
  }
  appliedPDFCue = cue;
  if (cue.exercise || cue.region) focusCourseRegion(cue);
  else {
    const highlight = $('#pdf-exercise-focus');
    if (highlight) highlight.hidden = true;
  }
}

document.addEventListener('click', event => {
  if (!event.target.closest('[data-rejoin-course]')) return;
  const media = $('#recording');
  if (!media) return;
  pdfHeldCue = null;
  appliedPDFCue = null;
  const button = $('[data-rejoin-course]');
  if (button) button.hidden = true;
  syncCoursePage(media);
});

document.addEventListener('click',e=>{
  const start=e.target.closest('[data-start]');if(start&&lesson(start.dataset.start)){state.unit=lesson(start.dataset.start).unit;save();}
  const marked=e.target.closest('[data-study-mark]');
  if(marked){progress(route.id)[marked.dataset.studyMark]=true;save();updateCourseFinish();marked.classList.add('checked');marked.innerHTML=icon('check')+(marked.dataset.studyMark==='watch'?'Cours écouté':'Exercices travaillés');}
  const replay=e.target.closest('[data-exercise-replay]');
  if(replay){const area=replay.closest('.exercise-listen'),audio=area.querySelector('audio');area.querySelector('select').value='.6';audio.playbackRate=replayRate;audio.currentTime=0;audio.play().catch(()=>toast('Appuie sur lecture pour écouter.'));}
  const letter=e.target.closest('[data-answer-letter]');
  if(letter){const field=document.getElementById(letter.dataset.answerTarget);field.setRangeText(letter.dataset.answerLetter,field.selectionStart,field.selectionEnd,'end');field.focus();field.dispatchEvent(new Event('input',{bubbles:true}));}
});
document.addEventListener('input',e=>{const field=e.target;if(!field.dataset.exerciseAnswer)return;lastActive=Date.now();state.answers[field.dataset.exerciseAnswer]=field.value;save();field.closest('.exercise-response').querySelector('[data-save-status]').textContent=storageError?'Export recommandé':'Enregistré ✓';});
document.addEventListener('change',e=>{if(e.target.hasAttribute('data-exercise-speed'))e.target.closest('.exercise-listen').querySelector('audio').playbackRate=Number(e.target.value);});
