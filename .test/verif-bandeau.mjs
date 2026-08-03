import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true})).newPage();
await p.goto('http://localhost:8777/index.html', {waitUntil:'networkidle'});
await p.waitForTimeout(700);
await p.click('.bouton--jaune'); await p.waitForTimeout(300);
for (let i=0;i<9;i++){ const bt = await p.$$('.bouton-sais-pas'); if(bt[i]){ await bt[i].click(); await p.waitForTimeout(110);} }
await p.waitForSelector('#bandeau:not([hidden])',{timeout:4000});
await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(400);
await p.screenshot({path:'.test/captures/11-bandeau-390.png', clip:{x:0,y:0,width:390,height:340}});
// retour tardif
await p.evaluate(()=>{const c='formulaire:au-cocon-du-bonheur';const d=JSON.parse(localStorage.getItem(c));d.dernierAcces=new Date(Date.now()-6*86400000).toISOString();localStorage.setItem(c,JSON.stringify(d));});
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(700);
await p.screenshot({path:'.test/captures/12-retour-tardif-390.png', clip:{x:0,y:0,width:390,height:560}});
await b.close();
