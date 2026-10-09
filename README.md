# Questionnaire de la Directrice — Au Cocon Du Bonheur

Page unique et autonome : `index.html` contient le HTML, le CSS et le JS. Aucun build, aucun backend.

- **En ligne** : https://ousseynou2017.github.io/formulaire-au-cocon-du-bonheur/ (GitHub Pages, branche `main`, racine).
- **Envoi** : `POST` JSON vers Formspree (`https://formspree.io/f/xrennzzp`), champs `_subject` et `reponses` (le résumé complet en texte). Succès = HTTP 200 et `{"ok":true}`.
- **Secours** : si l'envoi échoue, la page propose WhatsApp et « Copier le texte ». Les réponses restent dans le `localStorage` du téléphone.
- **`sw.js`** : worker de retrait. Il vide les caches et se désinscrit sur les téléphones qui avaient l'ancien formulaire. Ne pas le supprimer tant que d'anciens visiteurs peuvent revenir.
- **`noindex`** : la page n'est pas indexée par les moteurs de recherche.

La page actuelle est la **suite** du questionnaire (clé `localStorage` `aucocon-questionnaire-directrice-v2`). La première partie est conservée dans le tag `questionnaire-v1`.

L'ancien formulaire « site » (questions.json, config.json, app.js, style.css, tests) est conservé dans le tag `ancien-formulaire-site`.

## Tester en local

```bash
python -m http.server 8777
```

Puis ouvrir http://localhost:8777/.
