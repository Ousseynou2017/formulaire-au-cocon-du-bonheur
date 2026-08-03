/* Test de bout en bout du parcours demande. Dossier .test/ : outil de dev, pas livrable. */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'http://localhost:8777/index.html';
const OUT = '.test/captures';
fs.mkdirSync(OUT, { recursive: true });

const configFichier = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const resultats = [];
const ok = (n, c, d = '') => { resultats.push({ n, ok: !!c, d }); console.log((c ? 'OK  ' : 'ECHEC ') + n + (d ? ' — ' + d : '')); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
// Le 404 sur assets/logo.png est attendu : le fichier logo n'a pas ete fourni.
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/logo/.test(t) || /404/.test(t)) return;
  erreurs.push('console: ' + t.slice(0, 160));
});

// ------------------------------------------------- 0. config prete a l'envoi
{
  const e = configFichier.envoi || {};
  ok('0a. Endpoint renseigne (pas un marque-place)',
    /^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(e.endpoint || '') && !/REMPLACER/i.test(e.endpoint || ''),
    e.endpoint);
  const chiffres = String(e.whatsapp_secours || '').replace(/\D/g, '');
  ok('0b. Numero WhatsApp exploitable (11 a 15 chiffres, sans X)',
    chiffres.length >= 11 && chiffres.length <= 15 && !/X/i.test(e.whatsapp_secours || ''),
    'https://wa.me/' + chiffres);
}

// ---------------------------------------------------------------- 1. accueil
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const titreAccueil = await page.textContent('h1');
ok('1. Accueil affiche le titre de config.json', titreAccueil === 'Construisons votre site ensemble', titreAccueil);
ok('1b. Le nom du client vient du JSON', (await page.textContent('.surtitre')) === 'Au Cocon Du Bonheur');
await page.screenshot({ path: `${OUT}/01-accueil-390.png`, fullPage: true });

await page.click('.bouton--jaune');
await page.waitForTimeout(400);

// ------------------------------------------------- 2. confirmations section 1
const titreS1 = await page.textContent('h1');
ok('2. Section 1 affichee', titreS1.startsWith('Vérifions ce que j'), titreS1);

// valider trois confirmations d'un clic
for (const id of ['nom_exact', 'adresse', 'tel_principal']) {
  await page.click(`#q-${id} .bouton--principal`);
  await page.waitForTimeout(120);
}
const valides = await page.$$eval('.confirmation__marque', (n) => n.length);
ok('2a. Trois confirmations validees en un clic', valides === 3, `${valides} marques`);

// en corriger une
await page.click('#q-tel_secondaire .bouton--contour');
await page.waitForTimeout(200);
await page.fill('#q-tel_secondaire input.champ', '+221 77 000 00 00');
await page.waitForTimeout(500);
const corrige = await page.inputValue('#q-tel_secondaire input.champ');
ok('2b. Correction possible et prefilee', corrige === '+221 77 000 00 00');
await page.screenshot({ path: `${OUT}/02-section1-390.png`, fullPage: true });

// -------------------------------------------------- 4. "je ne sais pas" ×2
await page.click('#q-annee_ouverture .bouton-sais-pas');
await page.waitForTimeout(200);
const presse = await page.getAttribute('#q-annee_ouverture .bouton-sais-pas', 'aria-pressed');
ok('4a. Bouton "je ne sais pas" actif', presse === 'true');
ok('4b. Question marquee visuellement',
  await page.$eval('#q-annee_ouverture', (n) => n.classList.contains('question--acompleter')));

// verifier qu'un champ skippable:false n'a PAS le bouton
await page.evaluate(() => window.scrollTo(0, 0));

// -------------------------------------------------------- 3. repeater (sec 4)
await page.click('#btn-sommaire');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/03-sommaire-390.png`, fullPage: false });
const items = await page.$$('.sommaire__item');
ok('3a. Sommaire liste toutes les parties', items.length === 8, `${items.length} parties`);
await items[3].click();
await page.waitForTimeout(400);

const cyclesInit = await page.$$eval('#q-liste_cycles .repeater__entree', (n) => n.length);
ok('3b. Cycles pre-remplis depuis entrees_initiales', cyclesInit === 4, `${cyclesInit} entrees`);

page.once('dialog', (d) => d.accept());
await page.click('#q-liste_cycles .repeater__entree:nth-child(2) .bouton--discret');
await page.waitForTimeout(400);
const apresSupp = await page.$$eval('#q-liste_cycles .repeater__entree', (n) => n.length);
ok('3c. Suppression avec confirmation', apresSupp === 3, `${apresSupp} entrees`);

await page.click('#q-liste_cycles > div > .bouton--contour');
await page.waitForTimeout(400);
const apresAjout = await page.$$eval('#q-liste_cycles .repeater__entree', (n) => n.length);
ok('3d. Ajout d\'un cycle', apresAjout === 4, `${apresAjout} entrees`);
await page.fill('#champ-liste_cycles-3-nom', 'Collège');
await page.waitForTimeout(500);
const titreEntree = await page.$eval('#q-liste_cycles .repeater__entree:nth-child(4) .repeater__titre', (n) => n.textContent);
ok('3e. Titre de l\'entree suit le champ "nom"', titreEntree === 'Collège', titreEntree);
await page.screenshot({ path: `${OUT}/04-repeater-390.png`, fullPage: true });

await page.click('#q-cantine .options .option:first-child');
await page.waitForTimeout(400);

// verifier skippable: false (section photos)
await page.click('#btn-sommaire'); await page.waitForTimeout(250);
await (await page.$$('.sommaire__item'))[6].click();
await page.waitForTimeout(400);
const sansBouton = await page.$$eval('#q-autorisation_parentale .bouton-sais-pas', (n) => n.length);
ok('4c. skippable:false masque le bouton "je ne sais pas"', sansBouton === 0);
const blocsInfo = await page.$$eval('.info-bloc', (n) => n.length);
ok('4d. Blocs "info" rendus sans champ ni bouton', blocsInfo === 2, `${blocsInfo} blocs`);
await page.screenshot({ path: `${OUT}/05-photos-info-390.png`, fullPage: true });

// ------------------------------------------------ 7. pas de scroll horizontal
const debordement = await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth,
  vue: window.innerWidth,
}));
ok('7a. Aucun defilement horizontal en 390px', debordement.doc <= debordement.vue, JSON.stringify(debordement));

const barre = await page.evaluate(() => {
  const b = document.getElementById('barre-bas').getBoundingClientRect();
  return { bas: Math.round(window.innerHeight - b.bottom), h: Math.round(b.height) };
});
ok('7b. Barre d\'action collee en bas', barre.bas <= 1 && barre.h >= 44, JSON.stringify(barre));

const zonesTactiles = await page.$$eval('.bouton, .option, .champ, .sommaire__item', (nodes) =>
  nodes.filter((n) => n.getBoundingClientRect().height > 0 && n.getBoundingClientRect().height < 44).length);
ok('7c. Zones tactiles >= 44px', zonesTactiles === 0, `${zonesTactiles} trop petites`);

// ---------------------------------------------------------- 5. persistance
const avant = await page.evaluate(() => JSON.parse(localStorage.getItem('formulaire:au-cocon-du-bonheur')));
await page.close();
const page2 = await ctx.newPage();
await page2.goto(URL, { waitUntil: 'networkidle' });
await page2.waitForTimeout(600);
const messageRestau = await page2.$eval('.avis', (n) => n.textContent).catch(() => null);
ok('5a. Message de restauration affiche', !!messageRestau && messageRestau.includes('retrouvé'));
await page2.screenshot({ path: `${OUT}/06-restauration-390.png`, fullPage: true });
await page2.click('.bouton--jaune');
await page2.waitForTimeout(400);
const sectionReprise = await page2.textContent('.puce-numero');
ok('5b. Reprise a la bonne partie', sectionReprise === '7', `partie ${sectionReprise}`);
const valeurRestauree = await page2.$eval('#q-liste_cycles', () => true).catch(() => false);
await page2.click('#btn-sommaire'); await page2.waitForTimeout(250);
await (await page2.$$('.sommaire__item'))[3].click();
await page2.waitForTimeout(400);
const nomRestaure = await page2.inputValue('#champ-liste_cycles-3-nom');
ok('5c. Donnees du repeater restaurees', nomRestaure === 'Collège', nomRestaure);
const cyclesRestaures = await page2.$$eval('#q-liste_cycles .repeater__entree', (n) => n.length);
ok('5d. Suppression persistee', cyclesRestaures === 4, `${cyclesRestaures} entrees`);

// ---------------------------------------------------------- 6. export .md
const dl = await Promise.all([
  page2.waitForEvent('download'),
  page2.click('#btn-telecharger'),
]);
const chemin = `${OUT}/export.md`;
await dl[0].saveAs(chemin);
const md = fs.readFileSync(chemin, 'utf8');
ok('6a. Fichier .md telecharge', md.length > 500, `${md.length} caracteres`);
ok('6b. Titre en #', md.startsWith('# Informations pour votre nouveau site'));
ok('6c. Sections en ##', (md.match(/^## /gm) || []).length === 8);
ok('6d. Mentions "À COMPLÉTER" conservees', md.includes('À COMPLÉTER'));
ok('6e. Repeater en liste', md.includes('- **Collège**'));
ok('6f. Nom de fichier depuis le JSON + date',
  /^reponses-au-cocon-du-bonheur-\d{4}-\d{2}-\d{2}\.md$/.test(dl[0].suggestedFilename()), dl[0].suggestedFilename());

// ------------------------------------------------------------- 3bis. recap
await page2.click('#btn-sommaire'); await page2.waitForTimeout(250);
await (await page2.$$('.sommaire__item'))[7].click();
await page2.waitForTimeout(300);
await page2.click('#btn-suivant');
await page2.waitForTimeout(400);
const titreRecap = await page2.textContent('h1');
ok('R1. Ecran de recapitulatif', titreRecap.startsWith('Relisez avant d'), titreRecap);
const manques = await page2.$$eval('.manques li', (n) => n.length);
ok('R2. Manques listes en tete', manques > 0, `${manques} manques`);
const bloquant = await page2.$$eval('.manques__bloquant', (n) => n.length);
ok('R3. skippable:false signale en evidence', bloquant === 1, `${bloquant}`);
await page2.screenshot({ path: `${OUT}/07-recap-390.png`, fullPage: true });

// une ligne du recap renvoie a la question
await page2.click('.recap__ligne');
await page2.waitForTimeout(500);
ok('R4. Clic sur une ligne renvoie a la question', (await page2.textContent('.puce-numero')) === '1');

// ------------------------------------------------------------ 9. echec envoi
await page2.click('#btn-sommaire'); await page2.waitForTimeout(250);
await (await page2.$$('.sommaire__item'))[7].click();
await page2.waitForTimeout(300);
await page2.click('#btn-suivant');
await page2.waitForTimeout(400);
// Panne reseau simulee, pour ne pas dependre du vrai endpoint.
// Routage au niveau du CONTEXTE : une page controlee par le service worker
// n'est pas interceptee par page.route.
await ctx.route('**/formspree.io/**', (r) => r.abort());
await page2.click('.panneau__actions .bouton--jaune');
await page2.waitForTimeout(2000);
const titreEchec = await page2.textContent('h1');
ok('9a. Ecran d\'echec affiche', titreEchec.startsWith('L') && titreEchec.includes('pas fonctionné'), titreEchec);
const apresEchec = await page2.evaluate(() => JSON.parse(localStorage.getItem('formulaire:au-cocon-du-bonheur')));
ok('9b. Donnees intactes apres echec',
  JSON.stringify(apresEchec.reponses) === JSON.stringify(avant.reponses));
const lienWa = await page2.$eval('.lien-secours', (n) => n.getAttribute('href')).catch(() => null);
ok('9c. Lien WhatsApp de secours propose', !!lienWa && lienWa.startsWith('https://wa.me/'), lienWa);
await page2.screenshot({ path: `${OUT}/08-echec-390.png`, fullPage: true });

// ------------------------------------------------------------- 8. clavier
await page2.click('#btn-sommaire'); await page2.waitForTimeout(250);
await (await page2.$$('.sommaire__item'))[1].click();
await page2.waitForTimeout(400);
const parcoursClavier = await page2.evaluate(async () => {
  const focusables = document.querySelectorAll(
    'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])');
  return focusables.length;
});
await page2.keyboard.press('Tab');
let atteints = 0, sansAnneau = 0;
for (let i = 0; i < 25; i++) {
  const info = await page2.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const cs = getComputedStyle(a);
    const visible = a.matches(':focus-visible');
    return { tag: a.tagName, visible, outline: cs.outlineWidth };
  });
  if (info) { atteints++; if (info.visible && info.outline === '0px') sansAnneau++; }
  await page2.keyboard.press('Tab');
}
ok('8a. Navigation clavier : elements atteints', atteints >= 20, `${atteints}/25 tabulations, ${parcoursClavier} focusables`);
ok('8b. Anneau de focus visible partout', sansAnneau === 0, `${sansAnneau} sans anneau`);

// ------------------------------------------------ 10. focus : couleur et contraste
const luminance = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contraste = (a, b) => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const rgbVersHex = (rgb) => {
  const m = rgb.match(/\d+/g);
  return '#' + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('');
};

const focusInfos = await page2.evaluate(() => {
  const lire = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    n.focus();
    const cs = getComputedStyle(n);
    return { couleur: cs.outlineColor, largeur: cs.outlineWidth, decalage: cs.outlineOffset };
  };
  const vars = getComputedStyle(document.documentElement);
  return {
    champ: lire('.champ'),                    // sur fond blanc/creme
    principal: lire('.bouton--principal'),    // aplat violet
    creme: vars.getPropertyValue('--creme').trim(),
    violet: vars.getPropertyValue('--violet').trim(),
  };
});

const hexClair = rgbVersHex(focusInfos.champ.couleur);
const hexViolet = rgbVersHex(focusInfos.principal.couleur);
ok('10a. Anneau violet sur fond clair',
  hexClair.toUpperCase() === focusInfos.violet.toUpperCase(), hexClair);
ok('10b. Anneau jaune sur aplat violet',
  hexViolet.toUpperCase() === '#FFD400', hexViolet);
ok('10c. Anneau trace a l\'interieur du bouton violet',
  parseFloat(focusInfos.principal.decalage) < 0, focusInfos.principal.decalage);
const cClair = contraste(hexClair, focusInfos.creme);
const cViolet = contraste(hexViolet, focusInfos.violet);
ok('10d. Contraste anneau clair >= 3:1', cClair >= 3, cClair.toFixed(2) + ':1 contre le creme');
ok('10e. Contraste anneau violet >= 3:1', cViolet >= 3, cViolet.toFixed(2) + ':1 contre le violet');

// --------------------------------------- 11. charge utile d'envoi = le .md exact
const ctxP = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const pageP = await ctxP.newPage();
await pageP.goto(URL, { waitUntil: 'networkidle' });
await pageP.waitForTimeout(500);
await pageP.click('.bouton--jaune'); await pageP.waitForTimeout(300);
await pageP.click('#q-nom_exact .bouton--principal'); await pageP.waitForTimeout(400);

let corpsPoste = null;
let requetePostee = null;
await ctxP.route('**/formspree.io/**', async (route) => {
  const r = route.request();
  corpsPoste = r.postData();
  requetePostee = { methode: r.method(), entetes: r.headers(), url: r.url() };
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{"next":"/thanks","ok":true}' });
});

const mdTelecharge = await pageP.evaluate(() => construireMarkdown());
await pageP.click('#btn-sommaire'); await pageP.waitForTimeout(250);
await (await pageP.$$('.sommaire__item'))[7].click(); await pageP.waitForTimeout(300);
await pageP.click('#btn-suivant'); await pageP.waitForTimeout(400);
await pageP.click('.panneau__actions .bouton--jaune');
await pageP.waitForTimeout(1500);

ok('11a. Requete envoyee', !!corpsPoste);
// forme attendue par Formspree
ok('11a1. Methode POST', requetePostee && requetePostee.methode === 'POST',
  requetePostee && requetePostee.methode);
ok('11a2. Content-Type: application/json',
  requetePostee && /application\/json/.test(requetePostee.entetes['content-type'] || ''),
  requetePostee && requetePostee.entetes['content-type']);
ok('11a3. Accept: application/json',
  requetePostee && /application\/json/.test(requetePostee.entetes['accept'] || ''),
  requetePostee && requetePostee.entetes['accept']);
ok('11a4. URL = endpoint du config.json',
  requetePostee && requetePostee.url === configFichier.envoi.endpoint,
  requetePostee && requetePostee.url);
const charge = corpsPoste ? JSON.parse(corpsPoste) : {};
ok('11b. Charge utile courte (5 champs)', Object.keys(charge).length === 5, Object.keys(charge).join(', '));
ok('11c. reponses contient le .md complet', charge.reponses === mdTelecharge,
  charge.reponses ? charge.reponses.length + ' vs ' + mdTelecharge.length + ' caracteres' : 'absent');
ok('11d. _subject porte le client et la date', /^Réponses — Au Cocon Du Bonheur — \d{2}\/\d{2}\/\d{4}$/.test(charge._subject || ''), charge._subject);
ok('11e. progression lisible', /^\d+ réponses sur \d+, \d+ à compléter$/.test(charge.progression || ''), charge.progression);
ok('11f. manques : une ligne par champ requis', (charge.manques || '').split('\n').length >= 10,
  (charge.manques || '').split('\n').length + ' lignes');
ok('11g. Ecran de succes apres reponse 200', (await pageP.textContent('h1')).startsWith('C'), await pageP.textContent('h1'));

// ------------------------------------------------ 12. bandeau de persistance
const ctxB = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const pageB = await ctxB.newPage();
await pageB.goto(URL, { waitUntil: 'networkidle' });
await pageB.waitForTimeout(500);
ok('12a. Aucun bandeau au premier chargement', await pageB.isHidden('#bandeau'));
await pageB.click('.bouton--jaune'); await pageB.waitForTimeout(300);
ok('12b. Aucun bandeau tant qu\'aucune partie n\'est finie', await pageB.isHidden('#bandeau'));

// on termine la partie 1 : 9 questions, toutes mises de cote
for (let i = 0; i < 9; i++) {
  const boutons = await pageB.$$('.bouton-sais-pas');
  if (boutons[i]) { await boutons[i].click(); await pageB.waitForTimeout(120); }
}
await pageB.waitForSelector('#bandeau:not([hidden])', { timeout: 4000 }).catch(() => {});
ok('12c. Bandeau affiche apres la 1re partie complete', await pageB.isVisible('#bandeau'));
const texteBandeau = await pageB.textContent('#bandeau-texte');
ok('12d. Texte du bandeau correct', texteBandeau.includes('Télécharger mes réponses'), texteBandeau.slice(0, 40) + '…');
await pageB.screenshot({ path: `${OUT}/11-bandeau-390.png`, fullPage: false });

await pageB.click('#bandeau-fermer'); await pageB.waitForTimeout(400);
ok('12e. Bandeau fermable', await pageB.isHidden('#bandeau'));
await pageB.reload({ waitUntil: 'networkidle' }); await pageB.waitForTimeout(600);
await pageB.click('.bouton--jaune'); await pageB.waitForTimeout(400);
ok('12f. Bandeau ne revient pas apres rechargement', await pageB.isHidden('#bandeau'));

// ------------------------------------------------------------ 13. retour tardif
await pageB.evaluate(() => {
  const cle = 'formulaire:au-cocon-du-bonheur';
  const d = JSON.parse(localStorage.getItem(cle));
  d.dernierAcces = new Date(Date.now() - 6 * 86400000).toISOString();
  localStorage.setItem(cle, JSON.stringify(d));
});
await pageB.reload({ waitUntil: 'networkidle' });
await pageB.waitForTimeout(600);
const texteAvis = await pageB.textContent('.avis');
ok('13a. Message de retour tardif apres 6 jours', texteAvis.includes('Pensez à les télécharger'), texteAvis.slice(-60));
await pageB.screenshot({ path: `${OUT}/12-retour-tardif-390.png`, fullPage: false });

// retour recent : pas de rappel
await pageB.evaluate(() => {
  const cle = 'formulaire:au-cocon-du-bonheur';
  const d = JSON.parse(localStorage.getItem(cle));
  d.dernierAcces = new Date().toISOString();
  localStorage.setItem(cle, JSON.stringify(d));
});
await pageB.reload({ waitUntil: 'networkidle' });
await pageB.waitForTimeout(600);
ok('13b. Pas de rappel si le retour est recent',
  !(await pageB.textContent('.avis')).includes('Pensez à les télécharger'));

// --------------------------------------------- 14. hors connexion + file://
const ctxO = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const pageO = await ctxO.newPage();
await pageO.goto(URL, { waitUntil: 'networkidle' });
// on attend que le service worker prenne la main avant de couper le reseau
await pageO.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 8000 })
  .catch(() => {});
await pageO.waitForTimeout(600);
await pageO.click('.bouton--jaune'); await pageO.waitForTimeout(300);
await pageO.click('#q-nom_exact .bouton--principal'); await pageO.waitForTimeout(500);

await ctxO.setOffline(true);
await pageO.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await pageO.waitForTimeout(1200);
const titreHorsLigne = await pageO.textContent('h1').catch(() => null);
ok('14a. Le formulaire s\'affiche hors connexion', titreHorsLigne === 'Construisons votre site ensemble', titreHorsLigne);
await pageO.click('.bouton--jaune').catch(() => {});
await pageO.waitForTimeout(400);
const marqueHorsLigne = await pageO.$$eval('.confirmation__marque', (n) => n.length).catch(() => 0);
ok('14b. Reponses toujours la hors connexion', marqueHorsLigne === 1, `${marqueHorsLigne} validee(s)`);
await pageO.screenshot({ path: `${OUT}/13-hors-connexion-390.png`, fullPage: false });
await ctxO.setOffline(false);

const cheminFichier = 'file:///' + process.cwd().replace(/\\/g, '/') + '/index.html';
const pageF = await (await navigateur.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await pageF.goto(cheminFichier, { waitUntil: 'domcontentloaded' });
await pageF.waitForTimeout(1000);
const titreFichier = await pageF.textContent('h1').catch(() => null);
ok('14c. Le formulaire s\'affiche en file://', titreFichier === 'Construisons votre site ensemble', titreFichier);

// ------------------------------------------------------------- desktop 1440
const ctxD = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
const pageD = await ctxD.newPage();
await pageD.goto(URL, { waitUntil: 'networkidle' });
await pageD.waitForTimeout(500);
await pageD.screenshot({ path: `${OUT}/09-accueil-1440.png`, fullPage: true });
await pageD.click('.bouton--jaune');
await pageD.waitForTimeout(400);
await pageD.screenshot({ path: `${OUT}/10-section1-1440.png`, fullPage: true });
const debD = await pageD.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
ok('D1. Aucun defilement horizontal en 1440px', debD);

ok('E. Aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));

await navigateur.close();

const echecs = resultats.filter((r) => !r.ok);
console.log('\n' + (resultats.length - echecs.length) + '/' + resultats.length + ' verifications passees');
if (echecs.length) { console.log('ECHECS :'); echecs.forEach((e) => console.log(' - ' + e.n + ' ' + e.d)); process.exit(1); }
