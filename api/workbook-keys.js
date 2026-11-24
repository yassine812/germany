import {gunzipSync} from 'node:zlib';
import {requireSession} from '../lib/session.js';

export default function workbookKeys(req, res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).end();
  }
  const encoded = process.env.DEUTSCHWEG_WORKBOOK_KEYS;
  if (!['preview','production'].includes(process.env.VERCEL_ENV) || !encoded) {
    return res.status(503).json({error:'Le corrigé du cahier est temporairement indisponible.'});
  }
  if (!requireSession(req,res)) return;
  try {
    const keys = gunzipSync(Buffer.from(encoded,'base64'), {maxOutputLength:256000}).toString('utf8');
    JSON.parse(keys);
    res.setHeader('Content-Type','application/json; charset=utf-8');
    return res.status(200).end(keys);
  } catch {
    return res.status(503).json({error:'Impossible de lire le corrigé du cahier.'});
  }
}
