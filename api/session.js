import {authConfig, issueSession, publicUser, sessionCookie, sessionUser, verifyPassword} from '../lib/session.js';
import {createAccount, loadAccount, normalizeUsername, remoteAccounts, signupProfile} from '../lib/accounts.js';

export async function handleSession(req,res,store) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (!['GET','POST','DELETE'].includes(req.method)) {
    res.setHeader('Allow','GET, POST, DELETE');
    return res.status(405).end();
  }
  const auth = authConfig();
  if (!auth) return res.status(503).json({error:'La connexion est momentanément indisponible.'});
  if (req.method==='GET') return res.status(200).json({user:sessionUser(req,auth)});
  const host = req.headers?.host;
  if (!host || req.headers.origin!==('https://'+host)) return res.status(403).end();
  if (req.method==='DELETE') {
    res.setHeader('Set-Cookie',sessionCookie());
    return res.status(204).end();
  }
  if (req.headers['content-type']?.split(';')[0]!=='application/json') return res.status(415).end();
  const body = req.body || {};
  try {
    let user;
    if (body.action==='register') {
      user = signupProfile(body);
      if (!user) return res.status(400).json({error:'Vérifie le prénom, l’identifiant et les deux mots de passe.'});
      if (user.username===auth.username || !await createAccount(store,user)) {
        return res.status(409).json({error:'Cet identifiant est déjà utilisé.'});
      }
    } else {
      if (body.action!==undefined && body.action!=='login') return res.status(400).end();
      const submitted = typeof body.username==='string' && body.username.length<=64 ? body.username.trim().toLowerCase() : '';
      const username = normalizeUsername(submitted);
      user = submitted===auth.username ? auth : username ? await loadAccount(store,username) : null;
      if (!user || !await verifyPassword(user,submitted,body.password)) {
        return res.status(401).json({error:'Identifiant ou mot de passe incorrect.'});
      }
    }
    res.setHeader('Set-Cookie',sessionCookie(issueSession(auth,undefined,user)));
    return res.status(200).json({user:publicUser(auth,user)});
  } catch {
    return res.status(503).json({error:'La connexion est momentanément indisponible.'});
  }
}

export default function session(req,res) {
  return handleSession(req,res,remoteAccounts);
}
