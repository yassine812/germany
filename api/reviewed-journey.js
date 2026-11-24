import {gunzipSync} from 'node:zlib';

export default function reviewedJourney(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method!=='GET') {
    res.setHeader('Allow','GET');
    return res.status(405).end();
  }
  const payload=process.env.DEUTSCHWEG_JOURNEY_REVIEW;
  if (!['preview','production'].includes(process.env.VERCEL_ENV) || !payload) return res.status(503).end();
  try {
    const json=gunzipSync(Buffer.from(payload,'base64'),{maxOutputLength:262144}).toString('utf8');
    JSON.parse(json);
    res.setHeader('Content-Type','application/json; charset=utf-8');
    return res.status(200).end(json);
  } catch {
    return res.status(503).end();
  }
}
