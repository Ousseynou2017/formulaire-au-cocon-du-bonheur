/* =============================================================================
   Moteur de formulaire generique.

   Ce fichier ne contient AUCUN contenu client : ni question, ni libelle metier,
   ni couleur. Il lit config.json et questions.json au chargement et construit
   l'interface a partir d'eux.

   Pour un nouveau client : dupliquer le dossier, editer les deux JSON. Rien ici.
   ========================================================================== */

'use strict';

/* -----------------------------------------------------------------------------
   Textes d'interface par defaut.
   Ce sont les seuls textes ecrits dans le code, et uniquement ceux qui ne
   dependent pas du client (navigation, actions generiques, erreurs techniques).
   Chacun est surchargeable depuis config.json -> messages, sans toucher au code :
   ajouter la cle avec la meme orthographe et elle remplace la valeur ci-dessous.
   -------------------------------------------------------------------------- */
const TEXTES_DEFAUT = {
  ui_sommaire: 'Sommaire',
  ui_sommaire_titre: 'Aller à une partie',
  ui_fermer: '✕',
  ui_precedent: 'Précédent',
  ui_suivant: 'Suivant',
  ui_terminer: 'Voir le récapitulatif',
  ui_section_sur: 'Partie {n} sur {total}',
  ui_pourcent: '{p} % rempli',
  ui_etat_intacte: 'à faire',
  ui_etat_commencee: 'commencée',
  ui_etat_terminee: 'terminée',
  ui_etat_a_revenir: 'à revenir',
  ui_requis: 'important',
  ui_confirm_ok: "C'est correct",
  ui_confirm_corriger: 'À corriger',
  ui_confirm_valide: 'Validé',
  ui_confirm_modifier: 'Modifier',
  ui_repeater_supprimer: 'Supprimer',
  ui_repeater_confirmer: 'Supprimer « {nom} » ? Cette entrée sera effacée.',
  ui_repeater_titre_defaut: 'Entrée {n}',
  ui_recap_modifier: 'Appuyez pour modifier',
  ui_recap_vide: 'Pas encore rempli',
  ui_recap_retour: 'Revenir aux questions',
  ui_manques_titre: 'À compléter avant que je puisse avancer',
  ui_manques_bloquant: 'Réponse indispensable',
  ui_envoi_encours: 'Envoi en cours…',
  ui_succes_modifier: 'Modifier mes réponses',
  ui_echec_whatsapp: "M'envoyer le fichier par WhatsApp",
  ui_echec_reessayer: 'Réessayer l’envoi',
  ui_erreur_chargement_titre: 'Le formulaire ne peut pas se charger',
  ui_erreur_chargement_texte:
    "Les questions n'ont pas pu être lues. Vos réponses déjà enregistrées ne sont " +
    "pas perdues : elles sont sur cet appareil. Reconnectez-vous une fois à internet " +
    'et rouvrez cette page, tout reviendra.',
  ui_whatsapp_message: 'Bonjour, voici mes réponses pour le site.',
  ui_evitement: 'Aller au contenu',
  ui_bandeau_persistance:
    'Vos réponses sont enregistrées sur cet appareil. Si vous vous arrêtez plusieurs ' +
    'jours, appuyez sur « Télécharger mes réponses » pour en garder une copie.',
  ui_retour_tardif:
    'Vos réponses sont bien là. Pensez à les télécharger si vous vous arrêtez à nouveau longtemps.',
  ui_bandeau_fermer: 'Fermer ce message',
};

const A_COMPLETER = 'À COMPLÉTER';
/* Deux absences de reponse bien differentes a l'export : la question ouverte puis
   mise de cote (« je ne sais pas ») et la question jamais atteinte. */
const EXPORT_MISE_DE_COTE = A_COMPLETER + ' (mise de côté)';
const EXPORT_SANS_REPONSE = 'PAS ENCORE RÉPONDU';
const DELAI_SAUVEGARDE = 300;

/* -----------------------------------------------------------------------------
   Etat
   -------------------------------------------------------------------------- */
let config = null;
let questions = null;
let T = {};                 // textes fusionnes : defauts + config.messages
let cleStockage = '';

const etat = {
  ecran: 'accueil',         // accueil | section | recap | succes | echec
  section: 0,
  reponses: {},             // { idQuestion: valeur }
  confirmations: {},        // { idQuestion: 'valide' | 'edition' }
  envoye: false,
  restaure: false,
  bandeauVu: false,         // le rappel « pensez a telecharger » n'est montre qu'une fois
  retourTardif: false,      // vrai si la derniere visite date de plus de JOURS_RETOUR_TARDIF
};

/* Au-dela de ce delai, on rappelle a la cliente de telecharger une copie :
   certains navigateurs mobiles effacent le stockage local apres une periode
   d'inactivite (environ 7 jours sur Safari iOS). */
const JOURS_RETOUR_TARDIF = 5;

/* -----------------------------------------------------------------------------
   Raccourcis DOM
   -------------------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const el = (balise, classe, texte) => {
  const n = document.createElement(balise);
  if (classe) n.className = classe;
  if (texte !== undefined) n.textContent = texte;
  return n;
};
const remplir = (modele, valeurs) =>
  String(modele).replace(/\{(\w+)\}/g, (_, k) => (valeurs[k] !== undefined ? valeurs[k] : ''));

/* -----------------------------------------------------------------------------
   Chargement et injection du design
   -------------------------------------------------------------------------- */
/**
 * Lit un bloc <script type="application/json"> inline s'il est present et non vide.
 * C'est la copie embarquee des fichiers .json : elle rend la page utilisable hors
 * connexion et en file://. Les fichiers .json restent la source de verite,
 * resynchronisee par sync-inline.mjs.
 */
function lireInline(id) {
  const noeud = document.getElementById(id);
  if (!noeud) return null;
  const texte = noeud.textContent.trim();
  if (!texte) return null;
  try { return JSON.parse(texte); } catch (e) { return null; }
}

async function chargerDonnees(idInline, fichier) {
  const inline = lireInline(idInline);
  if (inline) return inline;
  const reponse = await fetch(fichier);
  return reponse.json();
}

async function charger() {
  const [c, q] = await Promise.all([
    chargerDonnees('config-inline', 'config.json'),
    chargerDonnees('questions-inline', 'questions.json'),
  ]);
  config = c;
  questions = q;
  T = Object.assign({}, TEXTES_DEFAUT, config.messages || {});
  cleStockage = 'formulaire:' + (config.projet && config.projet.id ? config.projet.id : 'sans-id');
}

/** Toutes les couleurs, polices et formes du JSON deviennent des variables CSS. */
function injecterDesign() {
  const d = config.design || {};
  const racine = document.documentElement.style;

  Object.entries(d.couleurs || {}).forEach(([nom, valeur]) => {
    racine.setProperty('--' + nom, valeur);
  });

  const typo = d.typographie || {};
  racine.setProperty('--police-titres', typo.titres || 'system-ui, sans-serif');
  racine.setProperty('--police-corps', typo.corps || 'system-ui, sans-serif');
  racine.setProperty('--graisse-titre', String(typo.graisse_titre || 700));
  racine.setProperty('--interlignage-titre', String(typo.interlignage_titre || 1.2));
  racine.setProperty('--interlignage-corps', String(typo.interlignage_corps || 1.6));

  const formes = d.formes || {};
  racine.setProperty('--rayon', formes.rayon || '4px');
  racine.setProperty('--transition', formes.transition || '180ms ease');

  injecterFocus((d.roles || {}).focus);

  document.documentElement.lang = (config.projet && config.projet.langue) || 'fr';
  document.title = (config.projet && config.projet.titre_page) || document.title;

  // La couleur de la barre du navigateur mobile vient elle aussi du JSON.
  const couleurTheme = (d.couleurs || {}).violet;
  if (couleurTheme) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = couleurTheme;
    document.head.appendChild(meta);
  }
}

/**
 * Couleur de l'anneau de focus. Deux formes acceptees dans design.roles.focus :
 *   - un objet { sur_fond_clair, sur_fond_violet }  (forme recommandee)
 *   - une chaine unique, pour rester compatible avec un config.json plus ancien.
 * L'anneau doit contraster avec le fond qu'il touche : une seule couleur ne peut
 * pas convenir aux deux, d'ou l'avertissement.
 */
function injecterFocus(focus) {
  const racine = document.documentElement.style;
  let clair = 'violet';
  let surViolet = 'jaune';

  if (typeof focus === 'string' && focus) {
    clair = focus;
    surViolet = focus;
    console.warn(
      '[formulaire] design.roles.focus est une couleur unique (« ' + focus + ' »). ' +
      'Elle sera utilisee sur fond clair ET sur fond violet ; verifiez le contraste. ' +
      'Forme recommandee : { "sur_fond_clair": "...", "sur_fond_violet": "..." }.');
  } else if (focus && typeof focus === 'object') {
    clair = focus.sur_fond_clair || clair;
    surViolet = focus.sur_fond_violet || surViolet;
  }

  racine.setProperty('--focus-clair', 'var(--' + clair + ')');
  racine.setProperty('--focus-violet', 'var(--' + surViolet + ')');
}

/* -----------------------------------------------------------------------------
   Persistance
   -------------------------------------------------------------------------- */
let minuteurSauvegarde = null;

function sauvegarder() {
  clearTimeout(minuteurSauvegarde);
  minuteurSauvegarde = setTimeout(() => {
    try {
      localStorage.setItem(cleStockage, JSON.stringify({
        reponses: etat.reponses,
        confirmations: etat.confirmations,
        section: etat.section,
        ecran: etat.ecran === 'accueil' ? 'accueil' : 'section',
        envoye: etat.envoye,
        bandeauVu: etat.bandeauVu,
        dernierAcces: new Date().toISOString(),
      }));
    } catch (e) {
      /* Quota plein ou navigation privee : on continue sans bloquer la saisie. */
    }
  }, DELAI_SAUVEGARDE);
}

function restaurer() {
  let brut = null;
  try { brut = localStorage.getItem(cleStockage); } catch (e) { return false; }
  if (!brut) return false;
  try {
    const d = JSON.parse(brut);
    etat.reponses = d.reponses || {};
    etat.confirmations = d.confirmations || {};
    etat.section = typeof d.section === 'number' ? d.section : 0;
    etat.envoye = !!d.envoye;
    etat.bandeauVu = !!d.bandeauVu;
    etat.restaure = Object.keys(etat.reponses).length > 0;

    // Retour apres une longue absence : on compare a la date du passage precedent.
    if (d.dernierAcces && etat.restaure) {
      const jours = (Date.now() - new Date(d.dernierAcces).getTime()) / 86400000;
      etat.retourTardif = jours >= JOURS_RETOUR_TARDIF;
    }
    return etat.restaure;
  } catch (e) {
    return false;
  }
}

/** Les repeaters partent des entrees pre-remplies, seulement au tout premier chargement. */
function initialiserRepeaters() {
  parcourirQuestions((q) => {
    if (q.type !== 'repeater') return;
    if (Array.isArray(etat.reponses[q.id])) return;
    etat.reponses[q.id] = JSON.parse(JSON.stringify(q.entrees_initiales || []));
  });
}

/* -----------------------------------------------------------------------------
   Helpers de contenu
   -------------------------------------------------------------------------- */
const sections = () => questions.sections || [];

function parcourirQuestions(fn) {
  sections().forEach((s, is) => (s.questions || []).forEach((q) => fn(q, s, is)));
}

/** Questions qui collectent une donnee (les blocs "info" n'en sont pas). */
const estChamp = (q) => q.type !== 'info';

function estRempli(q) {
  const v = etat.reponses[q.id];
  if (q.type === 'repeater') {
    return Array.isArray(v) && v.some((e) => Object.values(e || {}).some((x) => String(x || '').trim() !== ''));
  }
  if (Array.isArray(v)) return v.length > 0;
  return String(v === undefined || v === null ? '' : v).trim() !== '';
}

const estACompleter = (q) => etat.reponses[q.id] === A_COMPLETER;

/**
 * remplis   : questions traitees, « je ne sais pas » compris -> sert au bandeau.
 * repondues : vraies reponses, hors « À COMPLÉTER » -> jauge et message d'envoi.
 *
 * La jauge se cale sur `repondues` : une jauge qui compte « je ne sais pas »
 * comme rempli annonce 96 % a quelqu'un qui n'a repondu qu'a 20 % des questions.
 */
function progression() {
  let total = 0, remplis = 0, repondues = 0;
  parcourirQuestions((q) => {
    if (!estChamp(q)) return;
    total++;
    if (!estRempli(q)) return;
    remplis++;
    if (!estACompleter(q)) repondues++;
  });
  return { total, remplis, repondues, pourcent: total ? Math.round((repondues / total) * 100) : 0 };
}

/** Toutes les questions traitees, « je ne sais pas » compris. */
function partieTraitee(s) {
  const champs = (s.questions || []).filter(estChamp);
  return champs.length ? champs.every(estRempli) : true;
}

function etatSection(s) {
  const champs = (s.questions || []).filter(estChamp);
  if (!champs.length) return 'terminee';
  const n = champs.filter(estRempli).length;
  if (n === 0) return 'intacte';
  if (n < champs.length) return 'commencee';
  // Tout est traite, mais il reste des « je ne sais pas » : pas terminee.
  return champs.some(estACompleter) ? 'a_revenir' : 'terminee';
}

/* -----------------------------------------------------------------------------
   Enregistrement d'une reponse
   -------------------------------------------------------------------------- */
function definirReponse(id, valeur, blocQuestion) {
  etat.reponses[id] = valeur;
  sauvegarder();
  majProgression();
  majBandeau();
  if (blocQuestion) majEtatVisuel(blocQuestion, id);
  majSommaire();
}

function majEtatVisuel(bloc, id) {
  const q = trouverQuestion(id);
  if (!q) return;
  bloc.classList.toggle('question--acompleter', estACompleter(q));
  bloc.classList.toggle('question--repondue', estRempli(q) && !estACompleter(q));
}

function trouverQuestion(id) {
  let trouvee = null;
  parcourirQuestions((q) => { if (q.id === id) trouvee = q; });
  return trouvee;
}

/* -----------------------------------------------------------------------------
   Construction des champs
   -------------------------------------------------------------------------- */

/** Champ simple : text, textarea, number, tel, email, url, select. */
function champSimple(q, bloc) {
  const id = 'champ-' + q.id;
  let noeud;

  if (q.type === 'textarea') {
    noeud = el('textarea', 'champ');
    noeud.rows = 4;
    noeud.addEventListener('input', () => ajusterHauteur(noeud));
  } else if (q.type === 'select') {
    noeud = el('select', 'champ');
    noeud.appendChild(el('option', null, ''));
    (q.options || []).forEach((o) => {
      const opt = el('option', null, o);
      opt.value = o;
      noeud.appendChild(opt);
    });
  } else {
    noeud = el('input', 'champ');
    noeud.type = q.type === 'number' ? 'number' : q.type === 'tel' ? 'tel'
      : q.type === 'email' ? 'email' : q.type === 'url' ? 'url' : 'text';
    // Clavier numerique sur telephone
    if (q.type === 'number') noeud.inputMode = 'numeric';
    if (q.type === 'tel') noeud.inputMode = 'tel';
    if (q.type === 'email') noeud.inputMode = 'email';
    if (q.type === 'url') noeud.inputMode = 'url';
  }

  noeud.id = id;
  const valeur = etat.reponses[q.id];
  noeud.value = valeur === A_COMPLETER ? '' : (valeur || '');
  noeud.addEventListener('input', () => definirReponse(q.id, noeud.value, bloc));
  if (q.type === 'textarea') requestAnimationFrame(() => ajusterHauteur(noeud));
  return { noeud, pourLabel: id };
}

function ajusterHauteur(zone) {
  zone.style.height = 'auto';
  zone.style.height = Math.max(zone.scrollHeight, 104) + 'px';
}

/** Groupe radio ou cases a cocher : ligne entiere cliquable. */
function champChoix(q, bloc) {
  const groupe = el('fieldset', 'groupe');
  const legende = el('legend', 'lecteur-seul', q.label);
  groupe.appendChild(legende);

  const liste = el('div', 'options');
  const multiple = q.type === 'checkbox';
  const valeur = etat.reponses[q.id];
  const cochees = multiple ? (Array.isArray(valeur) ? valeur : []) : [];

  (q.options || []).forEach((option, i) => {
    const ligne = el('label', 'option');
    const entree = el('input');
    entree.type = multiple ? 'checkbox' : 'radio';
    entree.name = q.id;
    entree.value = option;
    entree.id = 'champ-' + q.id + '-' + i;
    entree.checked = multiple ? cochees.includes(option) : valeur === option;

    entree.addEventListener('change', () => {
      if (multiple) {
        const choisies = Array.from(liste.querySelectorAll('input:checked')).map((n) => n.value);
        definirReponse(q.id, choisies, bloc);
      } else {
        definirReponse(q.id, entree.value, bloc);
      }
    });

    ligne.appendChild(entree);
    ligne.appendChild(el('span', null, option));
    liste.appendChild(ligne);
  });

  groupe.appendChild(liste);
  return { noeud: groupe, pourLabel: null };
}

/**
 * Type "confirmation" : valide une information deja connue sans la faire retaper.
 * Trois etats : proposition (deux boutons) / validee (marque + modifiable) / edition.
 */
function champConfirmation(q, bloc) {
  const conteneur = el('div');

  const dessiner = () => {
    conteneur.textContent = '';
    const mode = etat.confirmations[q.id];

    if (mode === 'valide') {
      const ligne = el('div', 'confirmation__valide');
      const valeur = el('span', 'confirmation__valeur');
      valeur.textContent = etat.reponses[q.id];
      valeur.style.flex = '1 1 100%';
      ligne.appendChild(valeur);
      ligne.appendChild(el('span', 'confirmation__marque', T.ui_confirm_valide));

      const modifier = el('button', 'bouton bouton--discret', T.ui_confirm_modifier);
      modifier.type = 'button';
      modifier.addEventListener('click', () => {
        etat.confirmations[q.id] = 'edition';
        sauvegarder();
        dessiner();
      });
      ligne.appendChild(modifier);
      conteneur.appendChild(ligne);
      return;
    }

    if (mode === 'edition') {
      const id = 'champ-' + q.id;
      const champ = el('input', 'champ');
      champ.type = 'text';
      champ.id = id;
      const v = etat.reponses[q.id];
      champ.value = (v === undefined || v === A_COMPLETER) ? (q.valeur || '') : v;
      champ.addEventListener('input', () => definirReponse(q.id, champ.value, bloc));
      conteneur.appendChild(champ);
      definirReponse(q.id, champ.value, bloc);
      requestAnimationFrame(() => champ.focus());
      return;
    }

    // Etat initial : on montre la valeur connue, en evidence.
    conteneur.appendChild(el('span', 'confirmation__valeur', q.valeur || ''));
    const actions = el('div', 'confirmation__actions');

    const ok = el('button', 'bouton bouton--principal', T.ui_confirm_ok);
    ok.type = 'button';
    ok.addEventListener('click', () => {
      etat.confirmations[q.id] = 'valide';
      definirReponse(q.id, q.valeur || '', bloc);
      dessiner();
    });

    const corriger = el('button', 'bouton bouton--contour', T.ui_confirm_corriger);
    corriger.type = 'button';
    corriger.addEventListener('click', () => {
      etat.confirmations[q.id] = 'edition';
      dessiner();
    });

    actions.appendChild(ok);
    actions.appendChild(corriger);
    conteneur.appendChild(actions);
  };

  dessiner();
  return { noeud: conteneur, pourLabel: null, redessiner: dessiner };
}

/** Type "repeater" : groupe de sous-champs repetable. */
function champRepeater(q, bloc) {
  const conteneur = el('div');
  const liste = el('div');
  conteneur.appendChild(liste);

  const entrees = () => (Array.isArray(etat.reponses[q.id]) ? etat.reponses[q.id] : []);

  const dessiner = () => {
    liste.textContent = '';
    entrees().forEach((entree, index) => {
      const carte = el('div', 'repeater__entree');

      const entete = el('div', 'repeater__entete');
      const nom = String(entree.nom || '').trim();
      entete.appendChild(el('h3', 'repeater__titre',
        nom || remplir(T.ui_repeater_titre_defaut, { n: index + 1 })));

      const supprimer = el('button', 'bouton bouton--discret', T.ui_repeater_supprimer);
      supprimer.type = 'button';
      supprimer.addEventListener('click', () => {
        const etiquette = nom || remplir(T.ui_repeater_titre_defaut, { n: index + 1 });
        if (!window.confirm(remplir(T.ui_repeater_confirmer, { nom: etiquette }))) return;
        entrees().splice(index, 1);
        definirReponse(q.id, entrees(), bloc);
        dessiner();
      });
      entete.appendChild(supprimer);
      carte.appendChild(entete);

      (q.champs || []).forEach((sous) => {
        const enveloppe = el('div', 'repeater__champ');
        const idSous = 'champ-' + q.id + '-' + index + '-' + sous.id;

        const etiquette = el('label', 'repeater__label', sous.label || sous.id);
        etiquette.htmlFor = idSous;
        enveloppe.appendChild(etiquette);

        let noeud;
        if (sous.type === 'textarea') {
          noeud = el('textarea', 'champ');
          noeud.rows = 4;
          noeud.addEventListener('input', () => ajusterHauteur(noeud));
        } else {
          noeud = el('input', 'champ');
          noeud.type = sous.type === 'number' ? 'number' : sous.type === 'tel' ? 'tel' : 'text';
          if (sous.type === 'number') noeud.inputMode = 'numeric';
          if (sous.type === 'tel') noeud.inputMode = 'tel';
        }
        noeud.id = idSous;
        noeud.value = entree[sous.id] || '';
        noeud.addEventListener('input', () => {
          entree[sous.id] = noeud.value;
          definirReponse(q.id, entrees(), bloc);
          if (sous.id === 'nom') {
            entete.querySelector('.repeater__titre').textContent =
              noeud.value.trim() || remplir(T.ui_repeater_titre_defaut, { n: index + 1 });
          }
        });
        enveloppe.appendChild(noeud);

        if (sous.aide) enveloppe.appendChild(el('span', 'exemple', sous.aide));
        else if (sous.exemple) enveloppe.appendChild(el('span', 'exemple', sous.exemple));

        carte.appendChild(enveloppe);
        if (sous.type === 'textarea') requestAnimationFrame(() => ajusterHauteur(noeud));
      });

      liste.appendChild(carte);
    });
  };

  const ajouter = el('button', 'bouton bouton--contour', q.bouton_ajouter || '+');
  ajouter.type = 'button';
  ajouter.style.width = '100%';
  ajouter.addEventListener('click', () => {
    entrees().push({});
    definirReponse(q.id, entrees(), bloc);
    dessiner();
    const cartes = liste.querySelectorAll('.repeater__entree');
    const derniere = cartes[cartes.length - 1];
    if (derniere) {
      const premier = derniere.querySelector('.champ');
      if (premier) premier.focus();
    }
  });

  dessiner();
  conteneur.appendChild(ajouter);
  return { noeud: conteneur, pourLabel: null };
}

/* -----------------------------------------------------------------------------
   Construction d'une question complete
   -------------------------------------------------------------------------- */
function construireBlocInfo(q) {
  const bloc = el('div', 'info-bloc');
  bloc.id = 'q-' + q.id;
  if (q.label) bloc.appendChild(el('h3', 'info-bloc__titre', q.label));
  if (q.contenu) bloc.appendChild(el('p', 'info-bloc__contenu', q.contenu));
  return bloc;
}

function construireQuestion(q) {
  if (q.type === 'info') return construireBlocInfo(q);

  const bloc = el('section', 'question');
  bloc.id = 'q-' + q.id;

  const enTete = el('div');
  const etiquette = el(q.type === 'radio' || q.type === 'checkbox' ? 'p' : 'label', 'question__label');
  etiquette.textContent = q.label || q.id;
  if (q.requis) etiquette.appendChild(el('span', 'question__requis', T.ui_requis));
  enTete.appendChild(etiquette);
  // Marque visible quand la question a ete mise de cote : le seul liseré de
  // couleur ne suffit pas a le comprendre d'un coup d'oeil.
  if (estACompleter(q)) enTete.appendChild(el('span', 'marque-acompleter', A_COMPLETER));
  bloc.appendChild(enTete);

  let idAide = null;
  if (q.aide) {
    const aide = el('p', 'question__aide', q.aide);
    idAide = 'aide-' + q.id;
    aide.id = idAide;
    bloc.appendChild(aide);
  }

  let rendu;
  if (q.type === 'confirmation') rendu = champConfirmation(q, bloc);
  else if (q.type === 'repeater') rendu = champRepeater(q, bloc);
  else if (q.type === 'radio' || q.type === 'checkbox') rendu = champChoix(q, bloc);
  else rendu = champSimple(q, bloc);

  if (rendu.pourLabel && etiquette.tagName === 'LABEL') etiquette.htmlFor = rendu.pourLabel;
  // Le texte d'aide est rattache au champ pour etre lu par les lecteurs d'ecran.
  if (idAide) {
    const cible = rendu.noeud.matches('fieldset, input, textarea, select')
      ? rendu.noeud
      : rendu.noeud.querySelector('input, textarea, select');
    if (cible) cible.setAttribute('aria-describedby', idAide);
  }
  bloc.appendChild(rendu.noeud);

  if (q.exemple) bloc.appendChild(el('span', 'exemple', q.exemple));

  // Bouton "Je ne sais pas" : jamais sur un bloc info, jamais si skippable === false.
  if (q.skippable !== false) {
    const passer = el('button', 'bouton bouton--discret bouton-sais-pas', T.je_ne_sais_pas);
    passer.type = 'button';
    passer.setAttribute('aria-pressed', String(estACompleter(q)));
    passer.addEventListener('click', () => {
      const actif = estACompleter(q);
      if (actif) {
        etat.reponses[q.id] = q.type === 'checkbox' ? [] : '';
      } else {
        etat.reponses[q.id] = A_COMPLETER;
        if (q.type === 'confirmation') etat.confirmations[q.id] = undefined;
      }
      passer.setAttribute('aria-pressed', String(!actif));
      sauvegarder();
      majProgression();
      majBandeau();
      majSommaire();
      // On redessine la question pour vider les champs affiches.
      const frais = construireQuestion(q);
      bloc.replaceWith(frais);
    });
    bloc.appendChild(passer);
  }

  majEtatVisuel(bloc, q.id);
  return bloc;
}

/* -----------------------------------------------------------------------------
   Ecrans
   -------------------------------------------------------------------------- */
function annoncer(texte) { $('annonce').textContent = texte; }

function rendre() {
  const zone = $('ecran');
  zone.textContent = '';
  const enSection = etat.ecran === 'section';

  $('entete').hidden = etat.ecran === 'accueil';
  $('progression').hidden = !enSection;
  $('barre-bas').hidden = !enSection;
  $('pied').hidden = etat.ecran === 'succes';

  if (etat.ecran === 'accueil') zone.appendChild(ecranAccueil());
  else if (etat.ecran === 'section') zone.appendChild(ecranSection());
  else if (etat.ecran === 'recap') zone.appendChild(ecranRecap());
  else if (etat.ecran === 'succes') zone.appendChild(ecranSucces());
  else if (etat.ecran === 'echec') zone.appendChild(ecranEchec());

  majProgression();
  majBandeau();
  window.scrollTo(0, 0);
}

function ecranAccueil() {
  const frag = document.createDocumentFragment();
  const panneau = el('div', 'panneau');
  panneau.appendChild(el('span', 'surtitre', config.projet.client || ''));
  panneau.appendChild(el('h1', null, T.accueil_titre || ''));
  panneau.appendChild(el('p', 'panneau__texte', T.accueil_texte || ''));

  if (etat.restaure && T.restauration) {
    const avis = el('div', 'avis');
    avis.appendChild(el('p', null, T.restauration));
    // Retour apres une longue absence : rappel de garder une copie.
    if (etat.retourTardif) avis.appendChild(el('p', null, T.ui_retour_tardif));
    panneau.appendChild(avis);
  }

  const actions = el('div', 'panneau__actions');
  const commencer = el('button', 'bouton bouton--jaune', T.accueil_bouton || '');
  commencer.type = 'button';
  commencer.addEventListener('click', () => {
    etat.ecran = 'section';
    sauvegarder();
    rendre();
    $('zone-principale').focus({ preventScroll: true });
  });
  actions.appendChild(commencer);
  panneau.appendChild(actions);

  frag.appendChild(panneau);
  annoncer(T.accueil_titre || '');
  return frag;
}

function ecranSection() {
  const s = sections()[etat.section];
  const frag = document.createDocumentFragment();

  const enTete = el('header', 'ecran-entete');
  enTete.appendChild(el('span', 'puce-numero', String(etat.section + 1)));
  enTete.appendChild(el('h1', null, s.titre || ''));
  frag.appendChild(enTete);

  if (s.intro) {
    const intro = el('div', 'intro');
    intro.appendChild(el('p', null, s.intro));
    frag.appendChild(intro);
  }

  (s.questions || []).forEach((q) => frag.appendChild(construireQuestion(q)));

  const derniere = etat.section === sections().length - 1;
  $('btn-precedent').textContent = T.ui_precedent;
  $('btn-precedent').disabled = etat.section === 0;
  $('btn-suivant').textContent = derniere ? T.ui_terminer : T.ui_suivant;

  annoncer(remplir(T.ui_section_sur, { n: etat.section + 1, total: sections().length }) + ' — ' + (s.titre || ''));
  return frag;
}

function ecranRecap() {
  const frag = document.createDocumentFragment();
  frag.appendChild(el('h1', null, T.recap_titre || ''));
  if (T.recap_texte) frag.appendChild(el('p', null, T.recap_texte));

  // Manques en tete : d'abord les reponses indispensables, puis les "important" vides.
  const bloquants = [], manquants = [];
  parcourirQuestions((q, s) => {
    if (!estChamp(q)) return;
    const vide = !estRempli(q) || estACompleter(q);
    if (!vide) return;
    if (q.skippable === false) bloquants.push({ q, s });
    else if (q.requis) manquants.push({ q, s });
  });

  if (bloquants.length || manquants.length) {
    const bloc = el('div', 'manques');
    bloc.appendChild(el('h2', null, T.ui_manques_titre));
    const liste = el('ul');
    bloquants.forEach(({ q, s }) => {
      const li = el('li', 'manques__bloquant');
      li.textContent = (q.label || q.id) + ' — ' + T.ui_manques_bloquant;
      liste.appendChild(li);
    });
    manquants.forEach(({ q, s }) => liste.appendChild(el('li', null, q.label || q.id)));
    bloc.appendChild(liste);
    frag.appendChild(bloc);
  }

  sections().forEach((s, is) => {
    const champs = (s.questions || []).filter(estChamp);
    if (!champs.length) return;
    const bloc = el('div', 'recap__section');
    bloc.appendChild(el('h3', null, s.titre || ''));

    champs.forEach((q) => {
      const ligne = el('button', 'recap__ligne');
      ligne.type = 'button';
      ligne.setAttribute('aria-label', (q.label || q.id) + ' — ' + T.ui_recap_modifier);
      ligne.appendChild(el('span', 'recap__q', q.label || q.id));

      const texte = formaterReponse(q);
      const reponse = el('span', texte ? 'recap__r' : 'recap__r recap__r--vide',
        texte || T.ui_recap_vide);
      ligne.appendChild(reponse);

      ligne.addEventListener('click', () => allerA(is, q.id));
      bloc.appendChild(ligne);
    });
    frag.appendChild(bloc);
  });

  const actions = el('div', 'panneau__actions');
  const envoyer = el('button', 'bouton bouton--jaune', T.envoi_bouton || '');
  envoyer.type = 'button';
  envoyer.addEventListener('click', () => lancerEnvoi(envoyer));
  actions.appendChild(envoyer);

  const retour = el('button', 'bouton bouton--contour', T.ui_recap_retour);
  retour.type = 'button';
  retour.addEventListener('click', () => { etat.ecran = 'section'; rendre(); });
  actions.appendChild(retour);
  frag.appendChild(actions);

  annoncer(T.recap_titre || '');
  return frag;
}

function ecranSucces() {
  const panneau = el('div', 'panneau');
  panneau.appendChild(el('h1', null, T.succes_titre || ''));
  panneau.appendChild(el('p', 'panneau__texte', T.succes_texte || ''));

  const actions = el('div', 'panneau__actions');
  const modifier = el('button', 'bouton bouton--contour', T.ui_succes_modifier);
  modifier.type = 'button';
  modifier.addEventListener('click', () => { etat.ecran = 'section'; rendre(); });
  actions.appendChild(modifier);

  const telecharger = el('button', 'bouton bouton--jaune', T.telecharger_bouton || '');
  telecharger.type = 'button';
  telecharger.addEventListener('click', telechargerMarkdown);
  actions.appendChild(telecharger);

  panneau.appendChild(actions);
  annoncer(T.succes_titre || '');
  return panneau;
}

function ecranEchec() {
  const panneau = el('div', 'panneau');
  panneau.appendChild(el('h1', null, T.echec_titre || ''));
  panneau.appendChild(el('p', 'panneau__texte', T.echec_texte || ''));

  const actions = el('div', 'panneau__actions');

  const telecharger = el('button', 'bouton bouton--jaune', T.telecharger_bouton || '');
  telecharger.type = 'button';
  telecharger.addEventListener('click', telechargerMarkdown);
  actions.appendChild(telecharger);

  const numero = String((config.envoi && config.envoi.whatsapp_secours) || '').replace(/\D/g, '');
  if (numero) {
    const lien = el('a', 'bouton bouton--contour lien-secours', T.ui_echec_whatsapp);
    lien.href = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(T.ui_whatsapp_message);
    lien.target = '_blank';
    lien.rel = 'noopener';
    actions.appendChild(lien);
  }

  const reessayer = el('button', 'bouton bouton--contour', T.ui_echec_reessayer);
  reessayer.type = 'button';
  reessayer.addEventListener('click', () => { etat.ecran = 'recap'; rendre(); });
  actions.appendChild(reessayer);

  panneau.appendChild(actions);
  annoncer(T.echec_titre || '');
  return panneau;
}

/* -----------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */
function allerA(indexSection, idQuestion) {
  etat.section = indexSection;
  etat.ecran = 'section';
  sauvegarder();
  rendre();
  if (idQuestion) {
    const cible = $('q-' + idQuestion);
    if (cible) {
      cible.scrollIntoView({ block: 'center' });
      const premier = cible.querySelector('.champ, input, button');
      if (premier) premier.focus();
    }
  } else {
    $('zone-principale').focus({ preventScroll: true });
  }
}

/**
 * Le rappel n'apparait pas au premier chargement : tant qu'elle n'a rien saisi,
 * elle n'a rien a perdre, et un avertissement d'entree de jeu ne ferait que
 * reduire la confiance. On attend qu'une partie soit entierement remplie.
 */
function majBandeau() {
  const bandeau = $('bandeau');
  const uneePartieFinie = sections().some(partieTraitee);
  const montrer = etat.ecran === 'section' && !etat.bandeauVu && uneePartieFinie;
  bandeau.hidden = !montrer;
  if (montrer) $('bandeau-texte').textContent = T.ui_bandeau_persistance;
}

function majProgression() {
  if (etat.ecran !== 'section') return;
  const p = progression();
  $('progression-etape').textContent =
    remplir(T.ui_section_sur, { n: etat.section + 1, total: sections().length });
  $('progression-pourcent').textContent = remplir(T.ui_pourcent, { p: p.pourcent });
  $('progression-jauge').style.width = p.pourcent + '%';
  const piste = $('progression-piste');
  piste.setAttribute('aria-valuenow', String(p.pourcent));
  piste.setAttribute('aria-valuetext', remplir(T.ui_pourcent, { p: p.pourcent }));
}

/* -----------------------------------------------------------------------------
   Sommaire
   -------------------------------------------------------------------------- */
function majSommaire() {
  const liste = $('sommaire-liste');
  if (!liste) return;
  liste.textContent = '';
  sections().forEach((s, i) => {
    const li = el('li');
    const bouton = el('button', 'sommaire__item');
    bouton.type = 'button';
    const e = etatSection(s);
    bouton.dataset.etat = e;
    if (i === etat.section && etat.ecran === 'section') bouton.setAttribute('aria-current', 'true');
    bouton.appendChild(el('span', null, s.titre || ''));
    bouton.appendChild(el('span', 'sommaire__etat', T['ui_etat_' + e]));
    bouton.addEventListener('click', () => { fermerSommaire(); allerA(i); });
    li.appendChild(bouton);
    liste.appendChild(li);
  });
}

function ouvrirSommaire() {
  majSommaire();
  $('sommaire').hidden = false;
  $('btn-sommaire').setAttribute('aria-expanded', 'true');
  const premier = $('sommaire-liste').querySelector('button');
  if (premier) premier.focus();
}

function fermerSommaire() {
  $('sommaire').hidden = true;
  $('btn-sommaire').setAttribute('aria-expanded', 'false');
  $('btn-sommaire').focus();
}

/* -----------------------------------------------------------------------------
   Formatage des reponses
   -------------------------------------------------------------------------- */
function formaterReponse(q) {
  const v = etat.reponses[q.id];
  if (q.type === 'repeater') {
    if (!Array.isArray(v) || !v.length) return '';
    return v.map((entree, i) => {
      const titre = String(entree.nom || '').trim() || remplir(T.ui_repeater_titre_defaut, { n: i + 1 });
      const details = (q.champs || [])
        .filter((c) => c.id !== 'nom' && String(entree[c.id] || '').trim() !== '')
        .map((c) => '  · ' + (c.label || c.id) + ' : ' + entree[c.id]);
      return titre + (details.length ? '\n' + details.join('\n') : '');
    }).join('\n');
  }
  if (Array.isArray(v)) return v.join(', ');
  return String(v === undefined || v === null ? '' : v).trim();
}

/* -----------------------------------------------------------------------------
   Export Markdown
   -------------------------------------------------------------------------- */
/** Rien a exporter pour cette question : dire laquelle des deux absences c'est. */
const marqueAbsence = (q) => (estACompleter(q) ? EXPORT_MISE_DE_COTE : EXPORT_SANS_REPONSE);

function construireMarkdown() {
  const lignes = [];
  lignes.push('# ' + (config.projet.titre_page || config.projet.client || ''));
  lignes.push('');
  lignes.push('_' + (config.projet.client || '') + ' — ' + new Date().toLocaleDateString('fr-FR') + '_');
  lignes.push('');

  sections().forEach((s) => {
    lignes.push('## ' + (s.titre || ''));
    lignes.push('');
    (s.questions || []).forEach((q) => {
      if (!estChamp(q)) return;

      if (q.type === 'repeater') {
        lignes.push('**' + (q.label || q.id) + '**');
        lignes.push('');
        const v = etat.reponses[q.id];
        if (!Array.isArray(v) || !v.length) {
          lignes.push('- ' + marqueAbsence(q));
        } else {
          v.forEach((entree, i) => {
            const titre = String(entree.nom || '').trim() || remplir(T.ui_repeater_titre_defaut, { n: i + 1 });
            lignes.push('- **' + titre + '**');
            (q.champs || []).forEach((c) => {
              if (c.id === 'nom') return;
              const val = String(entree[c.id] || '').trim();
              if (val) lignes.push('  - ' + (c.label || c.id) + ' : ' + val);
            });
          });
        }
        lignes.push('');
        return;
      }

      lignes.push('**' + (q.label || q.id) + '**');
      lignes.push('');
      const texte = estACompleter(q) ? '' : formaterReponse(q);
      lignes.push(texte || marqueAbsence(q));
      lignes.push('');
    });
  });

  return lignes.join('\n');
}

function telechargerMarkdown() {
  const contenu = construireMarkdown();
  const base = (config.envoi && config.envoi.nom_fichier_export) || 'reponses';
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([contenu], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const lien = el('a');
  lien.href = url;
  lien.download = base + '-' + date + '.md';
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* -----------------------------------------------------------------------------
   Envoi
   -------------------------------------------------------------------------- */
/**
 * Charge utile courte et lisible.
 * Un POST avec un champ par question donne un email en tableau de 50 lignes,
 * illisible. On envoie donc le meme .md que le bouton de telechargement, plus
 * de quoi juger d'un coup d'oeil ou en est le dossier.
 */
function construirePayload() {
  const p = progression();
  const manques = [];
  parcourirQuestions((q) => {
    if (!estChamp(q) || !q.requis) return;
    if (!estRempli(q) || estACompleter(q)) manques.push(q.label || q.id);
  });

  return {
    _subject: 'Réponses — ' + (config.projet.client || '') + ' — ' + new Date().toLocaleDateString('fr-FR'),
    client: config.projet.client || config.projet.id || '',
    progression: p.repondues + ' réponses sur ' + p.total + ', ' + (p.total - p.repondues) + ' à compléter',
    manques: manques.join('\n'),
    reponses: construireMarkdown(),
  };
}

async function lancerEnvoi(bouton) {
  const libelle = bouton.textContent;
  bouton.disabled = true;
  bouton.textContent = T.ui_envoi_encours;
  // Sur une connexion lente ou coupee, une requete peut ne jamais aboutir :
  // on abandonne au bout de 20 s pour basculer sur l'ecran de secours.
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), 20000);
  try {
    const reponse = await fetch(config.envoi.endpoint, {
      method: (config.envoi.methode || 'POST'),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(construirePayload()),
      signal: arret.signal,
    });
    if (!reponse.ok) throw new Error('HTTP ' + reponse.status);
    etat.envoye = true;
    etat.ecran = 'succes';
    sauvegarder();            // Les reponses sont conservees volontairement.
    rendre();
  } catch (e) {
    etat.ecran = 'echec';     // Aucune donnee n'est touchee.
    rendre();
  } finally {
    clearTimeout(minuteur);
    bouton.disabled = false;
    bouton.textContent = libelle;
  }
}

/* -----------------------------------------------------------------------------
   Ecran d'erreur de chargement (fichiers JSON illisibles)
   -------------------------------------------------------------------------- */
/* Aucune couleur du client n'est disponible ici : on s'appuie uniquement sur les
   couleurs systeme du navigateur (voir .erreur-chargement dans style.css). */
function afficherErreurChargement() {
  document.documentElement.classList.add('pret');
  const panneau = el('div', 'erreur-chargement');
  panneau.appendChild(el('h1', null, TEXTES_DEFAUT.ui_erreur_chargement_titre));
  panneau.appendChild(el('p', null, TEXTES_DEFAUT.ui_erreur_chargement_texte));
  $('ecran').appendChild(panneau);
}

/* -----------------------------------------------------------------------------
   Branchements
   -------------------------------------------------------------------------- */
function brancher() {
  $('btn-precedent').addEventListener('click', () => {
    if (etat.section > 0) allerA(etat.section - 1);
  });

  $('btn-suivant').addEventListener('click', () => {
    if (etat.section < sections().length - 1) allerA(etat.section + 1);
    else { etat.ecran = 'recap'; sauvegarder(); rendre(); $('zone-principale').focus({ preventScroll: true }); }
  });

  $('btn-sommaire').addEventListener('click', () => {
    if ($('sommaire').hidden) ouvrirSommaire(); else fermerSommaire();
  });
  $('btn-fermer-sommaire').addEventListener('click', fermerSommaire);
  $('sommaire-voile').addEventListener('click', fermerSommaire);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('sommaire').hidden) fermerSommaire();
  });

  $('btn-telecharger').addEventListener('click', telechargerMarkdown);

  $('bandeau-fermer').addEventListener('click', () => {
    etat.bandeauVu = true;
    sauvegarder();
    majBandeau();
  });

  suivreClavier();
}

/**
 * Le clavier du telephone recouvre le bas de l'ecran, la ou est le bouton
 * « Suivant ». On mesure la hauteur qu'il occupe et on remonte la barre juste
 * au-dessus, via la variable CSS --clavier.
 *
 * Pourquoi pas plus simple : sortir la barre du flux pendant la saisie
 * (`position: static`) la renvoyait a la fin du document, hors de l'ecran. La
 * cliente ne trouvait plus le bouton — et refermer le clavier ne le ramenait
 * pas, car le champ garde le focus sur telephone.
 *
 * `visualViewport` est la partie de la page reellement visible, clavier deduit.
 * Absent sur les tres vieux navigateurs : la barre reste alors simplement collee
 * en bas, comme avant.
 */
function suivreClavier() {
  const vv = window.visualViewport;
  if (!vv) return;
  const maj = () => {
    const cache = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    // Sous 80px c'est une barre d'outils du navigateur, pas un clavier.
    document.documentElement.style.setProperty('--clavier', (cache > 80 ? cache : 0) + 'px');
  };
  vv.addEventListener('resize', maj);
  vv.addEventListener('scroll', maj);
  maj();
}

/* -----------------------------------------------------------------------------
   Demarrage
   -------------------------------------------------------------------------- */
(async function demarrer() {
  try {
    await charger();
  } catch (e) {
    afficherErreurChargement();
    return;
  }

  injecterDesign();
  const avaitDesDonnees = restaurer();
  initialiserRepeaters();

  // Textes d'interface fixes de la coquille
  $('entete-client').textContent = config.projet.client || '';
  $('btn-sommaire').textContent = T.ui_sommaire;
  $('sommaire-titre').textContent = T.ui_sommaire_titre;
  $('btn-fermer-sommaire').textContent = T.ui_fermer;
  $('btn-fermer-sommaire').setAttribute('aria-label', T.ui_sommaire);
  $('btn-telecharger').textContent = T.telecharger_bouton || '';
  $('lien-evitement').textContent = T.ui_evitement;
  $('bandeau-fermer').textContent = T.ui_fermer;
  $('bandeau-fermer').setAttribute('aria-label', T.ui_bandeau_fermer);

  const logo = $('logo');
  if (config.projet.logo) {
    logo.addEventListener('load', () => { logo.hidden = false; });
    logo.addEventListener('error', () => { logo.hidden = true; });
    logo.alt = config.projet.client || '';
    logo.src = config.projet.logo;
  }

  brancher();
  majSommaire();

  // On revient toujours a l'accueil : il porte le message de restauration.
  etat.ecran = 'accueil';
  if (!avaitDesDonnees) etat.section = 0;

  document.documentElement.classList.add('pret');
  rendre();
  enregistrerServiceWorker();
})();

/**
 * Rend la page rechargeable sans reseau. Sans effet en file:// (protocole non
 * supporte) : la copie inline des JSON couvre ce cas la.
 */
function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register('sw.js').catch(() => {
    /* Echec sans consequence : le formulaire fonctionne, il ne sera simplement
       pas disponible hors connexion. */
  });
}
