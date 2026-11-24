import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {test} from 'node:test';
import session from '../api/session.js';
import {cookieName, issueSession, passwordOptions, sessionAge, sessionUser} from '../lib/session.js';

const mockPassword = 'Test-only-password-51';
const salt = Buffer.from('43'.repeat(16),'hex');
const auth = {
  username:'tester', name:'Camille', salt:salt.toString('hex'),
  hash:scryptSync(mockPassword,salt,32,passwordOptions).toString('hex'), key:'92'.repeat(32)
};

function response() {
  return {
    headers:{}, setHeader(name,value){this.headers[name]=value;},
    status(code){this.code=code;return this;}, json(body){this.body=body;return this;},
    end(){return this;}
  };
}

test('sessions expire and reject changed signatures', () => {
  const stamp = 1700000000;
  const token = issueSession(auth,stamp);
  const request = value=>({headers:{cookie:cookieName+'='+value}});
  assert.equal(sessionUser(request(token),auth,stamp)?.username,'tester');
  assert.equal(sessionUser(request(token),auth,stamp+sessionAge),null);
  const parts = token.split('.');
  parts[2] = (parts[2][0]==='A' ? 'B' : 'A')+parts[2].slice(1);
  assert.equal(sessionUser(request(parts.join('.')),auth,stamp),null);
});

test('same-origin sign in issues a secure cookie and sign out expires it', async () => {
  const previous = process.env.DEUTSCHWEG_AUTH;
  process.env.DEUTSCHWEG_AUTH = JSON.stringify(auth);
  const headers = {host:'course.example',origin:'https://course.example','content-type':'application/json'};
  try {
    const anon = await session({method:'GET',headers},response());
    assert.equal(anon.body.user,null);
    const wrong = await session({method:'POST',headers,body:{username:'tester',password:'wrong'}},response());
    assert.equal(wrong.code,401);
    const logged = await session({method:'POST',headers,body:{username:'Tester',password:mockPassword}},response());
    assert.equal(logged.code,200);
    assert.equal(logged.body.user.name,'Camille');
    const cookie = logged.headers['Set-Cookie'];
    assert.match(cookie,/; Path=\/; Secure; HttpOnly; SameSite=Lax$/);
    const active = await session({method:'GET',headers:{...headers,cookie:cookie.split(';')[0]}},response());
    assert.equal(active.body.user.username,'tester');
    const cross = await session({method:'DELETE',headers:{...headers,origin:'https://elsewhere.example'}},response());
    assert.equal(cross.code,403);
    const logout = await session({method:'DELETE',headers},response());
    assert.equal(logout.code,204);
    assert.match(logout.headers['Set-Cookie'],/^__Host-deutschweg-session=; Max-Age=0;/);
  } finally {
    if (previous===undefined) delete process.env.DEUTSCHWEG_AUTH;
    else process.env.DEUTSCHWEG_AUTH = previous;
  }
});
