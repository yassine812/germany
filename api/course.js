import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {requireSession} from '../lib/session.js';

// The credential grants access only to the existing private course origin.
// Never follow redirects or proxy methods that can change upstream state.
const origin = 'https://deutschweg-yassine.tuftedgrackle1.chatgpt.site';
const publicData = new Set(['course.json', 'solutions.json']);
const media = /^media\/[\w.-]+\.(?:mp4|m4a|jpg)$/u;
const asset = /^assets\/(?:books|book-audio|audio|words|text|dictionary)\/[\w./-]+\.(?:webp|mp3|json)$/u;

export function coursePath(key, word) {
  if (key === 'word') {
    if (typeof word !== 'string' || !/^[\p{L}\p{M}][\p{L}\p{M}’' -]{0,63}$/u.test(word)) return null;
    return '/api/word?' + new URLSearchParams({q: word});
  }
  if (typeof key !== 'string' || key.split('/').some(part => !part || part === '.' || part === '..')) return null;
  if (publicData.has(key) || media.test(key) || asset.test(key)) return '/' + key;
  return null;
}

export default async function course(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const { method, query = {} } = req;
  if (!['GET', 'HEAD'].includes(method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const path = coursePath(query.key, query.q);
  if (!path) return res.status(404).end();
  // This project uses Vercel Authentication with All Deployments protection.
  // Never make the source credential available in a development environment.
  const token = process.env.DEUTSCHWEG_MEDIA_TOKEN;
  if (!['preview', 'production'].includes(process.env.VERCEL_ENV) || !token) {
    return res.status(503).json({error: 'Ouvre le déploiement privé Deutschweg sur Vercel.'});
  }
  if (!requireSession(req,res)) return;
  const headers = new Headers({'OAI-Sites-Authorization': 'Bearer ' + token, 'Accept-Encoding':'identity'});
  const range = req.headers.range;
  if (typeof range === 'string') {
    if (!/^bytes=(?:\d+-\d*|-\d+)$/u.test(range)) return res.status(416).end();
    headers.set('Range', range);
  }
  const controller = new AbortController();
  res.once('close', () => controller.abort());
  try {
    const upstream = await fetch(origin + path, {method, headers, redirect:'manual', signal:controller.signal});
    if (![200, 206, 400, 404, 416, 503].includes(upstream.status)) {
      await upstream.body?.cancel();
      return res.status(502).json({error:'Le stockage du cours est momentanément indisponible.'});
    }
    res.status(upstream.status);
    for (const name of ['content-type','content-range','accept-ranges']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (method === 'HEAD') {
      const length = upstream.headers.get('content-length');
      if (length) res.setHeader('Content-Length', length);
      return res.end();
    }
    if (!upstream.body) return res.end();
    // Stream recordings and PDF assets. Buffering an entire recording would
    // hit the Vercel Function response size limit.
    res.flushHeaders();
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch {
    if (!res.headersSent && !res.destroyed) {
      return res.status(502).json({error:'Impossible de charger ce contenu. Réessaie dans un instant.'});
    }
    if (!res.destroyed && !res.writableEnded) res.destroy();
  }
}
