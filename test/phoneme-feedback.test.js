import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';

const script = readFileSync(new URL('../web/phoneme-feedback.js', import.meta.url),'utf8');
const {comparePhones} = runInNewContext(script + '\n({comparePhones});');
const heard = (letters, probability = .97) => [...letters].map(symbol => ({symbol,probability}));

test('names a mispronounced letter and points to its isolated replay', () => {
  const item = {sample:'alphabet-0',model:{alphabetAnswer:'abc'}};
  assert.equal(comparePhones(item, {}, heard('abitsi'), 'female').issues.length,0);
  const wrong = comparePhones(item, {}, heard('aditsi'), 'male');
  assert.equal(wrong.issues.length,1);
  assert.equal(wrong.issues[0].letter,'B');
  assert.equal(wrong.issues[0].heard,'d');
  assert.equal(wrong.issues[0].clip,'letters/1');
});

test('uses matching voice references to find a missing sound and a replay range', () => {
  const item = {sample:'alphabet-4',model:{text:'Haus'}};
  const female = [['h',.1,.2,.9],['a',.2,.3,.8],['ʊ',.3,.4,.85],['s',.4,.5,.98]];
  const male = [['h',.1,.2,.92],['a',.2,.3,.95],['ʊ',.3,.4,.9],['s',.4,.5,.98]];
  const refs = {'alphabet-4':{female,male}};
  const result = comparePhones(item, refs, heard('has'), 'female');
  assert.equal(result.issues[0].symbol,'ʊ');
  assert.equal(result.issues[0].start,.3);
  assert.equal(result.issues[0].end,.4);
  assert.equal(comparePhones(item, refs, [], 'female').unclear,true);
});
