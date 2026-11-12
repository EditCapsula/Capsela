# Accords de couleurs à la Wada

Arrêté le 12/11/2026, demandé par la propriétaire : « reprendre les grands principes de *A Dictionary of Color Combinations* »,
option B, partout (Capsule, Dressing — c'est le moteur unique, donc aussi la tenue du jour et la valise).

## Ce qui est repris

Les **principes** du livre de Sanzo Wada, jamais ses données (ni ses 348 associations, ni des relevés de couleurs faits par des tiers,
dont la licence n'est pas vérifiée) :

1. L'harmonie est concrète, pas géométrique : deux couleurs peuvent s'accorder sans être voisines ni opposées sur le cercle.
2. Des tons **rompus** et au plus **une couleur franche**, en accent.
3. Un **écart de clarté** entre la couleur la plus claire et la plus foncée de la tenue.

## Où dans le code

- `src/lib/accordsCouleurs.ts` : `estFranche`, `formeUnAccord`, `accordAPlusieursCouleurs` — fonctions pures, testées.
- `harmonize` (`logic.ts`) : avant, une seule couleur affirmée par tenue ; désormais une autre couleur reste candidate si elle forme
  un accord avec celles déjà choisies. Les neutres restent candidats à côté d'elle.
- `computeLookScore` : **R-S19**, +10 pour un accord à plusieurs couleurs (R-S2, le cercle chromatique, reste à +15).
- Levier de mesure `LeviersMesure.sansAccordsWada` : le comportement d'avant, pour l'audit `scripts/accords-wada.audit.ts`.

## Seuils — arbitrage éditorial, validé le 12/11/2026

Franche : saturation HSL ≥ 0,5 et clarté entre 0,25 et 0,75. Écart de clarté : 0,25. Trois couleurs non neutres au plus (R-S1).
Une couleur inconnue ne forme jamais d'accord.

## Mesure (12/11/2026, audit `accords-wada`, avant / après dans la même exécution)

889 pièces, 6 profils × 4 saisons × 4 occasions × 25 tirages, sur les capsules, sans palette ni colorimétrie.

| | Avant | Après |
|---|---|---|
| Tenues complètes | 100 % | 100 % |
| 2 couleurs non neutres ou plus | 18,8 % | 22,6 % |
| Accord à plusieurs couleurs (R-S19) | 8,9 % | 14,6 % |
| 2 couleurs franches | 1,6 % | 1,4 % |
| Plus de 3 couleurs | 0,2 % | 0,2 % |

DÉMONTRÉ sur ces capsules. NON DÉMONTRÉ sur de vrais dressings et avec la palette ou la colorimétrie du profil.
Validé par la propriétaire le 12/11/2026.
