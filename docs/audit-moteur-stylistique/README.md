# Audit du moteur stylistique Capsela — état des lieux au 13/10/2026

Audit **en lecture seule** de l'implémentation, sur le commit `e72d577`. Aucun code applicatif, aucune donnée ni aucune règle n'a été modifié. Le code prime ; la documentation historique du moteur n'est pas dans le dépôt (voir `06`, section C).

## À lire en premier

| Document | Contenu |
|---|---|
| [`02-regles-effectivement-implementees.md`](02-regles-effectivement-implementees.md) | **Référence pour la suite de l'audit** : inventaire des règles, conditions, effets, lignes |
| [`03-scoring-et-classement.md`](03-scoring-et-classement.md) | formule exacte du score et du classement |
| [`06-anomalies-et-ecarts.md`](06-anomalies-et-ecarts.md) | 12 constats confirmés, questions métier |
| `01`, `04`, `05`, `07` | cartographie, flux (Mermaid), métadonnées, tests |

## Principaux constats

1. **Un seul moteur** (`generateOutfitWithFallback`) alimente la tenue du jour, Planifier, les idées, la valise ; la diversité sur 5 jours et l'humeur ne font que départager des tenues qu'il a produites.
2. **39 règles `R-*` actives** (R-B1 à R-B22, R-S1 à R-S18 sans R-S9 retirée) ; seule **R-B9** bloque l'enregistrement. Le score va de 30 à 120 (12 termes).
3. **La morphologie n'agit plus que sur la capsule**, et pour 2 morphologies sur 5 ; le score n'a plus aucun terme morphologique.
4. **Anomalies confirmées les plus importantes** : `Item.worn` ne vieillit pas alors que R-S15, R-B7 et le poids de tirage le lisent (A6) ; le remplacement et la génération n'ont pas la même règle de température (A5) ; l'identifiant R-B18 désigne deux règles (A1) ; le « Sweat à capuche » du catalogue est classé « sport », ce qui explique « Pas encore assez de pièces compatibles » (A7).
5. **Les parcours ne sont pas parfaitement alignés** : trois définitions de « tenue complète » (A11), le collant du short lit la date système (A10).

## Limites de l'audit

- Lecture du code seulement ; **rien n'a été mesuré en production**, aucune politique RLS ni Edge Function n'a été lue.
- `logic.ts` (3 161 lignes), `capsule.ts` (1 114), `diversite.ts`, `colorimetrieMoteur.ts`, `humeur.ts` lus en entier ; `valise.ts`, `alerteMeteo.ts`, `planDuJour.ts`, `selectors.ts` (hors `composeWardrobePool`) et les écrans lus par leurs points d'appel.
- Tests : `npx vitest run` — 132 fichiers, 1 857 tests verts. Couverture par règle mesurée par grep, pas par instrumentation.
