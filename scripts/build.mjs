import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

await mkdir('public', {recursive:true});
await cp('web', 'public', {recursive:true});
const files = (await readdir('web')).filter(name => /\.(html|js|css|json)$/u.test(name)).sort();
const hash = createHash('sha256');
for (const name of files) hash.update(await readFile('web/' + name));
const id = hash.digest('hex').slice(0, 16);
let html = await readFile('web/index.html', 'utf8');
html = html.replace(/(src|href)="([^"]+\.(?:css|js))"/gu, (_, attribute, name) => `${attribute}="${name}?v=${id}"`);
html = html.replace('</head>', `<script>window.DEUTSCHWEG_BUILD=${JSON.stringify(id)}</script></head>`);
await writeFile('public/index.html', html);
await writeFile('public/build.json', JSON.stringify({id}));
console.log('Deutschweg build', id);
