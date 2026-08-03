/* Le bouton « Suivant » doit rester atteignable sur telephone, y compris pendant
   la saisie. Signale par la cliente : « je n'arrive pas a faire suivant ».
   Dossier .test/ : outil de dev, pas livrable. */
import { chromium } from 'playwright';

const URL = process.env.URL_TEST || 'http://localhost:8777/index.html';

const resultats = [];
const ok = (n, c, d = '') => { resultats.push(!!c); console.log((c ? 'OK  ' : 'ECHEC ') + n + (d ? ' — ' + d : '')); };

const navigateur = await chromium.launch();

/** Le bouton est-il visible sans avoir a faire defiler la page ? */
const mesurer = (page) => page.$eval('#btn-suivant', (n) => {
  const r = n.getBoundingClientRect();
  const s = getComputedStyle(n);
  return {
    haut: Math.round(r.top), bas: Math.round(r.bottom),
    vue: window.innerHeight,
    dansEcran: r.top >= 0 && r.bottom <= window.innerHeight + 1,
    visible: s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0,
    position: getComputedStyle(n.closest('.barre-bas')).position,
  };
});

for (const appareil of [
  { nom: 'iPhone SE 375x667', viewport: { width: 375, height: 667 } },
  { nom: 'Android 360x640', viewport: { width: 360, height: 640 } },
  { nom: 'grand tel 390x844', viewport: { width: 390, height: 844 } },
]) {
  const ctx = await navigateur.newContext({ ...appareil, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.click('.bouton--jaune');
  await page.waitForTimeout(400);

  const avant = await mesurer(page);
  ok(`${appareil.nom} — bouton visible a l'arrivee sur la partie`,
    avant.dansEcran && avant.visible, JSON.stringify(avant));

  // Saisie dans le premier champ : c'est ce que fait toute personne qui repond.
  const champ = await page.$('input[type="text"], textarea');
  if (champ) {
    await champ.click();
    await champ.type('Test');
    await page.waitForTimeout(400);
  }
  // Raison d'etre de l'ancien contournement : le champ ne doit pas finir
  // sous la barre. Le corriger ne doit pas recreer ce probleme-la.
  const champLibre = await page.evaluate(() => {
    const c = document.activeElement;
    if (!c || !c.matches('input, textarea')) return 'pas de champ actif';
    const r = c.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el === c ? 'ok' : (el ? el.className || el.tagName : 'rien');
  });
  ok(`${appareil.nom} — la barre ne recouvre pas le champ en saisie`, champLibre === 'ok', champLibre);
  const pendant = await mesurer(page);
  ok(`${appareil.nom} — bouton toujours visible PENDANT la saisie`,
    pendant.dansEcran && pendant.visible, JSON.stringify(pendant));

  // Le telephone ferme le clavier sans enlever le focus du champ.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(400);
  const apres = await mesurer(page);
  ok(`${appareil.nom} — bouton visible apres fermeture du clavier`,
    apres.dansEcran && apres.visible, JSON.stringify(apres));

  // Et il doit rester cliquable : rien ne doit le recouvrir.
  const auDessus = await page.evaluate(() => {
    const b = document.getElementById('btn-suivant');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el === b || b.contains(el) ? 'ok' : (el ? el.className || el.tagName : 'rien');
  });
  ok(`${appareil.nom} — rien ne recouvre le bouton`, auDessus === 'ok', auDessus);

  // Clavier ouvert : Playwright n'en a pas, on reproduit ce que le navigateur
  // fait alors — visualViewport retreci de 300px — et on verifie que la barre
  // remonte au-dessus, au lieu de rester cachee dessous.
  const clavier = await page.evaluate(() => {
    const vv = window.visualViewport;
    const vraieHauteur = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(vv), 'height');
    Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - 300 });
    vv.dispatchEvent(new Event('resize'));
    const r = document.getElementById('btn-suivant').getBoundingClientRect();
    const val = getComputedStyle(document.documentElement).getPropertyValue('--clavier').trim();
    Object.defineProperty(vv, 'height', vraieHauteur);
    vv.dispatchEvent(new Event('resize'));
    return { variable: val, bas: Math.round(r.bottom), limite: window.innerHeight - 300 };
  });
  ok(`${appareil.nom} — barre remontee au-dessus du clavier`,
    clavier.variable === '300px' && clavier.bas <= clavier.limite + 1, JSON.stringify(clavier));

  await ctx.close();
}

await navigateur.close();
const passes = resultats.filter(Boolean).length;
console.log(`\n${passes}/${resultats.length} verifications passees`);
process.exit(passes === resultats.length ? 0 : 1);
