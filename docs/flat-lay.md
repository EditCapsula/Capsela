# Flat lay du hero « Ton look du jour » — standard image et moteur

Décidé le 08/10/2026. Le hero de l'accueil pose les pièces du look comme sur une planche de stylisme (`FlatLayCapsela`,
`src/lib/flatLay.ts`). Ce document fixe ce que le moteur attend des images et ce qu'il en fait.

## Les images

| | Standard |
|---|---|
| Format source | PNG, fond transparent, 1024 × 1024 (génération) |
| Fichier enregistré | WebP, fond transparent, 800 px au plus sur le grand côté |
| Visuel standard (`url_image`) | carré 800 × 800, la pièce n'en occupe que 22 à 85 % ; ses marges sont dans `src/lib/catalogMarges.ts` |
| Visuel hero (`url_image_hero`, migration 0049) | rogné sur la pièce DÈS LA GÉNÉRATION ; le format est dans le nom du fichier : `…-r0.83.webp` (largeur / hauteur) |

Le moteur ne dépend pas du canevas du fichier. Il lit la **boîte réelle de l'objet** (`objectBounds`, `{ x, y, width, height }`
en fractions de l'image) : celle du tableau des marges pour un visuel standard, toute l'image pour un visuel hero, aucune
pour une photo du dressing (un portrait courant est alors supposé). La taille d'une pièce se calcule sur cette boîte, jamais
sur la taille du fichier — c'est ce qui évite l'effet « autocollant » et les marges transparentes qui rapetissent une pièce.

Régénérer les marges d'un nouveau visuel standard : `node scripts/mesurer-marges-catalogue.mjs chemins.txt`. Générer des
visuels hero : workflow « Générer les visuels hero du catalogue (admin) », avec des ids explicites.

## La taille visuelle par catégorie

La part d'un canevas carré que doit occuper chaque type de pièce (milieu des plages du standard), `PART_VISUELLE` :

| Catégorie | Part |
|---|---|
| T-shirt, chemise, pull | 77,5 % |
| Blazer, veste | 82,5 % |
| Manteau, robe, ensemble | 87,5 % |
| Pantalon, jean | 85 % |
| Jupe | 75 % |
| Short | 70 % |
| Sac, chaussures | 70 % |
| Accessoire, bijou | 62,5 % |

Elle sert à rapporter une pièce à la pièce de référence de son rôle (`echelleVisuelle`, bornée entre 0,82 et 1,12) : une jupe
en bas est un peu plus petite qu'un pantalon, un manteau un peu plus grand qu'un blazer.

## Ce que le moteur calcule pour chaque pièce

`category`, `role`, `visualScale`, `x`, `y`, `l` / `h` (taille de la boîte réelle), `angle` (rotation), `z` (profondeur).
Le gabarit de référence (`REF`) vient de la maquette validée ; la graine (l'identité du look) ne le fait varier que de ±2 de
position, ±3 % de taille et ±1,5° d'angle. Une veste ou un manteau héro est toujours à droite et au fond.

## Contextes (un moteur, des paramètres)

Une même image de pièce sert partout ; `FlatLayCapsela` (`items`, `context`, `layoutSeed`) règle seulement taille, position,
rotation, profondeur et composition selon le contexte (`CONTEXTES`, `src/lib/flatLay.ts`) :

| Contexte | Zone (largeur 100) | Usage |
|---|---|---|
| `hero-home` | 100 × 112 (≈ 180 × 200 px à 390) | hero de l'accueil — compact, gabarit de la maquette validée |
| `look-detail` | 100 × 126 (≈ 300 × 380 px) | écran Tenue du jour — héro plus grand, robe centrée avec sac et chaussures dessous, angles du brief |
| `capsule`, `dressing`, `packing` | 100 × 100 | prévus, branchés au moteur, sans écran concerné pour l'instant |

**Accessoires.** Un accessoire n'est affiché que s'il sert la composition : au plus 2 (3 en `look-detail`) — 1 ou 2 à partir de
6 pièces —, un accessoire de tenue (ceinture, foulard) avant un bijou ; il prend l'emplacement qui le colle à la planche sans
couvrir une pièce importante (≤ 12 % de sa surface) ; au-delà de 12 unités de la pièce la plus proche il est écarté. Le moteur
rend aussi la liste des pièces écartées (`ecartees`).

**Pièce facultative.** `visualScale`, `preferredRotation` (bornée) et `flatLayCompatible` (false = hors planche) peuvent être
portés par une pièce ; le catalogue actuel ne les a pas, les défauts s'appliquent.

## Hero mobile (390 px)

Carte ≈ 342 px de large (gouttière de 24 px). Colonne de la composition ≈ 60 % de la carte (grille 0,8fr / 1,2fr), zone
`100 / 112`. Zone de sécurité : 4 unités autour de la composition + le padding de la carte, soit au moins 16 px des bords de
la carte, du texte, du CTA et des actions. Le flat lay ne recouvre jamais le titre, la description, « Voir le look »,
« Sauvegarder » ni « Autre idée ».
