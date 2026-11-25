const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'dist');
fs.writeFileSync(path.join(root, 'manifest.webmanifest'), JSON.stringify({
  id: '/', name: 'DoelTracker Roeien', short_name: 'DoelTracker', lang: 'nl',
  start_url: '/', scope: '/', display: 'standalone', background_color: '#08182B',
  theme_color: '#08182B', icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
}));
fs.writeFileSync(path.join(root, 'app-icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#08182B"/><path d="M140 125h85c105 0 155 52 155 131s-50 131-155 131h-85zm58 55v152h27c66 0 95-26 95-76s-29-76-95-76z" fill="#DCC18D"/></svg>');
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/<title>.*?<\/title>/, '<title>DoelTracker — Roeien</title>');
html = html.replace('<html lang="en">', '<html lang="nl">');
html = html.replace('</head>', '<meta name="theme-color" content="#08182B"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="DoelTracker"><meta name="description" content="Jouw persoonlijke roeilogboek met weekdoelen, kilometers en trainingen."><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/app-icon.svg" type="image/svg+xml"></head>');
fs.writeFileSync(htmlPath, html);
console.log('iPhone-beginschermmetadata toegevoegd.');
