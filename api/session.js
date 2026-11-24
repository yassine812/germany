import {authConfig, issueSession, sessionCookie, sessionUser, verifyPassword} from '../lib/session.js';

export default async function session(req,res) {
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
  const {username,password} = req.body || {};
  try {
    if (!await verifyPassword(auth,username,password)) {
      return res.status(401).json({error:'Identifiant ou mot de passe incorrect.'});
    }
    res.setHeader('Set-Cookie',sessionCookie(issueSession(auth)));
    return res.status(200).json({user:{username:auth.username,name:auth.name}});
  } catch {
    return res.status(503).json({error:'La connexion est momentanément indisponible.'});
  }
}
