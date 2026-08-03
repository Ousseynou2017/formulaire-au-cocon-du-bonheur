/* Le bouton « Suivant » doit vraiment faire avancer, sur le site en ligne.
   Ne rien forcer : un clic ordinaire, comme la cliente. C'est ce test qui a
   revele qu'une banniere publicitaire de l'hebergeur interceptait le clic.
   Dossier .test/ : outil de dev, pas livrable. */
import { chromium } from 'playwright';

const ADRESSE = process.env.URL_TEST || 'http://localhost:8777/index.html';

const resultats = [];
const ok = (n, c, d = '') => { resultats.push(!!c); console.log((c ? 'OK  ' : 'ECHEC ') + n + (d ? ' — ' + d : '')); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await ctx.newPage();

const tiers = [];
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.host !== new URL(ADRESSE).host) tiers.push(u.host + u.pathname);
});

await page.goto(ADRESSE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);        // laisser le temps a un script tiers de s'injecter
await page.click('.bouton--jaune');
await page.waitForTimeout(600);

const etape = () => page.textContent('#progression-etape').then((t) => t.trim());

// Parcours des 8 parties avec un clic ordinaire, jamais force.
let precedente = await etape();
let avancees = 0;
for (let i = 1; i < 8; i++) {
  try {
    await page.click('#btn-suivant', { timeout: 5000 });
  } catch (e) {
    ok(`N${i}. Clic sur « Suivant » depuis ${precedente}`, false, 'clic bloque : ' + String(e).split('\n')[0].slice(0, 80));
    break;
  }
  await page.waitForTimeout(500);
  const courante = await etape();
  const bouge = courante !== precedente;
  ok(`N${i}. « Suivant » fait avancer — ${precedente} → ${courante}`, bouge);
  if (bouge) avancees++;
  precedente = courante;
}
ok('N8. Les 7 passages de partie fonctionnent', avancees === 7, `${avancees}/7`);

// Retour arriere.
await page.click('#btn-precedent', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(500);
ok('N9. « Précédent » fonctionne aussi', (await etape()) !== precedente, await etape());

// Aucune requete vers un tiers : ni pub, ni traceur, ni police distante.
const uniques = [...new Set(tiers)];
ok('N10. Aucune requete vers un service tiers', uniques.length === 0, uniques.join(', ') || 'aucune');

await navigateur.close();
const passes = resultats.filter(Boolean).length;
console.log(`\n${passes}/${resultats.length} verifications passees`);
process.exit(passes === resultats.length ? 0 : 1);
