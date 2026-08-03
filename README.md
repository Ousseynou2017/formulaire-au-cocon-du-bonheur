# Formulaire de collecte client

Formulaire statique, une page, sans backend ni build. Déployable tel quel sur Netlify ou GitHub Pages.

## Réutiliser pour un nouveau client — aucune ligne de code à toucher

1. Dupliquer ce dossier.
2. Éditer **`questions.json`** : les sections et les questions. Types disponibles : `text`, `textarea`, `number`, `tel`, `email`, `url`, `select`, `radio`, `checkbox`, `confirmation`, `info`, `repeater`. Chaque question a besoin d'un `id` unique.
3. Éditer **`config.json`** :
   - `projet` : identifiant, nom du client, titre de la page, chemin du logo ;
   - `messages` : tous les textes d'écran (accueil, récap, succès, échec…) ;
   - `envoi.endpoint` : l'URL Formspree du projet, `envoi.whatsapp_secours` : le numéro de repli ;
   - `design.couleurs` : la charte. Chaque clé devient une variable CSS `--<clé>` injectée au chargement.
4. Déposer le logo dans `assets/` au chemin indiqué par `config.projet.logo`. **PNG à fond transparent** : il s'affiche sur le fond crème. S'il manque, il est simplement masqué.
5. **Lancer `node sync-inline.mjs`** — obligatoire après toute modification d'un des deux JSON.
6. Déployer le dossier.

`localStorage` est cloisonné par `config.projet.id` : deux clients sur le même domaine ne se mélangent pas.

## Points d'attention

- **Les couleurs ne sont jamais écrites dans le CSS.** Si vous ajoutez une couleur, ajoutez-la dans `config.json → design.couleurs` et utilisez `var(--nom)`.
- **Les textes de navigation** (Précédent, Suivant, Sommaire, Validé…) ont des valeurs par défaut en haut de `app.js`, dans `TEXTES_DEFAUT`. Pour en changer un sans toucher au code, ajoutez la même clé dans `config.json → messages` : elle gagne.
- **Ne rien écrire en dur dans `index.html`** : c'est une coquille vide, tout est construit par `app.js`.

## Fonctionnement hors connexion

La cliente remplit sur téléphone, avec une connexion qui peut couper. Deux mécanismes, complémentaires :

- **Copie inline des JSON dans `index.html`** (blocs `<script type="application/json">`). `app.js` les lit en priorité et ne retombe sur `fetch` que s'ils sont vides. Permet aussi d'ouvrir la page en `file://`, sans serveur. **Les fichiers `.json` restent la source de vérité** : après les avoir modifiés, lancer `node sync-inline.mjs` pour resynchroniser. `node .test/verif-inline.mjs` vérifie que les deux correspondent.
- **`sw.js`** : met en cache la page, le CSS et le JS, pour qu'un rechargement sans réseau fonctionne. Sans lui, l'inline ne suffit pas — `index.html` lui-même viendrait du réseau. La page est servie réseau d'abord, cache en secours ; les questions restent donc à jour dès qu'il y a du réseau. **Après une mise en ligne, incrémenter `VERSION` dans `sw.js`.** Nécessite https (ou localhost) ; sans effet en `file://`, où l'inline prend le relais.

## Tests

`.test/` contient le parcours automatisé (67 vérifications) — à conserver, pas jetable. L'envoi y est simulé : rien ne part vraiment.

```bash
python -m http.server 8777        # puis, dans un autre terminal :
node .test/parcours.mjs
node .test/verif-jauge-honnete.mjs   # 7 vérifications : « je ne sais pas » ≠ rempli
node .test/verif-barre-mobile.mjs   # 18 vérifications : bouton Suivant atteignable sur téléphone
node .test/verif-navigation-prod.mjs # 10 vérifications : « Suivant » avance vraiment, aucun script tiers
```

Les trois derniers acceptent `URL_TEST` pour rejouer les vérifications sur le site en ligne :
`URL_TEST=https://ousseynou2017.github.io/formulaire-au-cocon-du-bonheur/ node .test/verif-barre-mobile.mjs`

Pour vérifier l'envoi **réel** vers Formspree (à faire une fois par projet, après avoir renseigné `envoi.endpoint`) :

```bash
node .test/envoi-reel.mjs
```

Chaque exécution dépose une vraie soumission, marquée « TEST TECHNIQUE » dans le corps du message. Le script affiche le code HTTP et la réponse JSON de Formspree — ne pas conclure sans avoir vu `200` et `{"ok":true}`.
