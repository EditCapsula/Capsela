# 01 — Cartographie du moteur stylistique

Audit en lecture seule du 13/10/2026, sur le commit `e72d577` (branche `claude/dazzling-sagan-ywhfbi`). Règle de lecture : le code prime sur toute documentation. Toutes les lignes citées sont celles de ce commit. **Rien n'a été exécuté en production** : tout ce qui est dit « confirmé » l'est par lecture du code (et, pour le catalogue, par une lecture seule de `vestiaire_universel`).

## Un seul moteur de génération, plusieurs appelants

`generateOutfitWithFallback` (`src/lib/logic.ts:1689`) est le point d'entrée unique de la composition d'une tenue. Il enchaîne des appels à `generateOutfit` (`logic.ts:721`), dont chaque tirage est **aléatoire** (`Math.random`, aucune graine) sauf quand l'appelant l'enveloppe dans `avecTirageDeterministe` (`src/lib/looks.ts:95`).

| Couche | Fichier (fonction, ligne) | Rôle |
|---|---|---|
| Contexte | `capsule.ts` : `weatherForDay` (207), `saisonCapsuleDuJour` (191), `estDeSaison` (277), `contexteCapsule` (267) | météo du jour, saisons admises, saison de la capsule |
| Pool | `selectors.ts` : `composeWardrobePool` (≈650) ; `capsule.ts` : `computeDefaultCapsule` (723) | pièces réelles d'abord, capsule en complément |
| Filtres durs | `logic.ts` : `hardCategoryFilter` (812), `applySportCocooningFilter` (134), `applyTempFilter` (957), `poolFor` (1052) | exclusions jamais relâchées / échelle de replis |
| Composition | `logic.ts` : `generateOutfit` (721–1586), `pick` (1107), `harmonize` (591), `rand` (684) | tirage pièce par pièce |
| Repli de formalité | `logic.ts` : `FORMALITY_FALLBACK_CHAIN` (1603), `attemptCoreOutfit` (1668) | descend d'un palier si pas de socle |
| Notation | `logic.ts` : `computeLookScore` (2087) | score 0-120, badge, suggestions proactives |
| Signalement | `logic.ts` : `evaluateBlocking` (1957) | bandeaux doux (Créer un look) ; R-B9 seul est « hard » |
| Remplacement | `logic.ts` : `candidatsDeRemplacement` (1779), `swapOutfitPiece` (1925) | échanger une pièce, mêmes règles |
| Idées autour d'une pièce | `logic.ts` : `getOutfitsForItem` (≈2600), `selectDiverseVariations` (2502) | « Comment porter cette pièce ? » |
| Diversité 5 jours | `diversite.ts` : `genererTenueDiversifiee`, `choisirParDiversite` | tenue du jour, départage de tirages valides |
| Humeur | `humeur.ts` : `genererTenueHumeur` | départage (Planifier, étape 4) |
| Couleur / colorimétrie | `colorimetrieMoteur.ts` : `candidatsCouleur`, `accordVisage` | préférences molles près du visage |
| « Autre tenue » | `logic.ts` : `choisirVariation` (3141) ; `store.tsx` `regenOutfit` (≈2586) | variation substantielle |

## Appelants (parcours)

| Parcours | Appelant | Particularités |
|---|---|---|
| Tenue du jour | `store.tsx` `regen` (1209) → `genererTenueDiversifiee` | pool = `composeWardrobePool(..., completerPourOccasion, saison, exclureHorsOccasion)` ; diversité sur 5 jours ; colorimétrie |
| Autre tenue / Autre idée | `regenOutfit` → `choisirVariation` (12 essais) | évite les tenues vues ou refusées (`pas_aujourdhui`) |
| Planifier | `PlanifierScreen.tsx` (≈490–520) → `genererTenueHumeur` | humeur facultative, soirée habillée, météo du lieu |
| Adapter un look planifié | `alerteMeteo.ts` → `candidatsDeRemplacement` | mêmes règles que le remplacement (12/10) |
| Comment porter cette pièce | `ItemOutfitsScreen.tsx`, `ideesLooks.ts` → `getOutfitsForItem` | pièce pivot, 10 occasions, tirages déterministes |
| Idées du Dressing | `WardrobeScreen.tsx` → `generateOutfitWithFallback`, `getOutfitsForItem` | tirages déterministes |
| Créer un look (manuel) | `CreateLookScreen.tsx` → `evaluateBlocking`, `applySportCocooningFilter` | aucune génération ; règles signalées, pas imposées |
| Valise | `valise.ts` (`completerChaussuresEtSac`), `ValiseScreen.tsx` | le moteur compose avec les pièces choisies |
| Avis de styliste | `noteAvis.ts` → `computeLookScore` | note = familles de règles lues dans `regles` |
| Capsule | `computeDefaultCapsule` | sélection du catalogue (pas de tenue) |

## Données d'entrée

`Item` (`src/lib/types.ts`), `Weather` (`data.ts`), `Profile` (`profile.ts`), `HistoryEntry`, `TenuePlanifiee` (`planifier.ts`). Détail et valeurs par défaut : voir `05-metadonnees-et-dependances.md`.

## Ce qui n'a pas été lu en détail

`valise.ts` (914 lignes), `alerteMeteo.ts` (294), `planDuJour.ts`, `ideesLooks.ts`, `garmentEffect.ts` (modèle morphologique V2, hors score) et les composants d'écran n'ont été lus que par leurs points d'appel au moteur. Les règles qu'ils appliquent *autour* du moteur (par exemple l'ordre d'affichage des pièces) ne sont pas inventoriées ici.
