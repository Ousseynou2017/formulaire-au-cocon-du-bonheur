/* Verifie que les blocs inline de index.html sont bien la copie exacte des .json. */
import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

for (const [id, fichier] of [['config-inline', 'config.json'], ['questions-inline', 'questions.json']]) {
  const ouverture = '<script type="application/json" id="' + id + '">';
  const debut = html.indexOf(ouverture);
  if (debut === -1) { console.error('bloc absent : ' + id); process.exit(1); }
  const depart = debut + ouverture.length;
  const fin = html.indexOf('</script>', depart);
  const inline = JSON.parse(html.slice(depart, fin));
  const source = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const identique = JSON.stringify(inline) === JSON.stringify(source);
  console.log(id.padEnd(18), 'parse OK — identique a ' + fichier + ' :', identique);
  if (!identique) process.exit(1);
}
