# 02 — Règles effectivement implémentées

Source : `src/lib/logic.ts` sauf mention. « Statut » : **Implémentée** (appelée dans le flux de production), **Signalement** (calculée mais n'empêche rien), **Partielle**, **Retirée**. « Tests » : fichiers de `src/lib/__tests__/` qui citent l'identifiant (grep) — une absence signifie qu'**aucun test ne cite l'id**, pas qu'aucun test ne couvre le comportement.

Les identifiants `R-B*` / `R-S*` sont ceux **présents dans le code**. Les règles sans identifiant historique sont numérotées `D-xx` (identifiant *documentaire*, propre à cet audit).

## A. Règles dures et filtres (génération, avant tirage)

| Id | Nom | Conditions | Effet | Source | Tests | Statut |
|---|---|---|---|---|---|---|
| R-B3 | Plancher de formalité | occasion ≠ « all » ; vêtement (`CLOTHING_CATS`) ; garde si occasion déclarée sur la pièce, ou haut/pull avec `formalityOf > 0`, ou `formalityOf ≥ min` (`min` = formalité de l'occasion, ou palier du repli) | exclusion du pool | 851–860 ; échange 1832–1843 ; signal 1978–1990 | logic, saisonCapsule | Implémentée |
| R-B6 | Pas de baskets en tenue habillée | `isDressy` (formalité effective ≥ 3) | exclusion des Baskets | 864–866 ; échange 1854 ; signal 2025 | accessoireTypeFor | Implémentée |
| R-B9 | Veste/manteau sans base | veste ou manteau sans haut, robe, combinaison, ni pull de rôle « base » | **seule règle bloquante** : refus d'enregistrer/porter ; contrainte de génération | 80–89 ; `evaluateBlocking` 2047 ; `store.tsx` 2627, 2858 | logic, leviersMesure, vesteFraiche | Implémentée |
| R-B11 | Sport : liste blanche | occasion = sport | chaussures `formalityOf = 0` ; sac = « Sac de sport » seul ; pas de bijou ; accessoire dans {Casquette, Lunettes, Chaussettes hautes, Gourde} ; vêtement `formalityOf = 0` | 134–167 | accessoireTypeFor, swapOutfitPiece, formaliteSport | Implémentée |
| R-B12 | Pas de veste/manteau chez soi | occasion = cocooning | exclusion | 173–177 | — | Implémentée |
| R-B13 / R-B17 | Chaussures d'intérieur | maison : seules les chaussures d'intérieur ; hors maison : jamais | exclusion | 178–185 | — | Implémentée (deux ids pour un même bloc) |
| R-B14 | Pas de sac chez soi | maison (cocooning, ou travail + Télétravail) | exclusion | 186–189 | — | Implémentée |
| — | Pas d'accessoire en Télétravail | travail_formel + Télétravail | exclusion | 814–818 ; échange 1821 | — | Implémentée — **porte l'id R-B18 dans le commentaire** (voir anomalie A1) |
| R-B15 | Pièce « soleil » | `necessiteLeSoleil` et météo non ensoleillée (`isSunny`) | exclusion | 872–874 ; capsule 739 ; échange 1858 | — | Implémentée |
| R-B20 | Short | temp ≤ 22 | exclusion des shorts | 881–883 ; échange 1862 | — | Implémentée |
| R-B21 | Chaussures ouvertes sous la pluie | `isRainy` ; type dans {Sandales, Sandales à talons, Mules, Slingbacks, Espadrilles} ; sans type : gardée | exclusion | 47, 891–893 ; échange 1866 | sandalesDeFete, pluieChaussures | Implémentée |
| R-B22 | Chaussures d'été | temp < 15 ; Sandales, Sandales à talons, Espadrilles (sans type : regex du nom) | exclusion | 57–63, 894–897 ; échange 1870 | sandalesDeFete | Implémentée |
| D-01 | Plage de température | `meteoMinTemp > temp` (sauf haut, pull, robe, combinaison, jupe, short) ou `temp > meteoMaxTemp` | exclusion (relâchée par `poolFor`) | 956–962 | — | Implémentée |
| D-02 | Occasion déclarée sur la pièce | `it.occasion` non vide et sans l'occasion du tirage | exclusion (relâchée par `poolFor` pour les catégories essentielles) | 570, 918 | — | Implémentée |
| D-03 | Saison déclarée = règle dure (dressing réel) | pièce non catalogue, hors saisons du jour (`estDeSaison`) | exclusion, jamais relâchée ; exceptions : catalogue, `pinnedId` | 791–793 | — | Implémentée |
| D-04 | Sandales à talons de fête | automne ; soirée habillée ou cérémonie ; « Sandales à talons » | exemption de SAISON seulement (R-B22 et R-B21 s'appliquent toujours) | 794–800 | sandalesDeFete | Implémentée |
| D-05 | Échelle de replis `poolFor` | vêtements : 4 barreaux (strict ; météo relâchée sur le `min` ; occasion relâchée ; les deux) ; accessoires : 4 (+4 occasion relâchée si essentiel) | `occasionRelachee = true` dès le barreau ≥ 2 (vêtements) ou ≥ 4 (accessoires) | 1052–1104 | saisonCapsule | Implémentée |
| D-06 | Priorité au réel | au moins une pièce réelle (non catalogue) dans le groupe tiré | la capsule est écartée pour ce tirage (sauf pièce imposée) | 1132–1136 | composeWardrobePool | Implémentée |

## B. Règles de composition (pendant le tirage)

| Id | Nom | Conditions | Effet | Source | Tests | Statut |
|---|---|---|---|---|---|---|
| D-07 | Robe/combinaison ou haut + bas | `Math.random() < 0.4` ET robe disponible sans relâcher l'occasion (ou seule issue) | silhouette « pièce unique » ; sinon haut + bas | 1227–1315 | — | Implémentée |
| R-S17 | Soirée habillée | `occasion = soiree` et `soireeHabillee` | pas de chemise / robe chemise (préférence molle) | 1240, 1284–1287 ; échange 1891 | occasions, maillesFermees | Implémentée |
| D-08 | Haut à manches longues | temp ≤ 21, ni sport ni cocooning, pas de pièce imposée | haut à `manches = longues` préféré (molle) | 1295–1304 | vesteFraiche | Implémentée |
| D-09 | Haut compensé par une veste | dressy et aucun haut ne tient la formalité | veste de formalité suffisante ajoutée | 1271–1279 | logic | Implémentée |
| D-10 | Veste fraîche intégrée (ex-R-S14 en repli) | temp ≤ 21, ni sport ni cocooning, haut (pas pull) sans manches longues | veste tirée (`pick(["veste"])`) | 1358–1375 | vesteFraiche | Implémentée |
| D-11 | Veste probabiliste | sinon | tirage à 30 % (65 % pour un entretien) | 409–412, 1369 | — | Implémentée |
| D-12 | Entretien + chemise | travail + Entretien et haut « chemise » | veste forcée, manteau facultatif | 1346–1385 | — | Implémentée |
| D-13 | Calque sur une robe | robe, non dressy, sans veste, `random < 0.3` | calque ajouté | 1392–1398 | — | Implémentée |
| R-B8 | Superposition haut/pull | non robe, sans veste, `random < 0.35`, premier haut « base », non dressy | un calque (ou pull) par-dessus ; jamais deux chemises (R-B10), col roulé, ni deux mailles fermées | 1404–1450 | leviersMesure, maillesFermees | Implémentée |
| R-B10 | Deux chemises | deux hauts de sous-type Chemise/Chemisier | évité en génération ; signalé ailleurs | 202–205, 1441, 2055 | leviersMesure, maillesFermees | Implémentée |
| D-14 | Base sous un calque seul | non robe, non dressy, un seul haut et c'est un calque | haut « base » ajouté | 1457–1470 | — | Implémentée |
| R-B18 (compensation) | Compensation thermique | le haut/la robe tiré est sous son `meteoMinTemp` et rien ne le couvre | pull calque / veste / manteau ajouté ; sinon `missingCats` « chaud » | 1471–1499 | — | Implémentée |
| R-B19 | Collants | profil femme ; robe nue-jambes sous son min, jupe sous son min, ou short hors été | collants du pool, ceux dont la plage couvre la température d'abord | 1197, 1316–1341, 1550–1567 ; échange 1907 | logic | Implémentée |
| R-S16 | Chaussures par occasion | préférences de type (soirée habillée, entretien, cérémonie, voyage) | sous-ensemble préféré si non vide (molle) | 1500–1511 ; `data.ts` 279–294 | — | Implémentée |
| D-15 | Sac essentiel | hors maison | `pick(["sac"], true)` | 1530 | — | Implémentée |
| D-16 | Gourde en sport | occasion sport | gourde ajoutée systématiquement | 1541–1544 | — | Implémentée |
| D-17 | Bijou / accessoire facultatifs | `random <` 0,35 / 0,30 (cérémonie : 0,60 / 0,55) | pièce harmonisée ajoutée | 396–400, 1545–1572 | — | Implémentée |
| R-B16 | Veste résistante à la pluie | pluie ; tirage veste/manteau | `resistePluie` préféré si non vide | 1148–1151 ; échange 1875 | prevision | Implémentée (molle) |
| R-S10 | Palette personnelle | couleurs préférées dans le profil | pièces d'une couleur préférée (ou couleur inconnue) préférées si non vide | `colorimetrieMoteur.ts` `candidatsCouleur` | — | Implémentée (molle) |
| D-18 | Colorimétrie | `colorimetrieUtilisable` (saison nette) | près du visage : « à modérer » évitées, saison + préférées bienvenues ; bijoux au métal de la saison | `colorimetrieMoteur.ts` | colorimetrieMoteur | Implémentée (molle) |
| D-19 | Harmonie d'une pièce choisie | toute sélection avec des pièces déjà choisies | (1) ≤ 1 teinte affirmée, (2) formalité à ≤ 2 de la moyenne (R-B2), (3) pas deux coupes identiques non « regular » (R-B4), (4) style_tags compatibles — chaque critère seulement s'il laisse une option | 591–674 | — | Implémentée |
| R-S15 (tirage) | Anti-répétition pondérée | `CLOTHING_CATS`, `worn` renseigné | poids 4 − (3 si worn ≤ 1 ; 2 si ≤ 3 ; 1 si ≤ 14) ; jamais 0 | 583–589, 684–695 | — | Implémentée — **dépend de `Item.worn`, qui ne vieillit pas** (anomalie A6) |

## C. Repli et validité

| Id | Nom | Effet | Source |
|---|---|---|---|
| D-20 | Chaîne de formalité | 4 → [4,3,1], 3 → [3,1], 1 → [1], 0 → [0] ; la tenue entière est retentée à chaque palier | 1603–1608, 1719–1726 |
| D-21 | 20 tentatives par palier | `generateOutfit` relancé tant que pas de socle (robe/combi ou haut + bas) | 1666–1687 |
| D-22 | Échec structuré | `missing_required_category` / `formality_gap` (sonde à formalité 0) / `no_match` ; `ids = []` | 1747–1770 |
| D-23 | Socle | `hasCoreOutfit` (1624) n'accepte **pas** le pull comme socle (sauf levier) ; `isCompleteOutfit` (2380) l'accepte et exige des chaussures | 1624, 2380 |

## D. Signalements (`evaluateBlocking`, 1957–2062) — non bloquants sauf R-B9

R-B1 pièce hors saison · R-B2 écart de formalité > 2 · R-B3 trop décontractée · R-B4 deux coupes identiques (seulement 2 pièces haut/bas) · R-B5 robe/combinaison + haut ou bas (haut calque toléré hors habillé) · R-B6 baskets en habillé · R-B7 pièce portée il y a ≤ 2 jours (`recentlyWorn`) · R-B8 deux calques, ou un calque en habillé · R-B9 (hard) · R-B10 deux chemises. Appelants : `CreateLookScreen.tsx:200`, `alerteMeteo.ts:246`.

## E. Suggestions proactives et scoring

Voir `03-scoring-et-classement.md`.

## F. Règles hors de `logic.ts`

| Id | Règle | Source |
|---|---|---|
| D-24 | Capsule : sélection du catalogue (genre, saison, plage de température, style, palette, quotas, couverture d'occasion marginale, garanties) | `capsule.ts` 723–1080 |
| D-25 | Capsule : mailles fermées exclues en Été (dure) ; manteaux d'automne-hiver exclus en Été | `capsule.ts` 782–784, 971–983 |
| D-26 | Morphologie : n'oriente la capsule que pour `f_poire` et `f_triangle_inverse` (`valeurDirection`) | `capsule.ts` 526–591 |
| D-27 | Diversité sur 5 jours (pénalité par pièce et par look, facteur météo) | `diversite.ts` |
| D-28 | Humeur (bonus ≤ 6, sous `MARGE_PERTINENCE`) | `humeur.ts` |
| D-29 | `composeWardrobePool` : complétion par occasion, capsule avant relâchement | `selectors.ts` ≈650–720 |

## Décompte

- Identifiants historiques **présents dans le code** : R-B1 à R-B22 (22), R-S1 à R-S18 (18) — dont **R-S9 retirée** (29/08/2026) → 39 actifs ou signalés.
- Règles bloquantes de génération (A) : 11 identifiées + 3 règles D-01/02/03 = 14 ; **une seule** bloque l'enregistrement (R-B9).
- Règles de composition (B) : 24 lignes (dont 4 molles : R-S10, D-18, R-B16, R-S16).
- Compensations : R-B18 (thermique), R-B19 (collants), D-09 (veste compensatrice), D-14 (base sous calque).
- Scoring : 12 contributions au score (R-S1 à R-S8, R-S10, R-S11, R-S15, R-S18) + 3 suggestions proactives (R-S12, R-S13, R-S14). R-S16 et R-S17 sont des préférences de composition (section B), pas des termes du score : 17 `R-S*` actifs au total.
