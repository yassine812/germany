'use strict';
function readerZoom(){return Math.max(1,Math.min(3,Number(state.bookZoom)||1))}
function readerZoomHTML(){return `<div class="zoom-controls" role="group" aria-label="Vue et zoom de la page"><button class="paper-view" data-paper-view>${paperView()==='page'?'Pleine largeur':'Page entière'}</button><button class="icon-btn" data-zoom="-0.25" aria-label="Réduire la page" ${readerZoom()===1?'disabled':''}>−</button><span id="reader-zoom-label">${Math.round(readerZoom()*100)} %</span><button class="icon-btn" data-zoom="0.25" aria-label="Agrandir dans le lecteur" ${readerZoom()===3?'disabled':''}>+</button></div>`}
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-zoom]');if(!button)return;
  state.bookZoom=Math.max(1,Math.min(3,readerZoom()+Number(button.dataset.zoom)));save();
  state.pdfViewMode='width';
  save();
  const paper=document.getElementById('pdf-paper');
  paper?.style.setProperty('--pdf-zoom',state.bookZoom);
  document.getElementById('pdf-stage')?.classList.remove('fit-paper');
  const view=document.querySelector('[data-paper-view]');
  if(view)view.textContent='Page entière';
  const label=document.querySelector('#reader-zoom-label');if(label)label.textContent=Math.round(state.bookZoom*100)+' %';
  const minus=document.querySelector('[data-zoom="-0.25"]'),plus=document.querySelector('[data-zoom="0.25"]');
  if(minus)minus.disabled=state.bookZoom===1;if(plus)plus.disabled=state.bookZoom===3;
});
function bookTracksForPage(b,p){
  const tracks=data.bookAudio?.[b.id]?.tracks||[],printed=p.printed;
  if(!tracks.length||!Number.isFinite(printed))return [];
  const kb=b.id.endsWith('-kb'),start=kb?9:6,block=kb?16:24,span=kb?4:6;
  if(printed<start)return tracks.filter(t=>!t.lesson&&!t.module);
  const rel=printed-start,group=Math.floor(rel/block),within=rel%block;
  if(group>3)return [];
  const offset=b.level==='A1.2'?12:0;
  if(within<span*3){const unit=group*3+Math.floor(within/span)+1+offset;return tracks.filter(t=>t.lesson===unit);}
  const units=[1,2,3].map(n=>group*3+n+offset);
  return tracks.filter(t=>t.module===group+1+(b.level==='A1.2'?4:0)||units.includes(t.lesson)&&/Wiederholung/i.test(t.title));
}
function bookAudioHTML(b,p,excluded=new Set()){
  const tracks=bookTracksForPage(b,p).filter(t=>!excluded.has(t.id));if(!tracks.length)return '';
  const first=tracks[0];
  return `<section class="book-audio-card" data-book-tracks='${esc(JSON.stringify(tracks))}'><div class="eyebrow">LES PISTES DE TON LIVRE</div><h3>Écouter l’exercice</h3><p>Choisis le numéro de l’exercice indiqué sur ta page.</p><label for="book-track-select">Piste du chapitre</label><select id="book-track-select" aria-label="Piste audio du livre">${tracks.map((t,i)=>`<option value="${i}">${esc(t.title.replace('Lektion','Chapitre').replace('Aussprache','Prononciation').replace('Basistraining','Exercices').replace('Hören','Écoute'))}</option>`).join('')}</select><audio id="book-recording" controls preload="none" src="${esc(first.src)}" aria-label="Audio de l’exercice du livre"></audio><div class="book-audio-controls"><label for="book-track-speed">Rythme</label><select id="book-track-speed" aria-label="Vitesse de l’audio du livre"><option value=".85">Calme · 0,85×</option><option value=".7">Très lent · 0,7×</option><option value="1">Original · 1×</option></select><button class="secondary" data-book-replay>Réécouter plus lentement</button></div><small>Piste originale · © Hueber Verlag. La deuxième écoute ralentit davantage. Les voix d’entraînement femme et homme sont disponibles dans l’atelier de la leçon.</small></section>`;
}
function bindBookAudio(){
  bindExerciseAudio();
  const card=document.querySelector('.book-audio-card');if(!card||card.dataset.bound)return;
  card.dataset.bound='true';const tracks=JSON.parse(card.dataset.bookTracks),audio=card.querySelector('audio'),choice=card.querySelector('#book-track-select'),speed=card.querySelector('#book-track-speed');
  audio.preservesPitch=true;audio.playbackRate=.85;
  choice.addEventListener('change',()=>{audio.pause();audio.src=tracks[Number(choice.value)].src;audio.load();audio.playbackRate=Number(speed.value);});
  speed.addEventListener('change',()=>audio.playbackRate=Number(speed.value));
  card.querySelector('[data-book-replay]').addEventListener('click',()=>{speed.value='.7';audio.playbackRate=.7;audio.currentTime=0;audio.play().catch(()=>toast('Appuie sur lecture pour démarrer.'));});
  audio.addEventListener('ended',()=>{speed.value='.7';audio.playbackRate=.7;});
}
