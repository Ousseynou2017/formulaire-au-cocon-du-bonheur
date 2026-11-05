# Formulaires Au Cocon Du Bonheur

Pages autonomes : chacune contient son HTML, son CSS et son JS. Aucun build, aucun backend.

- **En ligne** : https://ousseynou2017.github.io/formulaire-au-cocon-du-bonheur/ (GitHub Pages, branche `main`, racine).
- **Envoi** : `POST` JSON vers Formspree (`https://formspree.io/f/xrennzzp`), champs `_subject` et `reponses` (le résumé complet en texte). Succès = HTTP 200 et `{"ok":true}`.
- **Secours** : si l'envoi échoue, la page propose WhatsApp et « Copier le texte ». Les réponses restent dans le `localStorage` du téléphone.
- **`sw.js`** : worker de retrait. Il vide les caches et se désinscrit sur les téléphones qui avaient l'ancien formulaire. Ne pas le supprimer tant que d'anciens visiteurs peuvent revenir.
- **`noindex`** : la page n'est pas indexée par les moteurs de recherche.

Depuis le 05/11, le formulaire est en 2 pages courtes, une par personne : `directrice.html` (champ `pour = directrice`, clé `localStorage` `aucocon-directrice-0511`) et `secretaire.html` (`pour = secretaire`, clé `aucocon-secretaire-0511`). `index.html` renvoie vers l'une ou l'autre. `?test` préfixe l'objet du mail par « TEST – ». Les questionnaires précédents sont gardés dans `questionnaire-precedent-1009.html`, `questionnaire-precedent-0311.html` (réunion Anna du 03/11) et `questionnaire-precedent-0411.html` (validation du 04/11).

L'ancien formulaire « site » (questions.json, config.json, app.js, style.css, tests) est conservé dans le tag `ancien-formulaire-site`.

## Tester en local

```bash
python -m http.server 8777
```

Puis ouvrir http://localhost:8777/.
