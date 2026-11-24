import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {test} from 'node:test';
import session, {handleSession} from '../api/session.js';
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

test('registration creates an encrypted account once and signs in with its own identity', async () => {
  const previous = {auth:process.env.DEUTSCHWEG_AUTH,data:process.env.DEUTSCHWEG_ACCOUNTS_DATA};
  process.env.DEUTSCHWEG_AUTH = JSON.stringify(auth);
  process.env.DEUTSCHWEG_ACCOUNTS_DATA = '17'.repeat(32);
  const records = new Map();
  const store = {
    async get(id){return records.get(id) ?? null;},
    async create(id,value){
      if (records.has(id)) return false;
      records.set(id,value);
      return true;
    }
  };
  const headers = {host:'course.example',origin:'https://course.example','content-type':'application/json'};
  const form = {action:'register',username:' Elodie ',name:'Élodie',password:mockPassword,confirmation:mockPassword};
  const post = body=>handleSession({method:'POST',headers,body},response(),store);
  try {
    assert.equal((await post({...form,confirmation:'different'})).code,400);
    assert.equal((await post({...form,username:auth.username})).code,409);
    const results = await Promise.all([post(form),post(form)]);
    assert.deepEqual(results.map(r=>r.code).sort(),[200,409]);
    assert.equal(records.size,1);
    const [id,value] = [...records][0];
    assert.match(id,/^[a-f0-9]{64}$/);
    assert(!value.includes('elodie') && !value.includes(mockPassword));
    const login = await post({username:'elodie',password:mockPassword});
    assert.equal(login.code,200);
    assert.deepEqual(login.body.user,{username:'elodie',name:'Élodie',legacyProgress:false});
    const cookie = login.headers['Set-Cookie'].split(';')[0];
    const who = await session({method:'GET',headers:{...headers,cookie}},response());
    assert.deepEqual(who.body.user,login.body.user);
    const owner = await post({username:auth.username,password:mockPassword});
    assert.equal(owner.body.user.legacyProgress,true);
  } finally {
    for (const [name,value] of [['DEUTSCHWEG_AUTH',previous.auth],['DEUTSCHWEG_ACCOUNTS_DATA',previous.data]]) {
      if (value===undefined) delete process.env[name];
      else process.env[name]=value;
    }
  }
});
