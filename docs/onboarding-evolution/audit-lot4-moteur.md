# Lot 4 — préférences de silhouette dans le moteur : audit et proposition de pondération

31/10/2026. **Appliqué en production le 31/10/2026, après validation de la propriétaire** (points 1 à 4 ci-dessous) :
`STRATEGIE_PRODUCTION` porte `coupesPreferees: "apres_basique"` et `miseEnValeurPrime: true` ; la production d'avant est
`STRATEGIE_AVANT_LOT4`, référence de l'audit (`scripts/preferences-silhouette.audit.ts`, résultats identiques après le passage).

## Configuration gelée (AGENTS.md, points 1 à 3)

- Pool : la production au 31/10/2026 — export CSV + SQL Créatif 01, 02, 04, 05 simulés (845 articles, 618 vêtements).
- Fixes : `STRATEGIE_PRODUCTION` (sport « etiquette », direction morphologique « A »), météo représentative de chaque saison.
- Leviers : placement du rang « coupe préférée » (absent | avant_basique | apres_basique | apres_direction) ; mise en valeur
  (absent | prime). Baseline, chaque levier seul et la combinaison, dans la même exécution.
- Profils : femme 9 styles, homme 7 styles, 4 saisons ; chaque coupe préférée seule ; tenues : 8 occasions × 5 tirages.

## Dépendances identifiées

- Le levier n'agit qu'à la SÉLECTION de la capsule (`pickBestMarginal`), où agit déjà la morphologie. `computeLookScore` n'est pas
  touché : aucun terme de coupe ni de morphologie n'y entre, donc pas de double comptage.
- Ordre de la clé de sélection : couverture d'occasions (contrainte réelle) > [coupe] > basique > [coupe] > direction morphologique
  > [coupe] > id. Le style a déjà filtré le pool en amont : une coupe ne fait jamais entrer une pièce d'un autre style.
- Le dressing réel n'est pas concerné : `composeWardrobePool` remplace les suggestions par les pièces réelles, qui restent toutes.
- Coupe d'une pièce : `coupesPieces.ts` (règle validée : nom, puis matière). **50 % des vêtements du pool ont une coupe connue**
  (ajustées 25, droites 51, fluides 113, amples 93, structurées 67). Coupe inconnue = 0, jamais de pénalité.

## Résultats

**Garde-fou — DÉMONTRÉ.** Sans préférence ou avec « Cela dépend du vêtement », les leviers rendent la capsule de production à
l'identique : 0 capsule différente sur 64 × 3 placements × 2 cas.

**Contraintes réelles — DÉMONTRÉ (ce pool, météo représentative).** Aucun placement ne change les occasions couvertes (écart 0
partout) ni les tenues complètes (100 % partout).

Part des vêtements de la capsule ayant la coupe préférée (moyenne des capsules), et capsules modifiées :

| Femme | production | avant_basique | apres_basique | apres_direction |
|---|---|---|---|---|
| Ajustées | 4,8 % | +1,0 pt (7/36) | +0,7 pt (6/36) | +0,7 pt (6/36) |
| Droites | 9,1 % | +5,2 pts (22/36) | +3,9 pts (21/36) | +3,9 pts (21/36) |
| Fluides | 17,2 % | +8,6 pts (29/36) | +5,8 pts (24/36) | +5,8 pts (24/36) |
| Amples | 11,8 % | +5,7 pts (25/36) | +3,4 pts (22/36) | +3,4 pts (22/36) |
| Structurées | 16,4 % | +3,3 pts (23/36) | +2,8 pts (21/36) | +2,8 pts (21/36) |

| Homme | production | avant_basique | apres_basique | apres_direction |
|---|---|---|---|---|
| Ajustées | 1,0 % | +0,3 pt (2/28) | +0,3 pt (2/28) | +0,3 pt (2/28) |
| Droites | 17,0 % | +3,8 pts (14/28) | +2,0 pts (12/28) | +2,0 pts (12/28) |
| Fluides | 1,4 % | +2,4 pts (12/28) | +1,3 pt (9/28) | +1,3 pt (9/28) |
| Amples | 10,5 % | +3,3 pts (14/28) | +2,0 pts (9/28) | +2,0 pts (9/28) |
| Structurées | 18,0 % | +1,0 pt (7/28) | +1,0 pt (7/28) | +1,0 pt (7/28) |

- `avant_basique` rapporte le plus, mais coûte des pièces basiques (femme fluides : 22,9 → 22,3 par capsule).
- `apres_basique` et `apres_direction` sont identiques sans morphologie orientée ; ils diffèrent pour une poire ou un triangle
  inversé (combinaison ci-dessous).
- Effet faible pour « ajustées » : 25 vêtements seulement au catalogue (lot 5).

**Mise en valeur prime — DÉMONTRÉ (36 capsules femme).** Poire + « Mes hanches » : 29/36 capsules modifiées, pièces orientées par la
silhouette 7,1 → 6,5. Triangle inversé + « Mes épaules » : 24/36, 7,0 → 6,2. Tenues complètes : 100 % → 100 %.

**Combinaison** (poire, « Mes hanches », coupes fluides) : part fluide 17,0 % en production ; `apres_basique` 23,0 % ;
`apres_direction` 20,9 % seule, 22,3 % avec la mise en valeur.

## Proposition (ARBITRAGE ÉDITORIAL — validée et appliquée le 31/10/2026)

1. **Coupes : `apres_basique`.** La préférence explicite passe avant le conseil morphologique (principe du brief), jamais avant les
   occasions, et ne coûte aucune pièce basique. Gain : +0,7 à +5,8 pts côté femme, +0,3 à +2,0 pts côté homme.
2. **Mise en valeur : `prime` activée.**
3. Au passage en production : la fiche « pensée aussi pour ta silhouette » (écran Capsule, `pieceOrienteeParMorphologie`) doit tenir
   compte de l'axe neutralisé, sinon elle l'annoncerait à tort.
4. Phrase à l'écran : seulement ce qui est vrai — les coupes orientent la capsule ; la mise en valeur ne change la sélection que pour
   deux silhouettes. Proposition pour « Mise en valeur » : « Plusieurs choix possibles. Capsela en tient compte dans le choix des
   pièces de ta capsule, avant les repères de silhouette. » (vrai pour poire / triangle inversé ; sans effet ailleurs, la phrase ne
   promet pas de changement).

Non démontré : l'effet sur la tenue du jour (le score des tenues n'est pas modifié ; seule la capsule l'est) et sur un catalogue
dont les coupes seraient complétées (lot 5) — à remesurer alors (AGENTS.md, point 8).
