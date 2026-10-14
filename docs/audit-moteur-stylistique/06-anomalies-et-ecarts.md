# 06 — Anomalies, écarts et zones d'incertitude

Chaque constat porte un niveau de confiance : **CONFIRMÉ** (démontré par le code, ou par une lecture seule du catalogue), **SUSPECTÉ** (plausible, non démontré), **NON VÉRIFIÉ**. Rien n'a été corrigé.

## A. Constats confirmés

### A1 — Identifiant R-B18 attribué à deux règles différentes
- **Observé** : « R-B18 » désigne la compensation thermique (haut/robe sous son `meteoMinTemp`, `logic.ts:934`, `1471`, `699`) ET « aucun accessoire en Télétravail » (`logic.ts:814`, `1821`).
- **Preuve** : ces deux commentaires, dans le même fichier.
- **Scénario** : lire « R-B18 » dans un test ou une doc sans contexte.
- **Impact** : documentation et tests ambigus ; aucun effet fonctionnel.

### A2 — `computeLookScore` reçoit `morphology` et ne la lit jamais
- **Observé** : le paramètre `morphology` (`logic.ts:2091`) n'apparaît nulle part dans le corps (2087–2367) ; les appelants la passent encore (`diversite.ts`, `humeur.ts`, `getOutfitsForItem` : `null`).
- **Preuve** : lecture du corps de la fonction ; R-S9 retirée (2175–2188).
- **Impact** : aucun effet ; trompeur pour qui lit la signature. La morphologie n'agit plus que sur la capsule (A3).

### A3 — Code morphologique mort ou réservé à l'audit
- `morphoVigilance`, `MORPHO_AVOID` (`capsule.ts:326–339`) : **aucun appel hors commentaire** (grep). `morphoFit` : appelée seulement quand `strategy.rang3 === "legacy"` (audit). Seule `valeurDirection` (526) agit, et seulement pour `f_poire` et `f_triangle_inverse` (555).
- **Impact** : trois des cinq morphologies féminines n'ont **aucun effet** sur la sélection (déjà dit sur l'écran Profil, `morphologieOrienteLaSelection`).

### A4 — Deux fonctions `piecesPrincipales` de sens différent
- `logic.ts:3097` : `CATEGORIES_PRINCIPALES` = vêtements **et chaussures**. `diversite.ts` (≈ ligne 50) : `STRUCTURANTES` = haut, pull, bas, robe, combinaison, **sans veste, manteau ni chaussures**.
- **Impact** : « tenue différente » n'a pas le même sens pour « Autre tenue » (`choisirVariation`) et pour la pénalité de diversité. Risque de confusion à la maintenance.

### A5 — Le remplacement ne suit pas la génération sur la plage de température
- **Observé** : la génération exempte haut, pull, robe, combinaison, jupe, short de la borne basse (`TEMP_COMPENSATED_CATS`, `logic.ts:956–959`) pour les compenser par une couche ; `candidatsDeRemplacement` applique les deux bornes à **toutes** les catégories (`1896–1901`).
- **Scénario** : une jupe à `meteoMinTemp` 16 °, météo 14 ° : la génération peut la proposer avec des collants ; « échanger » ou l'adaptation d'un look planifié ne la proposera jamais.
- **Impact** : le même dressing donne des candidats différents selon le parcours. Les suggestions R-S13/R-S14 (qui passent par `candidatsDeRemplacement`) en héritent.

### A6 — `Item.worn` ne vieillit pas, et le moteur le lit
- **Observé** : `worn` est mis à 0 par l'action « porter » (`store.tsx` `wearOutfitToday`, `dressing.ts:569–582`) ; aucun code ni migration du dépôt ne l'incrémente (grep `worn +`, `supabase/migrations`). Les commentaires de `selectors.ts:50–62` le disent. Or `repetitionWeight` (`logic.ts:583`), R-S15 (2212–2220) et R-B7 (`recentlyWorn`, 380, 2030) lisent `worn`.
- **Scénario** : une pièce portée il y a un mois garde `worn = 0` → pénalité R-S15 de 30 points, poids de tirage minimal, signalement R-B7 « portée il y a moins de 2 jours ».
- **Impact** : l'anti-répétition par score est figée tant que la pièce n'est pas re-portée ; la diversité 5 jours (`diversite.ts`) lit, elle, l'historique daté, donc correcte. **Réserve** : un mécanisme hors dépôt (Edge Function, tâche planifiée) n'a pas été cherché.

### A7 — Le catalogue classe le « Sweat à capuche (Hoodie) / Sweat zippé » en formalité « sport »
- **Observé** (lecture seule de `vestiaire_universel`) : réfs 493 et 522, `niveau_formalite = "sport"` (0), `role_piece = "calque"`, `meteo_min_temp 7`, `meteo_max_temp 18`, `occasions = null`.
- **Mécanisme** : `formalityOf` rend 0 ; R-B3 exige ≥ 1 pour quotidien, cocooning, voyage ; l'exemption du haut/pull exige `formalityOf > 0` (`logic.ts:857`) → seule l'occasion **sport** reste ; or le sport n'admet que des chaussures de formalité 0, un « Sac de sport » et aucun bijou (R-B11). En capsule, la pièce entre dans le bloc Sport (`isSportPiece`, `capsule.ts:841`) sans passer par le tri.
- **Impact** : l'écran « Comment porter … ? » affiche « Pas encore assez de pièces compatibles pour créer plusieurs looks avec cet article » (`ItemOutfitsScreen.tsx:279`) pour cette pièce. Reproduit par `getOutfitsForItem` sur la capsule d'un profil femme (3 styles, dressing vide, catalogue réel) : 1 idée au Printemps, à l'Automne et à l'Hiver, **0 en Été** (la pièce n'est alors pas dans la capsule). Avec un dressing réel, le résultat dépend des pièces compatibles avec le bloc Sport ; non mesuré.
- **Question métier** : un sweat à capuche est-il une pièce « sport » ? (A7 est une donnée de catalogue, pas du code.)

### A8 — Types de chaussures que les règles connaissent et que la saisie ne propose pas
- `SHOE_TYPES` (`data.ts:255`, utilisé par `AddScreen` et `importTenue`) : 10 types. `ShoeType` (`types.ts:78–90`) en compte 13 : **Mules, Slingbacks, Derbies** n'existent que dans le catalogue. R-B21, `PREFS_SOIREE_HABILLEE`, `PREFS_ENTRETIEN` les nomment.
- **Impact** : une personne qui possède des mules les rentre sous un autre type ; les préférences de type (R-S16) et R-B21 ne les reconnaissent alors pas.

### A9 — Commentaire de type obsolète
- `types.ts` dit à propos de `saisons` : « Le moteur ne lit que `season` » ; `estDeSaison` (`capsule.ts:277–279`) lit `saisons`. Documentation seule.

### A10 — Le collant d'un short utilise la date système
- `logic.ts:1314` : `b.cat === "short" && currentSeasonKey() !== "Été"` lit la date du jour, pas `capsuleSeason` ni la date planifiée.
- **Scénario** : planifier en décembre une tenue pour un voyage en août (météo d'été) depuis un jour d'hiver : le collant est déclenché ; l'inverse en été. **Impact** : incohérence pour Planifier et les idées par saison.

### A11 — Trois définitions de « tenue complète »
- `hasCoreOutfit` (1624) : robe/combi OU **haut** + bas (le pull seulement avec le levier) ; pas de chaussures requises. `isCompleteOutfit` (2380) : chaussures requises ; haut **ou pull** + bas. `tenueAUnSocle` (1617) = `hasCoreOutfit`.
- **Impact** : la génération n'accepte pas un « pull + bas » comme socle mais les idées par pièce l'acceptent ; une tenue peut être « prête » à l'accueil et « incomplète » ailleurs.

### A12 — R-S8 : la variété de matières est quasi automatique
- `matiereOf` renvoie une matière **par défaut selon la catégorie** (Cuir pour chaussures et sac, Synthétique pour bijou et accessoire, Coton ailleurs) : une tenue complète en a presque toujours plus d'une.
- **Statut** : mécanisme CONFIRMÉ par le code ; **fréquence réelle non mesurée**. Effet : +5 points quasi constants, sans lien avec la matière réelle.

## B. Écarts d'ordre d'exécution ou d'échelle

| Constat | Preuve | Confiance |
|---|---|---|
| `isDressy` est vrai dès formalité 3 : « Soirée », « Travail » en Présentiel et « Cérémonie » (et « Rendez-vous » selon son sous-contexte) excluent les baskets et les calques (R-B6, R-B8) | `logic.ts:384`, OCCASIONS | confirmé |
| `MARGE_PERTINENCE` 12 est exprimée sur une échelle 0–120 mais commentée « score 0-100 » | `diversite.ts` | confirmé (commentaire) |
| La raison d'échec `missing_required_category` utilise `hasAnyTop` = `cat === "haut"` uniquement : un dressing de pulls + bas est jugé « missing_required_category » | `logic.ts:1747` | confirmé |
| La tenue d'un autre jour reprend la météo du jour de ce jour-là, mais `currentSeasonKey()` reste la date système (A10) | — | confirmé |
| `genererTenueHumeur` (Planifier) ne passe pas par la diversité sur 5 jours | `humeur.ts` vs `diversite.ts` | suspecté (non lu dans tous les appels) |

## C. Documentation historique

La documentation fonctionnelle antérieure du moteur (« moteur de règles » citée dans les commentaires : « section 22 », « section 20 », « brief 22/08 ») **n'est pas dans le dépôt** : aucune comparaison n'a donc été faite (`docs/` ne contient que `planifier.md` qui cite R-B1 à R-B22 de façon incidente, `colorimetrie.md`, `diversite-tenues.md`, `taxonomie-occasions.md`, `flat-lay.md`…). Statut de chaque règle documentaire : **impossible à vérifier**. Les renvois « section N du moteur de règles » dans le code ne peuvent pas être résolus.

Écarts internes (code ↔ commentaires, vérifiables) :
- « R-S9 » est encore citée comme règle de scoring dans l'en-tête de `computeLookScore` (« R-S1 à R-S11 », 2064, 2082) alors qu'elle est retirée.
- « Évalue les 10 règles bloquantes (R-B1 à R-B10) » (1951) : une seule bloque (R-B9).
- `getOutfitsForItem` : en-tête « 3 looks max par occasion, 18 au total » ; défauts du code identiques (`maxPerOccasion 3`, `maxTotal 18`) — conforme.

## D. Questions métier auxquelles le code ne répond pas

1. Un sweat à capuche est-il une pièce de sport ? (A7)
2. Faut-il que `worn` vieillisse, ou que R-S15/R-B7 lisent l'historique daté ? (A6)
3. Le collant d'un short dépend-il de la saison calendaire ou de la saison de la capsule/du jour planifié ? (A10)
4. Les plages de température doivent-elles exempter les mêmes catégories à l'échange qu'à la génération ? (A5)
5. Faut-il proposer Mules, Slingbacks et Derbies à la saisie ? (A8)
6. Le bonus de variété de matières doit-il compter des matières par défaut ? (A12)
7. Quel est le sens voulu de « pièce principale » pour « tenue différente » ? (A4)
