import {createHmac, randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const deriveKey = promisify(scrypt);
export const sessionAge = 7 * 24 * 60 * 60;
export const cookieName = '__Host-deutschweg-session';
export const passwordOptions = {N:32768,r:8,p:1,maxmem:64*1024*1024};

export function validProfile(user) {
  return Boolean(user && typeof user.username==='string' && /^[a-z0-9._-]{1,64}$/u.test(user.username) &&
    typeof user.name==='string' && user.name.length>0 && user.name.length<=64 && !/[\p{Cc}\p{Cf}]/u.test(user.name));
}

export function validCredential(user) {
  return validProfile(user) && typeof user.salt==='string' && /^[a-f0-9]{32}$/u.test(user.salt) &&
    typeof user.hash==='string' && /^[a-f0-9]{64}$/u.test(user.hash);
}

export function authConfig() {
  try {
    const auth = JSON.parse(process.env.DEUTSCHWEG_AUTH || 'null');
    if (validCredential(auth) && typeof auth.key==='string' && /^[a-f0-9]{64}$/u.test(auth.key)) return auth;
  } catch {}
  return null;
}

function signature(auth, value) {
  return createHmac('sha256',Buffer.from(auth.key,'hex'))
    .update(auth.username+'.'+value).digest();
}

export function publicUser(auth,user) {
  return {username:user.username,name:user.name,legacyProgress:user.username===auth.username};
}

export function issueSession(auth, now = Math.floor(Date.now()/1000), user = auth) {
  const base = (now+sessionAge)+'.'+randomBytes(18).toString('base64url');
  const value = user.username===auth.username ? base :
    'v2.'+base+'.'+Buffer.from(JSON.stringify({username:user.username,name:user.name})).toString('base64url');
  return value+'.'+signature(auth,value).toString('base64url');
}

export function sessionUser(req,auth,now = Math.floor(Date.now()/1000)) {
  const cookies = req.headers?.cookie || '';
  const value = cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if (!value) return null;
  const legacy = /^(\d{1,12})\.[\w-]{24}\.([\w-]{43})$/u.exec(value);
  const modern = /^v2\.(\d{1,12})\.[\w-]{24}\.([\w-]{1,480})\.([\w-]{43})$/u.exec(value);
  const expires = Number((legacy||modern)?.[1]);
  const sig = legacy?.[2] || modern?.[3];
  if (!sig || expires<=now || expires>now+sessionAge+5) return null;
  const digest = Buffer.from(sig,'base64url');
  if (digest.length!==32 || !timingSafeEqual(digest,signature(auth,value.slice(0,-44)))) return null;
  if (legacy) return publicUser(auth,auth);
  try {
    const user = JSON.parse(Buffer.from(modern[2],'base64url').toString('utf8'));
    return validProfile(user) ? publicUser(auth,user) : null;
  } catch {return null;}
}

export function sessionCookie(value = '') {
  return `${cookieName}=${value}; Max-Age=${value?sessionAge:0}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

export async function verifyPassword(auth,username,password) {
  if (typeof username !== 'string' || username.length>64 ||
      typeof password !== 'string' || !password.length || password.length>256) return false;
  const calculated = await deriveKey(password,Buffer.from(auth.salt,'hex'),32,passwordOptions);
  return timingSafeEqual(calculated,Buffer.from(auth.hash,'hex')) && username.trim().toLowerCase()===auth.username;
}

export async function passwordFields(password) {
  const salt = randomBytes(16);
  const hash = await deriveKey(password,salt,32,passwordOptions);
  return {salt:salt.toString('hex'),hash:hash.toString('hex')};
}

export function requireSession(req,res) {
  const auth = authConfig();
  if (!auth) {
    res.status(503).json({error:'La connexion est momentanément indisponible.'});
    return false;
  }
  if (sessionUser(req,auth)) return true;
  res.status(401).json({error:'Connecte-toi pour accéder à ton cours.'});
  return false;
}
