/**
 * Service worker minimal.
 *
 * Pourquoi : inliner les JSON dans index.html supprime deux requetes, mais la page
 * elle-meme (index.html, style.css, app.js) vient toujours du reseau. Sans ce
 * fichier, un rechargement en connexion coupee donne une page d'erreur du
 * navigateur. C'est le scenario a couvrir : remplissage sur telephone a Dakar,
 * connexion intermittente.
 *
 * Strategie :
 *   - page HTML  -> reseau d'abord, cache en secours. Les questions inlinees
 *                   restent donc a jour des qu'il y a du reseau.
 *   - le reste   -> cache d'abord, mise a jour en arriere-plan. Chargement
 *                   immediat meme sur connexion lente.
 *
 * Apres une mise en ligne, incrementer VERSION pour purger l'ancien cache.
 * Ne fonctionne qu'en http(s) : en file://, c'est la copie inline des JSON qui
 * prend le relais.
 */

const VERSION = 'formulaire-v4';   // v4 : bouton Suivant atteignable clavier ouvert
const FICHIERS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.json',
  './questions.json',
  './assets/logo.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Un fichier absent (logo non fourni par exemple) ne doit pas faire echouer
    // toute l'installation : on met en cache un par un.
    await Promise.all(FICHIERS.map((f) => cache.add(f).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const requete = e.request;
  if (requete.method !== 'GET') return;

  const estPage = requete.mode === 'navigate' || requete.destination === 'document';

  if (estPage) {
    e.respondWith((async () => {
      try {
        const fraiche = await fetch(requete);
        const cache = await caches.open(VERSION);
        cache.put(requete, fraiche.clone());
        return fraiche;
      } catch (err) {
        const cache = await caches.open(VERSION);
        return (await cache.match(requete)) ||
               (await cache.match('./index.html')) ||
               Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const enCache = await cache.match(requete);
    const reseau = fetch(requete)
      .then((r) => { cache.put(requete, r.clone()); return r; })
      .catch(() => null);
    return enCache || (await reseau) || Response.error();
  })());
});
