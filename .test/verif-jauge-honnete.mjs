/* Verifie que « je ne sais pas » n'est jamais compte comme une reponse.
   Contexte : la cliente a rendu un fichier a 10 reponses sur 50 en croyant avoir
   fini, parce que la jauge affichait 96 % et le sommaire « terminée ».
   Dossier .test/ : outil de dev, pas livrable. */
import { chromium } from 'playwright';

// URL_TEST permet de rejouer ces verifications sur le site en ligne :
//   URL_TEST=https://exemple.tiiny.site/ node .test/verif-jauge-honnete.mjs
const URL = process.env.URL_TEST || 'http://localhost:8777/index.html';

const resultats = [];
const ok = (n, c, d = '') => { resultats.push(!!c); console.log((c ? 'OK  ' : 'ECHEC ') + n + (d ? ' — ' + d : '')); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('.bouton--jaune');           // commencer
await page.waitForTimeout(300);

// Reference : la jauge avant tout clic (des champs peuvent etre pre-remplis
// par questions.json, ex. les cycles du repeater).
const pourcentAvant = await page.textContent('#progression-pourcent');

// Toute la partie 1 en « je ne sais pas ».
const boutons = await page.$$('.bouton-sais-pas');
for (const b of boutons) { await b.click(); await page.waitForTimeout(60); }
await page.waitForTimeout(300);

// 1. La jauge ne compte pas les « je ne sais pas ».
const pourcent = await page.textContent('#progression-pourcent');
ok('J1. Jauge inchangee apres une partie entiere mise de cote',
  pourcent.trim() === pourcentAvant.trim(),
  `${boutons.length} « je ne sais pas » : ${pourcentAvant.trim()} → ${pourcent.trim()}`);
const largeur = await page.$eval('#progression-jauge', (n) => n.style.width);
ok('J2. Barre visuelle coherente avec le texte',
  largeur === pourcent.trim().split(' ')[0] + '%', largeur + ' / ' + pourcent.trim());

// 2. Le sommaire ne dit pas « terminée ».
await page.click('#btn-sommaire'); await page.waitForTimeout(250);
const premier = await page.$eval('.sommaire__item', (n) => ({ etat: n.dataset.etat, texte: n.querySelector('.sommaire__etat').textContent }));
ok('J3. Partie mise de cote marquee « a revenir », pas « terminee »',
  premier.etat === 'a_revenir' && !/termin/i.test(premier.texte), premier.etat + ' / ' + premier.texte);
await page.click('#sommaire .bouton--discret, #sommaire button').catch(() => {});
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 3. L'export distingue « mise de cote » de « jamais atteinte ».
const md = await page.evaluate(() => construireMarkdown());
ok('J4. Export : mention « mise de côté » presente', md.includes('À COMPLÉTER (mise de côté)'),
  String((md.match(/\(mise de côté\)/g) || []).length) + ' occurrence(s)');
ok('J5. Export : mention « PAS ENCORE RÉPONDU » pour les questions jamais ouvertes',
  md.includes('PAS ENCORE RÉPONDU'),
  String((md.match(/PAS ENCORE RÉPONDU/g) || []).length) + ' occurrence(s)');
ok('J6. Les deux cas coexistent dans le meme fichier',
  md.includes('À COMPLÉTER (mise de côté)') && md.includes('PAS ENCORE RÉPONDU'));

// 4. Une vraie reponse fait bien monter la jauge.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const champ = await page.$('input[type="text"], textarea');
if (champ) { await champ.fill('Au Cocon Du Bonheur'); await page.waitForTimeout(500); }
const pourcent2 = await page.textContent('#progression-pourcent');
ok('J7. Une vraie reponse fait monter la jauge', !/^0 %/.test(pourcent2.trim()), pourcent2.trim());

await navigateur.close();
const passes = resultats.filter(Boolean).length;
console.log(`\n${passes}/${resultats.length} verifications passees`);
process.exit(passes === resultats.length ? 0 : 1);
