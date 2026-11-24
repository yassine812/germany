import {createHmac, randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const deriveKey = promisify(scrypt);
export const sessionAge = 7 * 24 * 60 * 60;
export const cookieName = '__Host-deutschweg-session';
export const passwordOptions = {N:32768,r:8,p:1,maxmem:64*1024*1024};

export function authConfig() {
  try {
    const auth = JSON.parse(process.env.DEUTSCHWEG_AUTH || 'null');
    if (auth && typeof auth.username==='string' && /^[a-z0-9._-]{1,64}$/u.test(auth.username) &&
        typeof auth.name === 'string' && auth.name.length > 0 && auth.name.length <= 64 &&
        typeof auth.salt==='string' && /^[a-f0-9]{32}$/u.test(auth.salt) &&
        [auth.hash,auth.key].every(x=>typeof x==='string' && /^[a-f0-9]{64}$/u.test(x))) return auth;
  } catch {}
  return null;
}

function signature(auth, value) {
  return createHmac('sha256',Buffer.from(auth.key,'hex'))
    .update(auth.username+'.'+value).digest();
}

export function issueSession(auth, now = Math.floor(Date.now()/1000)) {
  const value = (now+sessionAge)+'.'+randomBytes(18).toString('base64url');
  return value+'.'+signature(auth,value).toString('base64url');
}

export function sessionUser(req,auth,now = Math.floor(Date.now()/1000)) {
  const cookies = req.headers?.cookie || '';
  const value = cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  const match = /^(\d{1,12})\.([\w-]{24})\.([\w-]{43})$/u.exec(value || '');
  if (!match || Number(match[1])<=now || Number(match[1])>now+sessionAge) return null;
  const digest = Buffer.from(match[3],'base64url');
  return digest.length===32 && timingSafeEqual(digest,signature(auth,match[1]+'.'+match[2]))
    ? {username:auth.username,name:auth.name} : null;
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
