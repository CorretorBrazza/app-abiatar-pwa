// Injecta os metadados de PWA (manifest, theme-color, Apple) no index.html
// gerado pelo `expo export --platform web`. O manifesto e os ícones vivem em
// `public/` e são copiados para a raiz do dist pelo Expo, então só precisamos
// adicionar o <link rel="manifest"> (e metas complementares) no <head>.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = 'dist';
const indexPath = join(distDir, 'index.html');
const manifestUrl = '/manifest.json';
const themeColor = '#e53924';

const injections = [
  `<link rel="manifest" href="${manifestUrl}">`,
  `<meta name="theme-color" content="${themeColor}">`,
  `<meta name="mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="default">`,
  `<meta name="apple-mobile-web-app-title" content="Abiatar">`,
  `<link rel="apple-touch-icon" href="/icon-192.png">`,
];

const html = await readFile(indexPath, 'utf8');
const closingHead = html.lastIndexOf('</head>');
if (closingHead === -1) {
  throw new Error('index.html sem </head>: nada para injetar.');
}

const injected = injections.filter((tag) => !html.includes(tag.split('>')[0]));
if (injected.length === 0) {
  console.info('[PWA] Metadados já presentes no index.html.');
  process.exit(0);
}

const head = html.slice(0, closingHead);
const rest = html.slice(closingHead);
const withTags = `${head}${injected.join('')}${rest}`;

await writeFile(indexPath, withTags, 'utf8');
console.info('[PWA] Metadados de instalação injetados no index.html:', injected.length, 'tags.');