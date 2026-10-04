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

1. Sur l'Accueil ou sur Tenue, passer d'aujourd'hui aux 4 jours suivants avec `‹` / `›`, et revenir à aujourd'hui d'un tap sur le libellé du jour.
2. Voir, pour le jour choisi, sa météo (prévision), une tenue composée pour ce jour, et l'occasion de ce jour selon « Mon rythme ».
3. Ouvrir cette tenue avec « Voir ma tenue » : Tenue affiche le même jour, jamais aujourd'hui par défaut.
4. Toucher la ville et la météo (Accueil comme Tenue) pour ouvrir Préférences Capsela directement sur « Localisation & météo ».

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

### 3.2 Un composant partagé (option D)

`src/components/JourMeteo.tsx` exporte `JourEtMeteo` : une seule ligne, en deux zones séparées d'un filet.

- À gauche, le jour : `‹ Aujourd'hui ›`, `‹ Demain ›`, `‹ Mar. 29 ›` (`libelleJourCourt`). Hors du jour même, toucher le libellé ramène à aujourd'hui. Le nom accessible dit la date complète (`libelleJour` : « Mardi 29 septembre »).
- À droite, la ville, l'icône et la température du jour consulté (la condition, « Nuageux », s'ajoute à partir de 400 px de large) ; toucher cette zone ouvre « Localisation & météo ».
- Sous la ligne, la source de la météo quand elle n'est pas la position en direct, ou la règle de repli quand la prévision manque.

Utilisé tel quel par `HomeScreen` et `TenuesScreen`. Une seule logique, une seule présentation : ce qui est choisi sur un écran est ce que l'autre affiche. [DÉCIDÉ]

### 3.3 La météo d'un jour à venir

Réutilise ce que Planifier utilisait déjà :

- `fetchPrevisionByCity(ville)` pour la ville affichée (`geoCity.city`), chargée à la demande dès qu'un jour à venir est consulté, gardée tant que la ville ne change pas ;
- `previsionPour(prévision, jour, "Toute la journée")` pour la température et la condition du jour ;
- `weatherForDay(temp, condition, saisonCalendairePour(date))` : la saison est celle de LA DATE.

Sans prévision (lieu sans réponse, fonction Edge `weather` antérieure à `mode=forecast`, ou mode démo), la règle déjà en place dans Planifier s'applique : **température mesurée aujourd'hui, saison de la date**, et la note sous la ligne l'écrit (« Prévision indisponible pour demain — tenue composée sur la saison de ce jour et la température d'aujourd'hui. »). Aucune météo n'est inventée ni affichée comme prévue. [DÉCIDÉ]

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
| C | Date portée par le sélecteur | Retenue sur la forme : aucun surtitre ne répète la date, le sélecteur la porte |

**Placement : sur la ligne de la localisation.** Une première version plaçait le sélecteur à la place du surtitre, au-dessus du titre, et la météo sur une pastille en dessous. Écartée par la propriétaire le 27/09/2026 : la date doit être sur la même ligne que la localisation. Le jour et sa météo se lisent désormais ensemble, comme une seule information de contexte (« Demain · Paris 17° »), et l'écran gagne une ligne. [DÉCIDÉ]

Concrètement [DÉCIDÉ] :

- Accueil : le surtitre « Aujourd'hui » au-dessus de « Bonjour, … » est supprimé ; la ligne jour + météo est sous « Bonjour, … ».
- Tenue : le surtitre « Dimanche 27 septembre » est supprimé ; la ligne jour + météo est sous le titre, qui s'accorde au jour (« Ma tenue du jour », « Ma tenue de demain », « Ma tenue du mardi 29 »), comme la question (« Qu'est-ce qui est prévu demain ? »).
- Le libellé du jour est court sur la ligne (« Mar. 29 ») pour tenir à 360 px avec la ville et la température ; la date longue reste dans le titre de Tenue et dans le nom accessible.
- La température n'est plus répétée dans la phrase de la card de l'Accueil : la ligne météo la porte (même arbitrage que Tenue le 23/09).

## 5. Où vit le sélecteur — décision

| Option | Verdict |
| --- | --- |
| A. Accueil seulement | Écartée : Tenue ne saurait pas changer de jour, et y retomberait sur aujourd'hui |
| B. Tenue seulement | Écartée : l'Accueil annoncerait la tenue d'un jour sans pouvoir en changer |
| C. Les deux, synchronisés | Retenue sur le principe |
| D. Composant partagé | Retenue sur la forme : un seul composant, un seul état — la synchronisation est structurelle, pas une copie à maintenir |

## 6. Préférences Capsela depuis la météo

- `actions.goPreferences(section?)` mémorise l'écran d'origine (`preferencesReturn`) et la rubrique à montrer (`preferencesSection`). [DÉCIDÉ]
- La zone météo de la ligne (Accueil, Tenue) et « Ta météo » (Mon profil) passent `"localisation"` : l'écran s'ouvre sur « Localisation & météo » (géolocalisation, météo de la position, ville, unités). [DÉCIDÉ]
- Le retour ramène à l'écran d'origine (Accueil, Tenue ou Profil). [DÉCIDÉ]

## 7. Relier la date à Planifier

Arrêté le 27/09/2026 (options 1 et 2 proposées à la propriétaire, acceptées).

| Élément | Comportement | Statut |
| --- | --- | --- |
| Rappel des tenues planifiées | Sous la ligne jour + météo, l'Accueil et Tenue listent les tenues planifiées du jour consulté (`PlansDuJour`) : aperçu des pièces enregistrées, « Ce soir », « Planifiée · Matin », « Date · Lyon ». Rien sans plan ce jour-là. Le plan devenu tenue du jour n'y figure pas | [DÉCIDÉ] |
| **Révisé le 04/10/2026 — hero dynamique de l'Accueil** | « Soirée » rejoint « Toute la journée », « Matin » et « Après-midi » : TOUT plan du jour consulté devient la tenue affichée, dans l'ordre de la journée (`MOMENTS_TENUE_DU_JOUR`). Le hero le dit (`heroPlan.ts`, testé) : jour futur → « Look planifié », « Ton look est prêt pour dimanche », badge « Dimanche 4 oct. · Soirée », CTA « Voir le look planifié » ; jour J → « Look du jour », « Ta tenue est prête pour ce soir », badge « Aujourd'hui · Soirée », CTA « Voir mon look ». La petite card de rappel au-dessus du hero n'existe plus pour le plan affiché (elle ne montre que ce que le hero ne dit pas : un plan écarté, incomplet, ou un second plan de la journée). **Le lendemain** : un plan d'hier pas encore rangé dans « Mes looks » devient « Ton look d'hier » (« Comment était ta tenue ? »), avec « Revoir le look » et « J'ai adoré » (même écriture que « J'adore » : Mes looks). Limites : « C'était bien » et un vrai « Donner mon avis » demanderaient un troisième verdict dans `outfit_feedback` (la contrainte CHECK n'en admet que deux, migration à la main) ; les boutons « J'adore / Pas pour moi » ne s'affichent pas sur un jour à venir (l'avis ne porte que sur aujourd'hui). | [DÉCIDÉ] |
| La tenue planifiée devient la tenue du jour, selon le moment | Arrêté le 30/09/2026 (option C), en remplacement du « rappel, pas un remplacement » du 27/09 et en accord avec la décision Notion du 14/09 précisée. Un plan « Toute la journée », « Matin » ou « Après-midi » DEVIENT la tenue du jour : ses pièces, son occasion et son sous-choix, étiquetés « Ta tenue planifiée ». Un plan « Soirée » reste un rappel « Ce soir » et la tenue du jour reste celle de « Mon rythme » : une journée peut avoir une tenue de travail le jour et un dîner le soir. Plusieurs plans de journée : le premier dans l'ordre de la journée (`planPourTenueDuJour`, `src/lib/planDuJour.ts`) | [DÉCIDÉ] |
| Voir une autre proposition | L'Accueil (« Voir une autre proposition ») et Tenue (« Autre proposition ») rendent la proposition de Capsela ; le plan écarté ne revient pas de la session (`plansEcartes`) et reprend sa place de rappel. Ce retour ne compte pas dans les « Autre tenue » gratuites (`voirAutreProposition`) | [DÉCIDÉ] |
| Pièce sortie du dressing | Le plan n'est pas imposé (une tenue à trou n'est pas une tenue) : la proposition reste, et le rappel dit « Une pièce n'est plus dans ton dressing » | [DÉCIDÉ] |
| Météo qui contredit le plan | La tenue a été choisie sur une prévision. Si la météo du jour la contredit, une ligne le dit, sans jamais changer la tenue d'office : chaussures ouvertes sous la pluie, pièce hors de ses bornes de température déclarées (`alerteMeteoPlan`). Rien d'autre n'est deviné | [DÉCIDÉ] |
| Ouvrir un plan | Toucher le rappel ouvre la fiche du plan dans Planifier (`ouvrirPlan`) ; le retour ramène à l'Accueil ou à Tenue (`planRetour`), y compris après « Demander l'avis d'un proche » | [DÉCIDÉ] |
| Planifier le jour consulté | Sur Tenue, un jour à venir : la carte « À préparer » devient « Autre chose de prévu mardi ? » et ouvre Planifier avec cette date déjà choisie (`planifierLeJour`, `planJour`). Aujourd'hui : carte inchangée, Planifier ne proposant pas le jour même | [DÉCIDÉ] |
| Retour depuis Planifier | Depuis l'étape 1, la fiche ou la liste après « Garder cette tenue », le retour ramène à l'écran d'origine ; dès que le hub de Planifier s'affiche, on est « dans » Planifier et ce retour ne vaut plus | [DÉCIDÉ] |
| Données | Les tenues planifiées sont chargées par le store avec le dressing (`state.tenuesPlanifiees`) et rechargées à l'ouverture de Planifier, qui les lit et les écrit là. Vides en mode démo | [DÉCIDÉ] |

Aucune migration : la table `planned_outfits` (0030) existe déjà.

## 8. Fichiers

| Fichier | Contenu |
| --- | --- |
| `src/lib/jourConsulte.ts` | `JOUR_MAX`, `dateDuJour`, `libelleJour`, `libelleJourCourt`, `complementTenue`, `quandPhrase`, `momentMessage`, `occasionParDefaut` |
| `src/lib/__tests__/jourConsulte.test.ts` | Tests des dérivés |
| `src/lib/store.tsx` | `jourDecalage`, prévision, `meteoDuJour`, `choisirJour`, tenues par jour, `goPreferences(section)`, `closePreferences` |
| `src/components/JourMeteo.tsx` | `JourEtMeteo` : le jour et sa météo sur une ligne |
| `src/components/PlansDuJour.tsx` | Rappel des tenues planifiées du jour consulté ; `usePlanApplique` (plan devenu tenue du jour, alerte météo) |
| `src/lib/planDuJour.ts` | `planPourTenueDuJour`, `sousChoixDuPlan`, `alerteMeteoPlan` (testés, `__tests__/planDuJour.test.ts`) |
| `src/lib/planifier.ts` | `plansDuJour` (testé) |
| `src/components/screens/PlanifierScreen.tsx` | Liste lue dans le store, date préremplie, retour vers l'Accueil ou Tenue |
| `src/components/screens/HomeScreen.tsx` | Ligne jour + météo, avis du jour limité au jour même |
| `src/components/screens/TenuesScreen.tsx` | Ligne jour + météo, titre et question du jour, « Porter » réservé au jour même |
| `src/components/screens/PreferencesScreen.tsx` | Ancre « Localisation & météo », retour à l'écran d'origine |

## 9. Limites et suites

- **Prévision réelle non vérifiée en local.** L'environnement de développement tourne en mode démo, sans fonction Edge : le chemin « prévision disponible » n'a été exercé que par sa règle de repli. À vérifier en production (la fonction `weather` doit connaître `mode=forecast`). [À ARBITRER : recette]
- **Tenue planifiée et jour consulté.** Tranché le 30/09/2026 (option C, section 7). Limite connue : l'alerte météo ne voit que ce que les pièces déclarent (type de chaussures, bornes de température) ; une pièce sans bornes ne déclenche rien. [DÉCIDÉ]
- **Plans écartés en mémoire seulement.** « Voir une autre proposition » vaut pour la session : recharger l'application réapplique le plan. [HYPOTHÈSE TECHNIQUE]
- **Garde en mémoire seulement.** Recharger l'application recompose les jours à venir. [HYPOTHÈSE TECHNIQUE]
