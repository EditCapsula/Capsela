# Diversification de la tenue du jour sur cinq jours (01/10/2026)

## Pourquoi

« Tenue du jour » tirait chaque jour UN look indépendamment. Seule `worn` (jours
depuis le dernier porter VALIDÉ, R-S15) pesait dans le tirage, d'un facteur 1 à
4 ; jamais ce qui avait été RECOMMANDÉ sans être validé. Sur un dressing modeste,
la même chemise et le même jean ressortaient d'un jour à l'autre.

## Où ça se branche

`regen` (`store.tsx`), l'unique point de composition de la tenue du jour, appelle
`genererTenueDiversifiee` (`diversite.ts`) à la place du seul
`generateOutfitWithFallback`. Le moteur n'est pas modifié.

```
1. DATE            jour consulté → météo(D), occasion(D), fenêtre J-1…J-5
2. MÉTÉO + RÈGLES  generateOutfit : bornes de température, pluie, saison,
                   occasion, formalité, sport, cocooning — inchangé
3. CANDIDATS       16 tirages du même moteur : tous éligibles par construction
4. PERTINENCE      computeLookScore ; on garde ceux à 12 points du meilleur
5. DIVERSITÉ       score − pénalité de répétition (déterministe, explicable)
6. CHOIX           le plus haut ; égalité : le premier généré
```

La diversité ne rend jamais éligible une tenue que la météo écartait : elle ne
départage que des tenues déjà produites par le moteur. Sans historique, c'est le
tirage d'origine, inchangé.

## L'historique

- **porté** : `state.history` (`outfit_history`, avec la météo de la validation) ;
- **planifié** : `state.tenuesPlanifiees` (avec la prévision) ;
- **recommandé puis affiché** : `recommandationsRecentes.ts`, en localStorage par
  compte, élagué à 15 jours — la seule source ajoutée, parce que rien ne gardait
  une recommandation non validée (la tenue de chaque jour consulté ne vivait
  qu'en mémoire). Effacée avec le compte (`donneesLocales.ts`).
- la tenue affichée aujourd'hui entre à l'écart 0 : « Autre tenue » ne la
  reproposera pas.

## La pénalité

Par jour récent, `(pièces répétées + look) × facteur météo`, plafonnée à 100 au
total.

| | hier | J-2 | J-3 | J-4 | J-5 |
|---|---|---|---|---|---|
| pièce structurante répétée (haut, pull, bas, robe…) | 24 | 16 | 10 | 5 | 3 |
| accessoire, sac, bijou répété | 6 | 4 | 2 | 1 | 1 |
| chaussures, veste, manteau répétés | 3 | 1 | 0 | 0 | 0 |
| look identique (× récence 1 / .8 / .6 / .4 / .3) | 60 | 48 | 36 | 24 | 18 |
| mêmes pièces principales (idem) | 40 | 32 | 24 | 16 | 12 |
| une seule des deux pièces principales | 15 | 12 | 9 | 6 | 5 |

Facteur météo (le jour consulté contre le jour récent) : 1 si la température
diffère de 3° ou moins et que la pluie est la même ; 0,6 jusqu'à 6° ; 0,3 jusqu'à
10° ; 0,1 au-delà ; 0,25 si l'un des deux jours est pluvieux et pas l'autre.
Météo inconnue : 1 (on ne prétend pas une différence qu'on ne voit pas).

Une pièce commune à TOUS les candidats (un seul trench adapté) ajoute la même
pénalité partout et ne change donc pas le classement : la répétition imposée par
la météo n'est pas contrariée.

## Limites

- La météo du modèle n'a que la température et le libellé (`Weather`) : ni
  ressenti, ni vent.
- Le choix est déterministe sur les candidats ; les candidats viennent du moteur,
  qui tire toujours au hasard pondéré.
- Les 5 jours se lisent dans ce que l'appareil a vu : un jour jamais consulté,
  ni porté ni planifié, n'a pas d'historique.
