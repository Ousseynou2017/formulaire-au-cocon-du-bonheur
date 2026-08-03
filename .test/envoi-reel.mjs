/**
 * Envoi REEL vers l'endpoint Formspree de config.json.
 *
 * A lancer a la main, jamais dans la suite : chaque execution depose une vraie
 * soumission dans la boite Formspree. La reponse est marquee « TEST TECHNIQUE »
 * pour etre reconnaissable.
 *
 *   python -m http.server 8777      (dans un autre terminal)
 *   node .test/envoi-reel.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'http://localhost:8777/index.html';
const MARQUEUR = 'TEST TECHNIQUE — envoi automatise de verification, a ignorer.';

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
console.log('endpoint :', config.envoi.endpoint);
console.log('methode  :', config.envoi.methode);

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await ctx.newPage();

// on observe la requete et la reponse reelles
let requete = null;
let reponse = null;
page.on('request', (r) => {
  if (!r.url().includes('formspree.io')) return;
  requete = {
    methode: r.method(),
    entetes: r.headers(),
    corps: r.postData(),
  };
});
page.on('response', (r) => {
  if (!r.url().includes('formspree.io')) return;
  reponse = { statut: r.status(), corps: '(lecture en cours)' };
  console.log('   <- reponse HTTP ' + r.status() + ' apres ' + (Date.now() - depart) + ' ms');
  r.text().then((t) => { reponse.corps = t; }).catch(() => { reponse.corps = '(illisible)'; });
});
page.on('requestfailed', (r) => {
  if (!r.url().includes('formspree.io')) return;
  console.log('   <- ECHEC RESEAU : ' + ((r.failure() || {}).errorText || '?'));
});
let depart = Date.now();

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.click('.bouton--jaune');           // Commencer
await page.waitForTimeout(400);

// parcours minimal : une confirmation validee + un choix + un texte libre marque
await page.click('#q-nom_exact .bouton--principal');
await page.waitForTimeout(200);
await page.click('#q-email_conflit .options .option:first-child');
await page.waitForTimeout(300);

await page.click('#btn-sommaire'); await page.waitForTimeout(300);
await (await page.$$('.sommaire__item'))[7].click();   // derniere partie
await page.waitForTimeout(400);
await page.fill('#champ-libre', MARQUEUR);
await page.waitForTimeout(600);

await page.click('#btn-suivant');              // -> recapitulatif
await page.waitForTimeout(500);

const mdAttendu = await page.evaluate(() => construireMarkdown());

console.log('\nenvoi en cours…');
// Formspree peut mettre plusieurs secondes a repondre : on attend le changement
// d'ecran plutot qu'un delai fixe. L'application abandonne d'elle-meme a 20 s.
depart = Date.now();
await page.click('.panneau__actions .bouton--jaune');
await page.waitForFunction(
  () => { const h = document.querySelector('h1'); return h && !h.textContent.startsWith('Relisez'); },
  { timeout: 25000 },
).catch(() => console.log('   !! toujours sur le recapitulatif apres 25 s'));
await page.waitForTimeout(800);

const titre = await page.textContent('h1');
await page.screenshot({ path: '.test/captures/16-envoi-reel.png', fullPage: false });

// ---------------------------------------------------------------- resultats
const controles = [];
const ok = (n, c, d = '') => { controles.push({ n, ok: !!c }); console.log((c ? 'OK  ' : 'ECHEC ') + n + (d ? ' — ' + d : '')); };

console.log('\n--- requete envoyee ---');
ok('methode POST', requete && requete.methode === 'POST', requete && requete.methode);
ok('Content-Type: application/json',
  requete && /application\/json/.test(requete.entetes['content-type'] || ''),
  requete && requete.entetes['content-type']);
ok('Accept: application/json',
  requete && /application\/json/.test(requete.entetes['accept'] || ''),
  requete && requete.entetes['accept']);

const charge = requete && requete.corps ? JSON.parse(requete.corps) : {};
ok('charge utile a 5 champs', Object.keys(charge).length === 5, Object.keys(charge).join(', '));
ok('reponses = le .md complet', charge.reponses === mdAttendu,
  charge.reponses ? charge.reponses.length + ' caracteres' : 'absent');
ok('marqueur de test present', (charge.reponses || '').includes(MARQUEUR));
console.log('    _subject    :', charge._subject);
console.log('    client      :', charge.client);
console.log('    progression :', charge.progression);
console.log('    manques     :', (charge.manques || '').split('\n').length, 'lignes');

console.log('\n--- reponse Formspree ---');
ok('code HTTP 200', reponse && reponse.statut === 200, reponse ? String(reponse.statut) : 'aucune reponse');
console.log('    corps :', reponse ? reponse.corps.slice(0, 300) : '(aucune)');

console.log('\n--- ecran affiche ---');
ok('ecran de succes', titre === 'C\'est envoyé, merci', titre);

// lien WhatsApp de secours : on le reconstruit comme le fait l'application
const numero = String(config.envoi.whatsapp_secours || '').replace(/\D/g, '');
const lien = 'https://wa.me/' + numero;
ok('lien WhatsApp valide (11 a 15 chiffres)', numero.length >= 11 && numero.length <= 15, lien);

await navigateur.close();

const echecs = controles.filter((c) => !c.ok);
console.log('\n' + (controles.length - echecs.length) + '/' + controles.length + ' controles passes');
if (echecs.length) process.exit(1);
