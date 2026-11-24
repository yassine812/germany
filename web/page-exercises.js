'use strict';

const notesExercises = {
  3:[
    {title:'Reconnaître les voyelles', prompt:'Choisis la combinaison écrite dans chaque mot.', choices:['au','ei','ie','eu'], parts:[['Maus','au'],['mein','ei'],['Lied','ie'],['Freund','eu']]},
    {title:'Repérer les consonnes', prompt:'Choisis le groupe de consonnes que tu vois dans chaque mot.', choices:['sp','st','sch','ch'], parts:[['Stuhl','st'],['Schule','sch'],['sprechen','sp'],['Buch','ch']]}
  ],
  4:[{title:'Les pronoms personnels', prompt:'Associe le pronom allemand au pronom français.', choices:['ich','du','er','wir','ihr','Sie'], parts:[['je','ich'],['tu','du'],['nous','wir'],['vous (formel)','Sie']]}],
  5:[{title:'Demander le prénom', prompt:'Complète le verbe heißen dans chaque question.', parts:[['Wie … du?','heißt'],['Wie … Sie?','heißen']]}],
  6:[{title:'Dire où l’on habite', prompt:'Complète le verbe wohnen.', parts:[['Ich … in Tunis.','wohne'],['Wo … du?','wohnst'],['Wo … Sie?','wohnen']]}],
  7:[{title:'Parler des langues', prompt:'Complète le verbe sprechen.', parts:[['Ich … Deutsch.','spreche'],['Welche Sprachen … du?','sprichst'],['Welche Sprachen … Sie?','sprechen']]}],
  8:[{title:'Conjuguer sein', prompt:'Choisis la forme de sein qui va avec chaque pronom.', choices:['bin','bist','ist','sind','seid'], parts:[['ich','bin'],['du','bist'],['sie (elle)','ist'],['wir','sind'],['ihr','seid']]}],
  9:[{title:'Conjuguer au présent', prompt:'Conjugue le verbe entre parenthèses.', parts:[['Du … in Tunis. (wohnen)','wohnst'],['Er … aus Tunesien. (kommen)','kommt'],['Wir … Deutsch. (lernen)','lernen']]}],
  10:[{title:'Saluer et prendre congé', prompt:'Choisis ce que tu dirais dans chaque situation.', choices:['Guten Morgen','Guten Abend','Auf Wiederhören','Tschüss'], parts:[['Tu salues quelqu’un le matin.','Guten Morgen'],['Tu arrives à une soirée.','Guten Abend'],['Tu termines un appel formel.','Auf Wiederhören'],['Tu prends congé d’un ami.','Tschüss']]}],
  11:[{title:'Tutoyer ou vouvoyer', prompt:'Complète Wie geht es …? selon la personne à qui tu parles.', choices:['dir','Ihnen'], parts:[['À un ami','dir'],['À un inconnu que tu vouvoies','Ihnen']]}],
  12:[{title:'Les pays sans article', prompt:'Écris le nom du pays en allemand.', parts:[['France','Frankreich'],['Allemagne','Deutschland'],['Tunisie','Tunesien'],['Japon','Japan']]}],
  13:[{title:'Les pays avec article', prompt:'Complète la préposition et l’article.', parts:[['Ich komme … Schweiz.','aus der'],['Ich komme … Türkei.','aus der'],['Ich wohne … Ukraine.','in der']]}],
  14:[{title:'Les noms de pays au pluriel', prompt:'Choisis l’article après aus ou in.', choices:['der','dem','den'], parts:[['Ich komme aus … USA.','den'],['Ich wohne in … Niederlanden.','den']]}],
  15:[{title:'Associer les langues aux pays', prompt:'Choisis une langue associée au pays dans le tableau de la page.', choices:['Arabisch','Französisch','Italienisch','Portugiesisch'], parts:[['Tunesien','Arabisch'],['Frankreich','Französisch'],['Italien','Italienisch'],['Portugal','Portugiesisch']]}],
  16:[{title:'Choisir le mot interrogatif', prompt:'Choisis le mot qui convient à la réponse.', choices:['Wo','Woher','Wie','Welche'], parts:[['… wohnst du? — In Tunis.','Wo'],['… kommst du? — Aus Tunesien.','Woher'],['… heißt du? — Ich heiße Lina.','Wie']]}],
  17:[{title:'Poser une question fermée', prompt:'Remets les mots dans l’ordre pour poser une question à laquelle on répond oui ou non.', parts:[['du · in Berlin · Wohnst','Wohnst du in Berlin?'],['Sie · Deutsch · Lernen','Lernen Sie Deutsch?']]}],
  18:[{title:'Trouver la question', prompt:'Écris la question qui amène la réponse donnée.', parts:[['Ja, er lernt Deutsch und Englisch.','Lernt er Deutsch und Englisch?']]}],
  21:[{title:'Mots de la page', prompt:'Associe chaque mot allemand à sa traduction française.', choices:['lire','la lettre','le temps','le travail'], parts:[['lesen','lire'],['der Brief','la lettre'],['die Zeit','le temps'],['die Arbeit','le travail']]}],
  25:[{title:'Former le pluriel', prompt:'Écris le pluriel avec son article.', parts:[['der Mann','die Männer'],['das Buch','die Bücher'],['das Kind','die Kinder'],['die Straße','die Straßen']]}],
  29:[{title:'Demander un numéro', prompt:'Complète la question pour la personne indiquée.', choices:['deine','Ihre'], parts:[['Was ist … Telefonnummer? · à un ami','deine'],['Was ist … Telefonnummer? · à une personne vouvoyée','Ihre']]}]
};

function lettersExercise(indices) {
  if (!speechModels.alphabet) return null;
  return {
    title:'Dictée de lettres',
    prompt:'Écoute chaque piste. Écris les lettres dans l’ordre, séparées par des espaces.',
    parts:indices.map(index => {
      const question = speechQuestion('alphabet',index,'dictation');
      return {label:question.answer.length + ' lettres',expected:question.answer,model:question.model,sample:question.sample};
    })
  };
}

function notesTasks(p,l) {
  if (p.book !== 'notes') return [];
  if (p.page === 1) {
    const secondHalf = l?.title.includes('H à M');
    const groups = secondHalf ? [8,9] : [0,6];
    const words = secondHalf ? ['Haus','Igel','Jacke','Katze','Lampe','Maus'] :
      ['Apfel','Ball','Cent','Dino','Elefant','Fisch','Garten'];
    return [lettersExercise(groups), {
      title:'Associer un mot à sa lettre',
      prompt:'Choisis la première lettre de chaque mot allemand.',
      choices:words.map(word => word[0]),
      parts:words.map(word => [word, word[0]])
    }].filter(Boolean);
  }
  if (p.page === 2) {
    if (l?.title.includes('ä, ö, ü')) {
      return [{title:'Repérer un umlaut',prompt:'Choisis la lettre accentuée dans chaque mot.',
        choices:['ä','ö','ü'],parts:[['Äpfel','ä'],['Öl','ö'],['Tür','ü']]}];
    }
    const early = l?.title.includes('N, O, P et Q');
    const middle = l?.title.includes('R, S, T et U');
    const group = early ? [10] : middle ? [12] : [10,12,25];
    const words = early ? ['Nase','Oma','Palme','Quelle'] : middle ? ['Rose','Sonne','Tasse','Uhr'] :
      ['Nase','Quelle','Sonne','Uhr','Vogel'];
    return [lettersExercise(group), {title:'Repérer la première lettre',prompt:'Choisis la lettre de départ.',
      choices:words.map(word => word[0]),parts:words.map(word => [word,word[0]])}].filter(Boolean);
  }
  const tasks = notesExercises[p.page] || [];
  if (p.page === 3 && l?.title.includes('sch, sp, st et ch')) return tasks.slice(1);
  if (p.page === 3 && l?.title.includes('combinaisons de voyelles')) return tasks.slice(0,1);
  return tasks;
}

function notesPart(part) {
  return Array.isArray(part) ? {label:part[0],expected:part[1]} : part;
}

function noteTaskKey(p,l,exercise,part) {
  return ['page-exercise',p.book,p.page,l?.id || 'reference',exercise,part].join(':');
}

function noteAnswerHTML(p,l,exercise,index,i) {
  const part = notesPart(exercise.parts[i]);
  const key = noteTaskKey(p,l,index,i);
  const value = state.answers[key] || '';
  const control = exercise.choices ? choiceAnswerField(key,part.label,value,exercise.choices) :
    answerField(key, part.label, value, false);
  const audio = part.sample ? exerciseAudioHTML({title:'Piste ' + (i+1),src:pronunciationClip(part.sample,state.voice==='male'?'male':'female')}) : '';
  return `<div class="page-exercise-item">${audio}${control}<p class="page-part-result" data-page-part-feedback="${i}"></p></div>`;
}

function notesExerciseHTML(p,l,tasks) {
  return tasks.map((exercise,index) => `<details class="guided-task page-exercise" data-page-exercise="${index}" ${index===0?'open':''}>
    <summary><span class="exercise-number">${index+1}</span><strong>${esc(exercise.title)}</strong></summary>
    <div class="guided-task-body">
    <p class="exercise-prompt">${esc(exercise.prompt)}</p>
    <div class="page-exercise-fields ${exercise.choices?'choice-fields':''}">${exercise.parts.map((_,i)=>noteAnswerHTML(p,l,exercise,index,i)).join('')}</div>
    <button class="primary" data-check-page-exercise="${index}">Vérifier l’exercice</button>
    <p class="page-exercise-result" data-page-exercise-result role="status"></p>
    </div></details>`).join('');
}

function notePartResult(p,l,exercise,part,i,j) {
  const value = state.answers[noteTaskKey(p,l,i,j)] || '';
  if (!value.trim()) return {status:'empty',message:'À compléter'};
  if (part.model) {
    return matchesSpeechAnswer(part,value)
      ? {status:'correct',message:'Correct ✓'}
      : {status:'review',message:'À réécouter',expected:part.model.text};
  }
  if (exercise.choices) return value===part.expected ?
    {status:'correct',message:'Correct ✓'} : {status:'review',message:'À revoir',expected:part.expected};
  return gradeClosedAnswer(value,part);
}

document.addEventListener('click',event => {
  const button = event.target.closest('[data-check-page-exercise]');
  if (!button) return;
  const p = activePaper();
  const l = route.page === 'lesson' ? lesson(route.id) : null;
  const i = Number(button.dataset.checkPageExercise);
  const tasks = notesTasks(p,l);
  const exercise = tasks[i];
  const group = button.closest('[data-page-exercise]');
  let correct = 0;
  exercise.parts.forEach((raw,j) => {
    const result = notePartResult(p,l,exercise,notesPart(raw),i,j);
    const status = $('[data-page-part-feedback="' + j + '"]',group);
    status.className = 'page-part-result ' + result.status;
    status.innerHTML = esc(result.message) + (result.expected ? ` · <strong lang="de">${esc(result.expected)}</strong>` : '');
    if (result.status === 'correct') correct++;
  });
  $('[data-page-exercise-result]',group).textContent = correct + ' / ' + exercise.parts.length + ' réponses justes';
  if (l && tasks.every((task,x) => task.parts.every((part,y) => notePartResult(p,l,task,notesPart(part),x,y).status==='correct'))) {
    progress(l.id).read = true;
    save();
    const finish = $('[data-study-mark="read"]');
    if (finish) {
      finish.classList.add('checked');
      finish.innerHTML = icon('check') + ' Exercices terminés';
    }
  }
});
