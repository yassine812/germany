import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gzipSync} from 'node:zlib';
import workbookKeys from '../api/workbook-keys.js';
import {cookieName,issueSession} from '../lib/session.js';

function response() {
  return {
    headers:{}, setHeader(name,value){this.headers[name]=value;},
    status(code){this.code=code;return this;}, end(body){this.body=body;return this;},
    json(body){this.body=body;return this;}
  };
}

test('workbook answer keys are only read by protected deployment runtime', () => {
  const data = {'sample-workbook':{'1':[[['b','Beispiel']]]}};
  const previousEnvironment = process.env.VERCEL_ENV;
  const previousKeys = process.env.DEUTSCHWEG_WORKBOOK_KEYS;
  const previousAuth = process.env.DEUTSCHWEG_AUTH;
  const auth = {username:'tester',name:'Camille',salt:'11'.repeat(16),hash:'22'.repeat(32),key:'33'.repeat(32)};
  const req = {method:'GET',headers:{cookie:cookieName+'='+issueSession(auth)}};
  try {
    process.env.DEUTSCHWEG_AUTH = JSON.stringify(auth);
    process.env.DEUTSCHWEG_WORKBOOK_KEYS = gzipSync(JSON.stringify(data)).toString('base64');
    process.env.VERCEL_ENV = 'development';
    assert.equal(workbookKeys({method:'GET'},response()).code,503);
    process.env.VERCEL_ENV = 'production';
    assert.equal(workbookKeys({method:'POST'},response()).code,405);
    const denied = response();
    workbookKeys({method:'GET'},denied);
    assert.equal(denied.code,401);
    const delivered = workbookKeys(req,response());
    assert.equal(delivered.code,200);
    assert.equal(delivered.headers['Cache-Control'],'private, no-store');
    assert.deepEqual(JSON.parse(delivered.body),data);
    process.env.DEUTSCHWEG_WORKBOOK_KEYS = 'bad';
    assert.equal(workbookKeys(req,response()).code,503);
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
    if (previousKeys === undefined) delete process.env.DEUTSCHWEG_WORKBOOK_KEYS;
    else process.env.DEUTSCHWEG_WORKBOOK_KEYS = previousKeys;
    if (previousAuth===undefined) delete process.env.DEUTSCHWEG_AUTH;
    else process.env.DEUTSCHWEG_AUTH = previousAuth;
  }
});
