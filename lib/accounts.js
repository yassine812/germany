import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {courseOrigin} from './course-origin.js';
import {passwordFields,validCredential,validProfile} from './session.js';

export function normalizeUsername(value) {
  const name = typeof value==='string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9._-]{3,32}$/u.test(name) ? name : '';
}

export function signupProfile(body) {
  const username = normalizeUsername(body?.username);
  const name = typeof body?.name==='string' ? body.name.trim().normalize('NFC') : '';
  const password = body?.password;
  if (!validProfile({username,name}) || typeof password!=='string' ||
      password.length<12 || password.length>256 || password!==body?.confirmation) return null;
  return {username,name,password};
}

function dataKey(label) {
  const seed = process.env.DEUTSCHWEG_ACCOUNTS_DATA;
  if (!seed || !/^[a-f0-9]{64}$/u.test(seed)) throw Error('Account storage unavailable');
  return createHmac('sha256',Buffer.from(seed,'hex')).update(label).digest();
}

function accountId(username) {
  return createHmac('sha256',dataKey('deutschweg/account-id')).update(username).digest('hex');
}

function seal(id,credential) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',dataKey('deutschweg/account-record'),iv);
  cipher.setAAD(Buffer.from(id));
  const content = Buffer.concat([cipher.update(JSON.stringify(credential),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),content]).toString('base64url');
}

function unseal(id,record) {
  const content = Buffer.from(record,'base64url');
  if (content.length<29 || content.length>2048) throw Error('Invalid account record');
  const decipher = createDecipheriv('aes-256-gcm',dataKey('deutschweg/account-record'),content.subarray(0,12));
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(content.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(content.subarray(28)),decipher.final()]).toString('utf8'));
}

async function originRequest(id,method,body) {
  const token = process.env.DEUTSCHWEG_MEDIA_TOKEN;
  const key = process.env.DEUTSCHWEG_ACCOUNTS_KEY;
  if (!token || !key || !/^[a-f0-9]{64}$/u.test(key)) throw Error('Account storage unavailable');
  const headers = {'OAI-Sites-Authorization':'Bearer '+token,'X-Deutschweg-Accounts-Key':key};
  if (body) headers['Content-Type']='text/plain';
  return fetch(courseOrigin+'/_accounts/'+id,{
    method,headers,body,redirect:'error',signal:AbortSignal.timeout(12000)
  });
}

export const remoteAccounts = {
  async get(id) {
    const res = await originRequest(id,'GET');
    if (res.status===404) return null;
    if (res.status!==200) throw Error('Account lookup failed');
    return res.text();
  },
  async create(id,record) {
    const res = await originRequest(id,'PUT',record);
    if (res.status===409) return false;
    if (res.status!==201) throw Error('Account creation failed');
    return true;
  }
};

export async function loadAccount(store,username) {
  const id = accountId(username);
  const record = await store.get(id);
  if (record===null) return null;
  const account = unseal(id,record);
  if (!validCredential(account) || account.username!==username) throw Error('Invalid stored account');
  return account;
}

export async function createAccount(store,profile) {
  const {username,name,password} = profile;
  const id = accountId(username);
  const credential = {username,name,...await passwordFields(password)};
  return store.create(id,seal(id,credential));
}
