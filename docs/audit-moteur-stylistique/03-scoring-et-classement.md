# 03 — Scoring et classement

Source : `computeLookScore`, `src/lib/logic.ts:2087–2367`. Le score est **calculé sur la tenue déjà composée** (après tirage, compensations et ajouts) : il ne l'influence pas, sauf quand un appelant tire plusieurs tenues et choisit (diversité, humeur, idées autour d'une pièce).

## Formule exécutée

```
score = 100 − Σ pénalités + Σ bonus          (2222–2224)
score = max(0, min(120, score))              (2225)
badge  = "recommande" si score ≥ 80 ; "ajuster" si score < 50 ; sinon "neutre"   (2228)
adjustMessage = message de la PLUS FORTE pénalité, seulement si badge = "ajuster"  (2229)
```

Aucun arrondi : tous les termes sont des entiers. Plafond haut 120, plancher 0. Le détail de chaque contribution est conservé dans `regles` (utilisé par la note de l'avis de styliste, `noteAvis.ts`).

## Contributions

| Id | Sens | Points | Condition exacte | Ligne |
|---|---|---|---|---|
| R-S1 | − | 10 | plus de 3 teintes (`hex`) non neutres parmi les **vêtements** | 2117–2121 |
| R-S2 | + | 15 | au moins deux pièces non neutres (hors bijou) de `hex` différents et dont les teintes sont à ≤ 40° ou à 150–210° (`huesHarmonious`) | 2123–2134 |
| R-S3 | + | 10 | règle 60/30/10 approximée : poids vêtement 3, autres 1, par `hex` ; part du premier ≥ 0,5 et du second ≤ 0,35 | 2136–2147 |
| R-S4 | − | 5 | plus d'un métal parmi les pièces (`metalOf`, bijou/accessoire seuls) | 2149–2151 |
| R-S5 | − | 15 | au moins deux pièces `isStatement` | 2153–2157 |
| R-S6 | + | 10 | chaussures de couleur neutre, ou de même `hex` qu'un vêtement | 2159–2163 |
| R-S7 | − | 10 | sac ET chaussures `isStatement` | 2165–2169 |
| R-S8 | + | 5 | plus d'une matière (`matiereOf`, hors bijou) | 2171–2173 |
| R-S9 | — | — | **retirée le 29/08/2026** : plus aucun terme morphologique dans le score | 2175–2188 |
| R-S10 | + | 10 | une pièce dont le `hex` est dans la palette du profil | 2190–2191 |
| R-S18 | + | 10 | `accordVisage` : une pièce du visage dans la saison, aucune « à modérer » (colorimétrie utilisable seulement) | 2193–2195 ; `colorimetrieMoteur.ts` |
| R-S11 | + | 10 | un haut « base » ET un haut « calque », hors occasion habillée | 2197–2203 |
| R-S15 | − | 30 / 15 / 5 | plus petit `worn` parmi les vêtements : ≤ 1 / ≤ 3 / ≤ 14 (une seule branche) | 2205–2220 |

## Cumul, exclusivité, double comptage

- **Cumulables** : tous les bonus et toutes les pénalités s'additionnent (aucune exclusion mutuelle codée), sauf les trois paliers de R-S15 (`if / else if`).
- Maximum théorique : 100 + 15 + 10 + 10 + 5 + 10 + 10 + 10 = **170**, ramené à **120**. Minimum théorique : 100 − (10 + 5 + 15 + 10 + 30) = **30**.
- **Même condition comptée deux fois** : R-S5 (deux statements) et R-S7 (sac + chaussures statements) peuvent se déclencher ensemble sur les mêmes pièces (−25) ; R-S2 et R-S3 peuvent s'appliquer simultanément. Ce sont des termes distincts voulus, pas un double comptage involontaire — **non vérifié comme intention métier**.
- Valeurs manquantes : `matiereOf` retombe sur une matière par défaut de la catégorie (puis « Coton »), `isNeutralColor("")` est faux, `worn = null` ignore R-S15. Voir `05`.

## Suggestions proactives (R-S12 à R-S14)

Indépendantes, dismissibles séparément, **sans effet sur le score** :

| Id | Clé | Condition | Pièce suggérée |
|---|---|---|---|
| R-S12 | `layer` | un seul haut, calque, pas de robe/combinaison, non dressy | aucune |
| R-S13 | `color` | tous les vêtements « noir » et aucun accessoire coloré (`isColorAccent`) | `findSuggestedPiece(["bijou","accessoire"])` |
| R-S14 | `veste_soir` | pas à la maison, temp ≤ 21, ni veste ni manteau | veste/manteau de saison ; en sport, décontractée (`formalityOf ≤ 1`) préférée |

Depuis le 12/10/2026, la pièce suggérée est prise parmi `candidatsDeRemplacement` (mêmes règles que le moteur), dressing d'abord (`dressingDAbord`, 2301).

## Classement des tenues entre elles

| Mécanisme | Où | Règle |
|---|---|---|
| Diversité d'idées (pivot) | `selectDiverseVariations` 2502 | éligibles à ≤ 5 points du meilleur ; poids 8 bas / 4 chaussures / 2 couleur / 1 couche ; distance 0 écartée |
| Diversité 5 jours | `diversite.ts` | 16 tirages ; éligibles à ≤ `MARGE_PERTINENCE` = 12 points du meilleur ; retient `score − pénalité` ; pénalité plafonnée à 100 |
| Humeur | `humeur.ts` | éligibles à ≤ `MARGE_PERTINENCE`, bonus = 6 × part de pièces répondant à l'humeur ; 10 tirages |
| Variation substantielle | `varieSubstantiellement` 3127 | socle différent, ou ≥ 2 pièces principales différentes |

Note : `MARGE_PERTINENCE` (12) et le score (0–120) ne sont pas à la même échelle que la tolérance d'idées (5) ; les trois seuils sont indépendants.

## Exemples de calcul (dérivés du code)

1. Tenue neutre et sobre (1 matière différente par catégorie), aucune pénalité : 100 + R-S8 (5) + R-S6 (10) = **115**.
2. Même tenue, haut porté hier : 115 − 30 = **85** (reste « recommande »).
3. Deux statements (R-S5) + sac et chaussures statements (R-S7) + trop de teintes (R-S1) : 100 − 15 − 10 − 10 = **65** (« neutre ») ; ajouter R-S15 (−30) → **35** (« ajuster », message : celui de R-S15).
