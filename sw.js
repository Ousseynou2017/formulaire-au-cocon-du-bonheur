/**
 * Service worker de retrait.
 *
 * L'ancien formulaire installait un worker qui gardait index.html, app.js et
 * style.css en cache. Les telephones qui l'ont encore pourraient reafficher
 * l'ancienne page hors connexion. Ce fichier le remplace : il s'active tout de
 * suite, vide tous les caches, se desinscrit, puis recharge les onglets ouverts
 * pour qu'ils prennent la nouvelle page depuis le reseau.
 *
 * L'ancien formulaire reste disponible dans le tag ancien-formulaire-site.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.map((n) => caches.delete(n)));
    await self.registration.unregister();
    const onglets = await self.clients.matchAll({ type: 'window' });
    onglets.forEach((c) => c.navigate(c.url).catch(() => {}));
  })());
});
