/**
 * Recopie config.json et questions.json dans les blocs <script type="application/json">
 * de index.html.
 *
 * Pourquoi : la page doit s'ouvrir sans reseau (rechargement en connexion coupee)
 * et en file://. Les fichiers .json restent la source de verite ; les blocs inline
 * n'en sont qu'une copie, regeneree par ce script.
 *
 * A lancer apres CHAQUE modification d'un des deux .json :
 *   node sync-inline.mjs
 */

import fs from 'fs';

const CIBLE = 'index.html';
const PAIRES = [
  { id: 'config-inline', fichier: 'config.json' },
  { id: 'questions-inline', fichier: 'questions.json' },
];

let html = fs.readFileSync(CIBLE, 'utf8');

for (const { id, fichier } of PAIRES) {
  const brut = fs.readFileSync(fichier, 'utf8');
  JSON.parse(brut);                       // echoue tot si le JSON est invalide

  // "</" ne doit jamais apparaitre tel quel dans un <script> : la sequence
  // fermerait la balise. "\/" reste un echappement JSON valide.
  const sur = brut.replace(/<\//g, '<\\/');

  const motif = new RegExp(
    '(<script type="application/json" id="' + id + '">)[\\s\\S]*?(</script>)');
  if (!motif.test(html)) {
    console.error('Bloc introuvable dans ' + CIBLE + ' : ' + id);
    process.exit(1);
  }
  html = html.replace(motif, '$1\n' + sur.trimEnd() + '\n$2');
  console.log('injecte : ' + fichier + ' -> #' + id);
}

fs.writeFileSync(CIBLE, html);
console.log('index.html a jour.');
