import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const source = await readFile(new URL('../web/listening.js',import.meta.url),'utf8');
const {listeningWordAt,matchListeningWords,lessonReadingWord} = runInNewContext(
  source+'\n;({listeningWordAt,matchListeningWords,lessonReadingWord})'
);

test('tracks original audio time across seeks and silent gaps', () => {
  const words = [[300,500,'Wer'],[500,710,'bist'],[1200,1460,'du?']];
  assert.equal(listeningWordAt(words,501),1);
  assert.equal(listeningWordAt(words,710),-1);
  assert.equal(listeningWordAt(words,1420),2);
  assert.equal(listeningWordAt(words,310),0);
});

test('highlights unambiguous PDF phrases and skips isolated answer options', () => {
  const pdf = (text,index,top='20%') => ({
    dataset:{pdfWord:text}, style:{left:`${index*10}%`,top,height:'2%'}
  });
  const page = ['Wer','bist','DU?'].map((text,index)=>pdf(text,index));
  page.push(pdf('Nicole',0,'25%'));
  const words = [[0,220,'Wer'],[220,450,'bist'],[450,710,'du?'],[900,1300,'Nicole']];
  const matches = matchListeningWords(words,page);
  assert.equal(matches.get(2),page[2]);
  assert.equal(matches.has(3),false);
  const repeated = [...page,...page.slice(0,3).map((node,index)=>pdf(node.dataset.pdfWord,index,'40%'))];
  assert.equal(matchListeningWords(words,repeated).size,0);
});

test('matches a printed vocabulary list read with pauses between words', () => {
  const pdf = ['Grüße','–','Schlüssel','–','Stühle'].map((text,index) => ({
    dataset:{pdfWord:text},style:{left:`${index*12}%`,top:'20%',height:'2%'}
  }));
  const words = [[3000,3700,'Grüße.'],[9000,9750,'Schlüssel.'],[15000,15600,'Stühle.']];
  assert.equal(matchListeningWords(words,pdf).get(1),pdf[2]);
});

test('uses the timed PDF word only on its matching page and text layer', () => {
  const words = [[500,700,'notes:2',1,'büro']];
  const target = {dataset:{pdfWord:'Büro.'}};
  const layer = {dataset:{pageKey:'notes:2'},children:[{},target]};
  assert.equal(lessonReadingWord(words,650,layer),target);
  assert.equal(lessonReadingWord(words,700,layer),null);
  layer.dataset.pageKey = 'notes:3';
  assert.equal(lessonReadingWord(words,650,layer),null);
  layer.dataset.pageKey = 'notes:2';
  target.dataset.pdfWord = 'Stühle';
  assert.equal(lessonReadingWord(words,650,layer),null);
});
