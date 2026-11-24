'use strict';

let reviewedGroups = [];
let groupsByClip = new Map();
let discardedSessions = {};
let continuingPlayback = null;

function loadReviewedGroups(review) {
  const byId = new Map(data.lessons.map(l=>[l.id,l]));
  discardedSessions = review?.aliases || {};
  const entries = review?.groups || [];
  groupsByClip = new Map();
  reviewedGroups = [];
  for (const entry of entries) {
    const clips = entry.clips.map(id=>byId.get(id)).filter(Boolean);
    const first = clips[0];
    if (!first || clips.length !== entry.clips.length || clips.some(l=>groupsByClip.has(l.id) || l.session!==first.session)) continue;
    const group = {...first,title:entry.title,sourceLabel:entry.sourceLabel,parts:clips,
      effectiveDuration:clips.reduce((sum,l)=>sum+l.effectiveDuration,0)};
    reviewedGroups.push(group);
    clips.forEach(l=>groupsByClip.set(l.id,group));
  }
  for (const l of data.lessons) {
    if (groupsByClip.has(l.id) || discardedSessions[l.session]) continue;
    const group = {...l,parts:[l]};
    reviewedGroups.push(group);
    groupsByClip.set(l.id,group);
  }
  const order = new Map(data.lessons.map((l,i)=>[l.id,i]));
  reviewedGroups.sort((a,b)=>order.get(a.id)-order.get(b.id));
  const counts = {};
  for (const group of reviewedGroups) {
    counts[group.level] = (counts[group.level] || 0) + 1;
    group.number = counts[group.level];
  }
  transferDiscardedHistory();
}

function reviewedGroup(l) {
  if (!l) return null;
  return groupsByClip.get(l.id) || {...l,parts:[l]};
}

function groupDone(group) {
  return group.parts.every(l=>isDone(l.id));
}

function groupStart(group) {
  const unfinished = group.parts.filter(l=>!state.lessons[l.id]?.watch && !isDone(l.id));
  return unfinished.find(l=>state.lessons[l.id]?.position) || unfinished[0] || group.parts.at(-1);
}

function groupProgress(group) {
  return {completed:groupDone(group),position:group.parts.some(l=>state.lessons[l.id]?.position || state.lessons[l.id]?.watch)};
}

function sourceMoment(l, relative) {
  for (const [start,end] of l.sourceSegments || [[l.sourceStart,l.sourceEnd]]) {
    if (relative < end-start) return start+relative;
    relative -= end-start;
  }
  return l.sourceEnd;
}

function playbackMoment(l, absolute) {
  return (l.sourceSegments || [[l.sourceStart,l.sourceEnd]])
    .reduce((sum,[a,b])=>sum+Math.max(0,Math.min(b,absolute)-a),0);
}

function transferDiscardedHistory() {
  for (const [discarded,canonical] of Object.entries(discardedSessions)) {
    const oldClips = data.lessons.filter(l=>l.session===discarded && state.lessons[l.id]);
    if (!oldClips.length) continue;
    for (const l of data.lessons.filter(l=>l.session===canonical)) {
      let seen = 0;
      let tried = 0;
      for (const old of oldClips) {
        const overlap = Math.max(0,Math.min(l.sourceEnd,old.sourceEnd)-Math.max(l.sourceStart,old.sourceStart));
        const stateBefore = state.lessons[old.id];
        if (stateBefore.watch || stateBefore.completed) seen += overlap;
        if (stateBefore.practice || stateBefore.completed) tried += overlap;
      }
      if (seen >= .92 * (l.sourceEnd-l.sourceStart)) progress(l.id).watch = true;
      if (tried >= .92 * (l.sourceEnd-l.sourceStart)) progress(l.id).practice = true;
    }
  }
}

function resolveReviewedLesson() {
  if (route.page!=='lesson') return;
  const old = lesson(route.id);
  const duplicateSession = old?.session || route.id;
  const session = discardedSessions[duplicateSession];
  if (!session) return;
  const played = Number(state.lessons[route.id]?.position) || 0;
  const time = old ? sourceMoment(old,played) : played;
  const available = data.lessons.filter(l=>l.session===session);
  const target = available.find(l=>l.sourceStart<=time && time<l.sourceEnd)
    || available.find(l=>l.sourceStart>time) || available.at(-1);
  if (!target) return;
  if (!state.lessons[target.id]?.position) progress(target.id).position = playbackMoment(target,time);
  if (state.notes[route.id] && !state.notes[target.id]) state.notes[target.id] = state.notes[route.id];
  const paper = route.bookId && route.pdfPage ? '/' + route.bookId + '/' + route.pdfPage : '';
  history.replaceState(null,'','#lesson/'+target.id+'/'+route.tab+paper);
  route = parseRoute();
}

function nextCoursePassage(l) {
  const parts = reviewedGroup(l).parts;
  return parts[parts.findIndex(clip=>clip.id===l.id)+1];
}

function advanceCoursePassage(l, rate) {
  if (route.page!=='lesson' || route.id!==l.id || route.tab==='practice') return;
  const next = nextCoursePassage(l);
  if (!next) return;
  continuingPlayback = {id:next.id,rate};
  readerState = null;
  quiz = null;
  navigate('#lesson/'+next.id+'/watch');
}

function resumeCoursePassage(l, media) {
  const following = continuingPlayback;
  continuingPlayback = null;
  if (following?.id!==l.id) return;
  $('#recording-speed').value = String(following.rate);
  media.playbackRate = following.rate;
  media.play().catch(()=>{});
}

function passageListHTML(l) {
  const {parts} = reviewedGroup(l);
  if (parts.length < 2) return '';
  const next = nextCoursePassage(l);
  return `<div class="course-passages">
    <label>Passage <select aria-label="Passage de cette leçon" data-course-passage>${parts.map((clip,i)=>
      `<option value="${clip.id}" ${clip.id===l.id?'selected':''}>${i+1} / ${parts.length} · ${lessonMinutes(clip)} min${state.lessons[clip.id]?.watch?' ✓':''}</option>`).join('')}</select></label>
    ${next?`<button class="link-button" data-start="${next.id}">Passage suivant</button>`:''}
  </div>`;
}

document.addEventListener('change',event=>{
  if (!event.target.matches('[data-course-passage]')) return;
  readerState = null;
  quiz = null;
  navigate('#lesson/'+event.target.value+'/watch');
});
