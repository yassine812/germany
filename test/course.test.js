import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {coursePath} from '../api/course.js';

test('course routes cover the application and exclude private administration', () => {
  assert.equal(coursePath('course.json'), '/course.json');
  assert.equal(coursePath('media/A1.1-s1-l01-abc.mp4'), '/media/A1.1-s1-l01-abc.mp4');
  assert.equal(coursePath('assets/text/notes/1.json'), '/assets/text/notes/1.json');
  assert.equal(coursePath('word','schön'), '/api/word?q=sch%C3%B6n');
  for (const key of ['_ingest/media/x.mp4', 'assets/books/../x.webp', 'https://example.com', 'assets/books/%2e%2e/x.webp', ['course.json']]) {
    assert.equal(coursePath(key), null);
  }
});

test('course access fails closed without a secret and in development', async () => {
  const before = {environment:process.env.VERCEL_ENV, token:process.env.DEUTSCHWEG_MEDIA_TOKEN};
  process.env.VERCEL_ENV = 'production';
  delete process.env.DEUTSCHWEG_MEDIA_TOKEN;
  const res = {setHeader(){}, status(code){this.code=code;return this;}, json(body){this.body=body;}};
  try {
    await handler({method:'GET',query:{key:'course.json'}},res);
    assert.equal(res.code,503);
    process.env.VERCEL_ENV = 'development';
    process.env.DEUTSCHWEG_MEDIA_TOKEN = 'mock-token';
    await handler({method:'GET',query:{key:'course.json'}},res);
    assert.equal(res.code,503);
    assert(!JSON.stringify(res.body).includes('mock-token'));
  } finally {
    for (const [name,value] of [['VERCEL_ENV',before.environment],['DEUTSCHWEG_MEDIA_TOKEN',before.token]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
