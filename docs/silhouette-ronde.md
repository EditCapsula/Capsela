# La silhouette ronde dans le moteur (15/11/2026)

Brief de la propriétaire : « Évolution du moteur de recommandations Capsela – Gestion des silhouettes rondes ». Principe éditorial :
**habiller les formes, pas les dissimuler**. Code : `src/lib/silhouetteRonde.ts`. Tests : `src/lib/__tests__/silhouetteRonde.test.ts`.
Mesure : `scripts/silhouette-ronde-moteur.audit.ts` (run 47).

## Arbitrages (15/11/2026)

- Les cinq morphologies restent telles quelles. X et 8 restent réunis dans « Taille bien marquée » (`f_sablier`), faute de donnée ou
  de visuel pour les distinguer.
- La silhouette ronde est un **complément** de la morphologie (`Profile.corpulence` : fine / moyenne / ronde). **La question n'est
  pas posée pour l'instant** : rien ne l'écrit ni ne la lit en base. D'ici là, la seule silhouette ronde connue est la morphologie
  « Silhouette plutôt ronde et régulière » (`f_pomme`).
- Effet : la **sélection de la capsule** (un rang) et un **bonus de tenue** (R-S20), **sans phrase, sans malus**. Les seuils de
  score ne changent pas. R-S9 (règle morphologique du score, retirée le 29/08/2026) ne revient pas : R-S20 lit le vêtement, jamais le
  corps, et n'affiche rien.

## Les familles de pièces (lues sur le vêtement)

| Famille | Repérage | Pièces femme (run 47, 391 vêtements) |
|---|---|---|
| `matiere_tenue` | crêpe, jersey, milano, viscose, maille, élasthanne, cachemire… sans compression | 81 |
| `ajuste_doux` | coupe « Ajusté », cintré, ajusté — jamais moulant ni « Serré » | 36 |
| `encolure` | col V, décolleté, col carré, col ouvert, cache-cœur | 24 |
| `bas_large` | wide, large, palazzo | 21 |
| `blazer_structure` | blazer, tailleur, structuré, cintré | 17 |
| `bas_droit` | droit, straight, cigarette | 13 |
| `portefeuille` | portefeuille, cache-cœur, croisé | 11 |
| `trapeze` | trapèze, évasée, patineuse | 8 |
| `jupe_droite` | crayon, droite | 7 |
| `manteau_ceinture` | ceinturé, trench | 3 |
| `bas_evase` | bootcut, flare | 3 |
| `manteau_droit` | manteau droit, mi-long | 2 |
| `veste_ouverte` | kimono, gilet long, ouvert | 1 |

## La combinaison avec la morphologie

| Morphologie + ronde | Favorisé | Non favorisé (jamais pénalisé) |
|---|---|---|
| A (hanches marquées) | encolures, épaules structurées, bas droits ou évasés, trapèze, portefeuille | bas larges |
| V (épaules larges) | bas larges ou évasés, trapèze, encolures, portefeuille | épaules structurées |
| H (fine et droite) | portefeuille, ceinturé, ajusté, trapèze, blazer, bas droits | bas larges, jupe crayon |
| X / 8 (taille marquée) | portefeuille, ceinturé, ajusté, jupe crayon, bas droits ou évasés | trapèze, bas larges |
| Ronde seule | encolures, pièces ouvertes, manteaux droits, bas droits / larges / évasés, portefeuille, trapèze | — |

Les morphologies A et V gardent leur règle propre (`valeurDirection`, `capsule.ts`), rangée **avant** la silhouette ronde : celle-ci ne
départage qu'à égalité.

## Le scoring

- **Capsule** : `SelectionStrategy.silhouetteRonde = "rang"`, après la direction morphologique et la coupe préférée, avant le
  départage des couleurs. Jamais un filtre.
- **Tenue (R-S20)** : +6 pour deux vêtements compatibles ou plus, +3 pour un. Deux vêtements amples ou plus retirent le bonus
  (accumulation de volumes) sans pénaliser. Aucune couleur n'entre : ni sombre imposé, ni monochrome obligatoire. Le score des
  tenues ne départage la tenue du jour que lorsqu'un historique récent existe (`diversite.ts`).

## Mesure (run 47) — DÉMONTRÉ pour un style à la fois, sans dressing, météo représentative

| Combinaison | Vêtements compatibles dans la capsule | Pièces changées | Tenue : choix changé | Occasions impossibles |
|---|---|---|---|---|
| Ronde seule | 36,7 → 42,5 % | 1,6 | 21,9 % | 0 → 0 |
| Ronde + A | 32,9 → 38,1 % | 1,4 | 18,8 % | 0 → 0 |
| Ronde + V | 26,6 → 30,4 % | 1,1 | 11,1 % | 0 → 0 |
| Ronde + H | 47,5 → 55,1 % | 2,1 | 21,9 % | 0 → 0 |
| Ronde + X / 8 | 47,7 → 55,1 % | 2,0 | 20,5 % | 0 → 0 |
| Témoin X / 8 sans ronde | 0 → 0 | 0 | 0 % | 0 → 0 |

Taille de capsule, pièces du style et basiques inchangés ; aucune tenue dont le score baisse.

## Limites du catalogue

- Colonnes `longueur` et `couche` vides (0 %) : les longueurs ne sont pas prises en compte, les pièces ouvertes et manteaux droits
  ne se repèrent qu'au nom (1 et 2 pièces).
- `matiere_tenue` est large (la viscose et l'élasthanne n'indiquent pas toujours une bonne tenue) : à affiner quand la matière sera
  décrite plus finement.
- Peu de bas évasés (3), de manteaux ceinturés (3) et de pièces ouvertes (1) : la règle ne peut pas proposer ce que le catalogue n'a pas.
- **NON DÉMONTRÉ** : profils à plusieurs styles, dressings remplis, Planifier et la valise (leur score ne reçoit pas la morphologie).
