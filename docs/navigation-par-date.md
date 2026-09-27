# Capsela — Navigation par date et météo depuis l'Accueil

Sep 27, 2026 · @Angela

Ce document décrit ce qui a été développé le 27/09/2026 pour consulter la tenue des jours suivants et ouvrir les réglages météo depuis l'Accueil. Il documente le comportement réel du code ; rien n'y est une intention non implémentée, sauf la section « Limites et suites », signalée comme telle.

Les statuts reprennent la légende de `docs/avis-de-styliste.md` : **[DÉCIDÉ]**, **[RECOMMANDÉ]**, **[À ARBITRER]**, **[HYPOTHÈSE TECHNIQUE]**.

## 1. Principe

| Niveau | Rôle | Statut |
| --- | --- | --- |
| Accueil | Aperçu du jour consulté et accès rapide (tenue, météo) | [DÉCIDÉ] |
| Tenue | Expérience complète de la tenue du jour consulté | [DÉCIDÉ] |
| Préférences Capsela | Configuration (localisation, météo, rythme) — seule place des réglages | [DÉCIDÉ] |

Aucun écran météo, aucun écran calendrier, aucune préférence nouvelle n'a été créé. [DÉCIDÉ]

## 2. Ce que l'utilisatrice peut faire

1. Sur l'Accueil ou sur Tenue, passer d'aujourd'hui aux 4 jours suivants avec `‹` / `›`, et revenir d'un tap avec « Aujourd'hui ».
2. Voir, pour le jour choisi, sa météo (prévision), une tenue composée pour ce jour, et l'occasion de ce jour selon « Mon rythme ».
3. Ouvrir cette tenue avec « Voir ma tenue » : Tenue affiche le même jour, jamais aujourd'hui par défaut.
4. Toucher la pastille météo (Accueil comme Tenue) pour ouvrir Préférences Capsela directement sur « Localisation & météo ».

## 3. Architecture

### 3.1 Un seul état : le jour consulté

| Élément | Où | Rôle |
| --- | --- | --- |
| `state.jourDecalage` | `src/lib/types.ts`, `store.tsx` | 0 aujourd'hui, 1 demain… jusqu'à `JOUR_MAX` |
| `actions.choisirJour(n)` | `store.tsx` | Change de jour (borné), garde et rend les tenues par jour |
| `jourConsulte` (contexte) | `store.tsx` | `{ decalage, date, meteoPrevue, previsionEnChargement }` |
| `meteoDuJour` (contexte) | `store.tsx` | La météo que la tenue reçoit pour le jour consulté |
| Dérivés purs | `src/lib/jourConsulte.ts` (testé) | Dates, libellés, occasion par défaut d'une date |

`JOUR_MAX` = `HORIZON_PREVISION_JOURS` (4) : la navigation s'arrête là où la prévision s'arrête, plutôt que de promettre une météo qu'elle n'a pas. [DÉCIDÉ]

### 3.2 Deux composants partagés (option D)

`src/components/JourMeteo.tsx` :

- `SelecteurJour` — `‹ Aujourd'hui · dimanche 27 ›`, `‹ Demain · lundi 28 ›`, `‹ Mardi 29 septembre ›`, plus « Aujourd'hui » hors du jour même.
- `PastilleMeteo` — ville, icône, température et condition du jour consulté, la source de la météo, et l'ouverture de « Localisation & météo ».

Utilisés tels quels par `HomeScreen` et `TenuesScreen`. Une seule logique, une seule présentation : ce qui est choisi sur un écran est ce que l'autre affiche. [DÉCIDÉ]

### 3.3 La météo d'un jour à venir

Réutilise ce que Planifier utilisait déjà :

- `fetchPrevisionByCity(ville)` pour la ville affichée (`geoCity.city`), chargée à la demande dès qu'un jour à venir est consulté, gardée tant que la ville ne change pas ;
- `previsionPour(prévision, jour, "Toute la journée")` pour la température et la condition du jour ;
- `weatherForDay(temp, condition, saisonCalendairePour(date))` : la saison est celle de LA DATE.

Sans prévision (lieu sans réponse, fonction Edge `weather` antérieure à `mode=forecast`, ou mode démo), la règle déjà en place dans Planifier s'applique : **température mesurée aujourd'hui, saison de la date**, et la pastille l'écrit (« Prévision indisponible pour demain — tenue composée sur la saison de ce jour et la température d'aujourd'hui. »). Aucune météo n'est inventée ni affichée comme prévue. [DÉCIDÉ]

`weather` (contexte) reste la météo d'aujourd'hui pour tout le reste : capsule par défaut, Dressing, Capsule. Seule la tenue suit le jour consulté (`weatherRef` = `meteoDuJour`, utilisée par `regen`). [DÉCIDÉ]

### 3.4 L'occasion d'un jour : « Mon rythme »

La règle existante (`defaultOccasionToday`, 13/08/2026) est désormais `occasionParDefaut(prefs, date)` dans `jourConsulte.ts` ; `defaultOccasionToday` en est la forme « aujourd'hui ». Inchangée sur le fond :

| Situation | Occasion par défaut |
| --- | --- |
| « Je suis en congés » activé | Cocooning |
| Jour coché dans « Jours travaillés » | Travail / Bureau |
| Autre jour | Quotidien / Décontracté |

L'occasion reste modifiable sur Tenue, comme avant. [DÉCIDÉ]

### 3.5 Une tenue par jour

- Quitter un jour garde sa tenue et ses drapeaux (occasion, suggestions ignorées, validation…) sous sa date ; y revenir la rend telle quelle. La tenue d'aujourd'hui n'est jamais écrasée par celle de demain. [DÉCIDÉ]
- Un jour jamais consulté attend sa météo, puis est composé par le même `regen` / `generateOutfitWithFallback`, avec l'occasion de son jour. Aucun second moteur. [DÉCIDÉ]
- La garde est en mémoire pour la session (pas de persistance). [HYPOTHÈSE TECHNIQUE]

### 3.6 Ce qui reste propre au jour même

| Action | Aujourd'hui | Jour à venir | Pourquoi |
| --- | --- | --- | --- |
| « Porter cette tenue » | Oui | Remplacé par « À porter demain — … » | Le Journal n'enregistre que le jour même |
| « J'adore » / « Pas pour moi » (Accueil) | Oui | Masqués | L'avis est enregistré par jour (`outfit_feedback`) |
| Enregistrer dans mes looks | Oui | Oui | Indépendant de la date |
| Avis d'un proche | Oui | Oui, message « … sa tenue pour demain », avec la météo prévue si elle existe | Même écran de partage |
| Autre tenue, changer une pièce, compléter la tenue | Oui | Oui | Même moteur, météo du jour consulté |

Les gardes sont aussi posées dans le store (`wearOutfitToday`, `setOutfitFeedback`), pas seulement à l'écran. [DÉCIDÉ]

## 4. La date à l'écran — décision

| Option | Principe | Verdict |
| --- | --- | --- |
| A | Date en haut de chaque écran | Écartée : répète une information sans objet sur les écrans qui ne dépendent pas d'un jour (Dressing, Capsule, Profil) |
| B | Date seulement là où le contenu dépend d'une date | Retenue sur le périmètre : seuls Accueil et Tenue la portent |
| C | Date portée par le sélecteur | Retenue sur la forme : le sélecteur REMPLACE le surtitre qui portait la date |

Concrètement [DÉCIDÉ] :

- Accueil : le surtitre « Aujourd'hui » au-dessus de « Bonjour, … » est devenu le sélecteur.
- Tenue : le surtitre « Dimanche 27 septembre » est devenu le sélecteur ; le titre s'accorde au jour (« Ma tenue du jour », « Ma tenue de demain », « Ma tenue du mardi 29 ») et la question aussi (« Qu'est-ce qui est prévu demain ? »).
- La température n'est plus répétée dans la phrase de la card de l'Accueil : la pastille météo la porte (même arbitrage que Tenue le 23/09).

## 5. Où vit le sélecteur — décision

| Option | Verdict |
| --- | --- |
| A. Accueil seulement | Écartée : Tenue ne saurait pas changer de jour, et y retomberait sur aujourd'hui |
| B. Tenue seulement | Écartée : l'Accueil annoncerait la tenue d'un jour sans pouvoir en changer |
| C. Les deux, synchronisés | Retenue sur le principe |
| D. Composant partagé | Retenue sur la forme : un seul composant, un seul état — la synchronisation est structurelle, pas une copie à maintenir |

## 6. Préférences Capsela depuis la météo

- `actions.goPreferences(section?)` mémorise l'écran d'origine (`preferencesReturn`) et la rubrique à montrer (`preferencesSection`). [DÉCIDÉ]
- La pastille météo (Accueil, Tenue) et « Ta météo » (Mon profil) passent `"localisation"` : l'écran s'ouvre sur « Localisation & météo » (géolocalisation, météo de la position, ville, unités). [DÉCIDÉ]
- Le retour ramène à l'écran d'origine (Accueil, Tenue ou Profil). [DÉCIDÉ]

## 7. Fichiers

| Fichier | Contenu |
| --- | --- |
| `src/lib/jourConsulte.ts` | `JOUR_MAX`, `dateDuJour`, `libelleJour`, `complementTenue`, `quandPhrase`, `momentMessage`, `occasionParDefaut` |
| `src/lib/__tests__/jourConsulte.test.ts` | Tests des dérivés |
| `src/lib/store.tsx` | `jourDecalage`, prévision, `meteoDuJour`, `choisirJour`, tenues par jour, `goPreferences(section)`, `closePreferences` |
| `src/components/JourMeteo.tsx` | `SelecteurJour`, `PastilleMeteo` |
| `src/components/screens/HomeScreen.tsx` | Sélecteur, pastille météo, avis du jour limité au jour même |
| `src/components/screens/TenuesScreen.tsx` | Sélecteur, titre et question du jour, pastille partagée, « Porter » réservé au jour même |
| `src/components/screens/PreferencesScreen.tsx` | Ancre « Localisation & météo », retour à l'écran d'origine |

## 8. Limites et suites

- **Prévision réelle non vérifiée en local.** L'environnement de développement tourne en mode démo, sans fonction Edge : le chemin « prévision disponible » n'a été exercé que par sa règle de repli. À vérifier en production (la fonction `weather` doit connaître `mode=forecast`). [À ARBITRER : recette]
- **Tenue planifiée et jour consulté.** Une tenue planifiée pour une date (Planifier) ne remplace pas encore la tenue proposée ce jour-là dans la navigation par date. [À ARBITRER]
- **Garde en mémoire seulement.** Recharger l'application recompose les jours à venir. [HYPOTHÈSE TECHNIQUE]
