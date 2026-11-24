'use strict';

const preparationSessions = new Set(['A1.1-s1', 'A1.1-s2']);
let reviewedGroups = [];
let recordingsBySession = new Map();
let groupsByClip = new Map();
let discardedSessions = {};
let replacedClips = new Map();
let continuingPlayback = null;

function loadReviewedGroups(review) {
  const byId = new Map(data.lessons.map(l=>[l.id,l]));
  discardedSessions = review?.aliases || {};
  const entries = review?.groups || [];
  const notes = book('notes');
  if (notes) {
    notes.title = 'Préparation';
    notes.level = preparationLevel;
  }
  groupsByClip = new Map();
  reviewedGroups = [];
  const preparation = loadPreparation(review?.preparation || [], byId);
  applyOpeningCuts(review?.openingCuts || {});
  for (const entry of preparation) addReviewedGroup(entry, entry.parts, preparationLevel);
  const levelOf = l => !preparation.length && preparationSessions.has(l.session) ? preparationLevel : l.level;
  for (const entry of entries) {
    const clips = entry.clips.filter(id=>!groupsByClip.has(id) && !replacedClips.has(id)).map(id=>byId.get(id)).filter(Boolean);
    if (clips.length) addReviewedGroup(entry, clips, levelOf(clips[0]));
  }
  for (const l of data.lessons) {
    if (groupsByClip.has(l.id) || discardedSessions[l.session] || replacedClips.has(l.id)) continue;
    addReviewedGroup(l, [l], levelOf(l));
  }
  const order = new Map(data.lessons.map((l,i)=>[l.id,i]));
  reviewedGroups.sort((a,b)=>
    Number(b.level===preparationLevel) - Number(a.level===preparationLevel) ||
    (a.level===preparationLevel ? 0 : order.get(a.id)-order.get(b.id)));
  recordingsBySession = new Map();
  const sources = new Map(data.sessions?.map(s=>[s.id,s]));
  for (const chapter of reviewedGroups) {
    const key = recordingKey(chapter);
    let recording = recordingsBySession.get(key);
    if (!recording) {
      recording = {id:chapter.session,level:chapter.level,kind:chapter.kind,
        title:sources.get(chapter.session)?.title || chapter.title,chapters:[],parts:[]};
      recordingsBySession.set(key,recording);
    }
    recording.chapters.push(chapter);
    recording.parts.push(...chapter.parts);
    chapter.number = recording.chapters.length;
  }
  transferDiscardedHistory();
}

function applyOpeningCuts(openings) {
  for (const clip of data.lessons) {
    const originalStart = clip.mediaStart ?? 0;
    const end = clip.mediaEnd ?? clip.duration;
    const cut = openings[clip.mediaSource || clip.id];
    let start = Number.isFinite(cut) && cut < end-2 ? Math.max(originalStart,cut) : originalStart;
    const pauses = clip.silenceSkips || [];
    for (const [from,to] of pauses) {
      if (from <= start+.15 && to > start && to < end-2) start = to;
    }
    if (start <= originalStart+.05) continue;
    const quiet = pauses.reduce((sum,[from,to])=>sum+Math.max(0,Math.min(start,to)-Math.max(originalStart,from)),0);
    clip.mediaStart = start;
    clip.effectiveDuration = Math.max(1,clip.effectiveDuration-(start-originalStart-quiet));
  }
}

function addReviewedGroup(entry, parts, level) {
  const first = parts[0];
  const group = {...first,title:entry.title,sourceLabel:entry.sourceLabel,parts,
    level,
    effectiveDuration:parts.reduce((sum,l)=>sum+l.effectiveDuration,0)};
  reviewedGroups.push(group);
  parts.forEach(l=>groupsByClip.set(l.id,group));
}

function loadPreparation(entries, byId) {
  const excerptsBySource = new Map();
  replacedClips = new Map();
  const groups = [];
  for (const entry of entries) {
    const parts = entry.parts.map(part => {
      const original = byId.get(part.source);
      if (!original) return null;
      const pages = part.pages || entry.pages;
      const start = part.start ?? 0;
      const end = part.end ?? original.duration;
      if (end <= start || start < 0 || end > original.duration || !pages.length) return null;
      const cues = [...original.pageCues,...(part.cues || []).map(cue=>({...cue,book:'notes'}))]
        .filter(cue=>cue.book==='notes' && pages.includes(cue.page) && cue.time>=start && cue.time<end)
        .sort((a,b)=>a.time-b.time);
      const page = part.page || cues[0]?.page || pages[0];
      const initialCue = cues[0]?.time === start ? [] : [{book:'notes',page,time:start}];
      const refs = [page,...entry.pages.filter(number=>number!==page)].map(number=>({book:'notes',start:number,end:number,purpose:'Dans la leçon'}));
      const changes = {preparationPages:entry.pages,refs,pageCues:[...initialCue,...cues]};
      if (!part.id) {
        Object.assign(original,changes);
        return original;
      }
      const quiet = (original.silenceSkips || []).reduce((sum,[a,b])=>sum+Math.max(0,Math.min(end,b)-Math.max(start,a)),0);
      const clip = {...original,...changes,id:part.id,mediaSource:original.id,mediaStart:start,mediaEnd:end,
        effectiveDuration:Math.max(1,end-start-quiet)};
      const excerpts = excerptsBySource.get(original.id) || [];
      excerpts.push(clip);
      excerptsBySource.set(original.id,excerpts);
      data.lessons.push(clip);
      return clip;
    }).filter(Boolean);
    if (parts.length) groups.push({...entry,parts});
  }
  for (const [id,excerpts] of excerptsBySource) {
    const original = byId.get(id);
    const ranges = excerpts.map(l=>[l.mediaStart,l.mediaEnd]).sort((a,b)=>a[0]-b[0]);
    const removed = ranges.reduce((sum,[a,b])=>sum+b-a,0);
    if (removed >= original.duration-.05) {
      replacedClips.set(id,excerpts);
    } else {
      original.silenceSkips = [...(original.silenceSkips || []),...ranges].sort((a,b)=>a[0]-b[0]).reduce((merged,[a,b])=>{
        const tail = merged.at(-1);
        if (tail && a<=tail[1]) tail[1] = Math.max(b,tail[1]);
        else merged.push([a,b]);
        return merged;
      },[]);
      const first = original.silenceSkips[0];
      const last = original.silenceSkips.at(-1);
      if (first[0]===0) original.mediaStart = first[1];
      if (last[1]>=original.duration-.05) original.mediaEnd = last[0];
      original.pageCues = original.pageCues.filter(cue=>!ranges.some(([a,b])=>cue.time>=a && cue.time<b));
      original.effectiveDuration = Math.max(1, Math.min(original.effectiveDuration, original.duration-removed));
    }
  }
  transferPreparationHistory();

  return groups;
}

function transferPreparationHistory() {
  for (const clip of data.lessons) {
    const previous = state.lessons[clip.mediaSource];
    if (!previous || state.lessons[clip.id]) continue;
    state.lessons[clip.id] = {...previous,
      position:previous.position>=clip.mediaStart && previous.position<clip.mediaEnd ? previous.position : clip.mediaStart};
  }
}

function recordingKey(group) {
  return group.level===preparationLevel ? 'prep-'+group.session : group.session;
}

function journeyStopId(group) {
  return group.level===preparationLevel ? group.id : group.session;
}

function reviewedGroup(l) {
  if (!l) return null;
  return groupsByClip.get(l.id) || {...l,parts:[l]};
}

function recordingFor(l) {
  return recordingsBySession.get(recordingKey(reviewedGroup(l)));
}

function groupDone(group) {
  return group.parts.every(l=>isDone(l.id));
}

function groupStart(group) {
  if (group.chapters) return groupStart(group.chapters.find(chapter=>!groupDone(chapter)) || group.chapters.at(-1));
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
  const excerpts = replacedClips.get(route.id);
  if (excerpts) {
    const position = state.lessons[route.id]?.position || 0;
    const target = excerpts.find(l=>position>=l.mediaStart && position<l.mediaEnd) || excerpts[0];
    if (state.notes[route.id] && !state.notes[target.id]) state.notes[target.id] = state.notes[route.id];
    replaceLessonRoute(target);
    return;
  }
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
  replaceLessonRoute(target);
}

function replaceLessonRoute(target) {
  const paper = route.bookId && route.pdfPage ? '/' + route.bookId + '/' + route.pdfPage : '';
  history.replaceState(null,'','#lesson/'+target.id+'/'+route.tab+paper);
  route = parseRoute();
}

function advanceCoursePassage(l, rate) {
  if (route.page!=='lesson' || route.id!==l.id || ['exercise','practice'].includes(route.tab)) return;
  const {parts} = reviewedGroup(l);
  const index = parts.findIndex(clip=>clip.id===l.id);
  const next = [...parts.slice(index+1),...parts.slice(0,index)]
    .find(clip=>!state.lessons[clip.id]?.watch && !isDone(clip.id));
  if (!next) {
    openNextLessonExercise(l);
    return;
  }
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

function chapterListHTML(l) {
  const recording = recordingFor(l);
  if (reviewedGroup(l).level===preparationLevel || !recording || recording.chapters.length < 2) return '';
  const current = reviewedGroup(l);
  return `<label class="course-chapters">
    <span>Chapitres de la séance</span>
    <select data-course-chapter>
      ${recording.chapters.map(chapter=>`<option value="${groupStart(chapter).id}" ${chapter===current?'selected':''}>
        ${chapter.number}. ${esc(chapter.title)}${groupDone(chapter)?' ✓':''}
      </option>`).join('')}
    </select>
  </label>`;
}

document.addEventListener('change',event=>{
  if (!event.target.matches('[data-course-chapter]')) return;
  readerState = null;
  quiz = null;
  navigate('#lesson/'+event.target.value+'/watch');
});
