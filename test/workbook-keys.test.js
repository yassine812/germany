import assert from 'node:assert/strict';
import {test} from 'node:test';
import {gzipSync} from 'node:zlib';
import workbookKeys from '../api/workbook-keys.js';

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
  try {
    process.env.DEUTSCHWEG_WORKBOOK_KEYS = gzipSync(JSON.stringify(data)).toString('base64');
    process.env.VERCEL_ENV = 'development';
    assert.equal(workbookKeys({method:'GET'},response()).code,503);
    process.env.VERCEL_ENV = 'production';
    assert.equal(workbookKeys({method:'POST'},response()).code,405);
    const delivered = workbookKeys({method:'GET'},response());
    assert.equal(delivered.code,200);
    assert.equal(delivered.headers['Cache-Control'],'private, no-store');
    assert.deepEqual(JSON.parse(delivered.body),data);
    process.env.DEUTSCHWEG_WORKBOOK_KEYS = 'bad';
    assert.equal(workbookKeys({method:'GET'},response()).code,503);
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
    if (previousKeys === undefined) delete process.env.DEUTSCHWEG_WORKBOOK_KEYS;
    else process.env.DEUTSCHWEG_WORKBOOK_KEYS = previousKeys;
  }
});
