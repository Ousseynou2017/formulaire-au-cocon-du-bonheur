import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true})).newPage();
const codes = [];
p.on('response', r => { if (r.url().includes('logo')) codes.push(r.status()); });
await p.goto('http://localhost:8777/index.html', {waitUntil:'networkidle'});
await p.waitForTimeout(800);
await p.click('.bouton--jaune'); await p.waitForTimeout(600);
const info = await p.evaluate(() => {
  const l = document.getElementById('logo');
  const r = l.getBoundingClientRect();
  return { cache: l.hidden, w: Math.round(r.width), h: Math.round(r.height), src: l.getAttribute('src'), alt: l.alt };
});
console.log('reponses logo :', codes.join(',') || 'aucune');
console.log('logo :', JSON.stringify(info));
await p.screenshot({path:'.test/captures/14-entete-logo.png', clip:{x:0,y:0,width:390,height:120}});
await b.close();
