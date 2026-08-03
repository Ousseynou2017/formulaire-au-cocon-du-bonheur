import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [w,h,nom] of [[390,844,'m'],[1440,900,'d']]) {
  const p = await (await b.newContext({viewport:{width:w,height:h}, isMobile:w<500, hasTouch:w<500})).newPage();
  await p.goto('http://localhost:8777/index.html', {waitUntil:'networkidle'});
  await p.waitForTimeout(500);
  await p.click('.bouton--jaune'); await p.waitForTimeout(400);
  await p.screenshot({path:`.test/captures/vue-${nom}-haut.png`});
  // le titre est-il masque par l'entete collante ?
  const chevauche = await p.evaluate(() => {
    const e = document.getElementById('entete').getBoundingClientRect();
    const t = document.querySelector('.ecran-entete h1').getBoundingClientRect();
    const puce = document.querySelector('.puce-numero').getBoundingClientRect();
    return { basEntete: Math.round(e.bottom), hautPuce: Math.round(puce.top), hautTitre: Math.round(t.top) };
  });
  console.log(nom, JSON.stringify(chevauche), chevauche.hautPuce >= chevauche.basEntete ? 'OK' : 'CHEVAUCHEMENT');
  // du jaune est-il visible sans defiler ?
  await p.evaluate(() => window.scrollTo(0, 900));
  await p.waitForTimeout(300);
  await p.screenshot({path:`.test/captures/vue-${nom}-defile.png`});
  await p.close();
}
await b.close();
