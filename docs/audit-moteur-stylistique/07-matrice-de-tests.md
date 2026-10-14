# 07 — Matrice de tests

## Ce qui a été exécuté (13/10/2026)

`npx vitest run` sur le commit `e72d577` : **132 fichiers, 1 857 tests, tous verts** (durée 18,8 s). Aucun test d'audit (`vitest.audit.config.mts`, qui interroge Supabase) n'a été lancé, hormis deux **requêtes ponctuelles en lecture seule** sur `vestiaire_universel` et un calcul de `getOutfitsForItem` hors dépôt (non conservé), pour A7. Rien n'a été vérifié en production.

## Couverture par règle (d'après les citations d'identifiants dans `src/lib/__tests__/`)

| Règle | Fichiers de test qui la citent |
|---|---|
| R-B3 | logic, saisonCapsule |
| R-B6 | accessoireTypeFor |
| R-B9 | logic, leviersMesure, vesteFraiche |
| R-B10 | leviersMesure, maillesFermees |
| R-B11 | accessoireTypeFor, swapOutfitPiece, formaliteSport |
| R-B16 | prevision |
| R-B19 | logic |
| R-B21 | sandalesDeFete, pluieChaussures |
| R-B22 | sandalesDeFete |
| R-S5 | attributes |
| R-S12 | outfitCopy |
| R-S13 | suggestionsMoteur, outfitCopy |
| R-S14 | suggestionsMoteur, vesteFraiche |
| R-S17 | occasions, maillesFermees |
| R-S18 | colorimetrieMoteur |
| **Aucun test ne cite l'id** | R-B1, R-B2, R-B4, R-B5, R-B7, R-B8, R-B12, R-B13, R-B14, R-B15, R-B17, R-B18, R-B20, R-S1, R-S2, R-S3, R-S4, R-S6, R-S7, R-S8, R-S10, R-S11, R-S15, R-S16 |

Une absence de citation **ne prouve pas** l'absence de test : plusieurs comportements sont couverts sous un autre nom (par exemple `lunettesDeSoleil.test.ts` pour R-B15, `baseSousCalque.test.ts` pour D-14, `diversite.test.ts`, `humeur.test.ts`, `variationTenue.test.ts`, `occasionRelachee.test.ts`, `saisonCapsule*.test.ts`, `traceRepli.test.ts`). Cette table est une mesure par grep, pas une mesure de couverture de code.

## Fichiers de test du moteur

`logic`, `leviersMesure`, `swapOutfitPiece`, `suggestionsMoteur`, `vesteFraiche`, `maillesFermees`, `baseSousCalque`, `sandalesDeFete`, `pluieChaussures`, `formaliteSport`, `lunettesDeSoleil`, `occasionRelachee`, `occasions`, `manches`, `variationTenue`, `diversite`, `humeur`, `colorimetrieMoteur`, `composeWardrobePool`, `saisonCapsule`, `saisonCapsulePourMeteo`, `chaleurHorsSaison`, `capsule`, `morphoDepartage`, `morphologieOrienteLaSelection`, `manteauEte`, `manteauIdees`, `ideesLooks`, `traceRepli`, `p1primeBras`, `outfitCopy`, `outfitBadges`, `noteTenue`.

## Cas limites identifiés et non couverts par un test nommé (à vérifier avant d'écrire un test)

| Cas | Lié à |
|---|---|
| Une pièce réelle portée il y a longtemps (`worn` figé à 0) : effet sur R-S15 et sur le tirage | A6 |
| Remplacement d'une jupe/d'un haut sous leur `meteoMinTemp` (génération vs `candidatsDeRemplacement`) | A5 |
| Tenue de dressing 100 % pulls + bas : `missing_required_category` ? | B |
| Short + collants selon la date planifiée (date système vs saison de la capsule) | A10 |
| Pièce de catalogue de formalité « sport » et occasions non sportives (hoodie 493/522) | A7 |
| `computeLookScore` : bornes 0 et 120 atteintes ; trois paliers R-S15 | — |
| Chaussures « Mules / Slingbacks / Derbies » absentes de la saisie, présentes dans les règles | A8 |

## Scénarios de régression recommandés (non exécutés)

1. **Mêmes entrées, deux parcours** : pour un même pool et une même météo, comparer les candidats de `generateOutfit` et de `candidatsDeRemplacement` pour chaque catégorie (A5).
2. **Vieillissement de `worn`** : un jeu où une pièce est portée il y a 30 jours dans l'historique mais `worn = 0` (A6).
3. **Bornes de score** : un jeu de tenues construit pour atteindre 120 et 30.
4. **Identité des tirages** : mêmes graine et pool → même tenue (idées), et tirages non déterministes de la tenue du jour : vérifier que l'invariant « toute tenue rendue respecte R-B9 » tient sur 1 000 tirages.
5. **Catalogue** : lister les pièces dont `niveau_formalite = "sport"` mais dont le nom ne désigne pas un vêtement de sport (étendre A7), via un audit en lecture seule conforme à la règle d'audit (`AGENTS.md`).
