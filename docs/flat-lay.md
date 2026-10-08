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

## Calibrage du 08/10/2026 (dimensions réelles, 390 × 844 px)

Mesuré en rendu réel, pas sur la maquette conceptuelle (180 × 250, 300 × 390, hero 370–380 px). Ces règles s'appliquent aux
deux contextes ; les valeurs sont des constantes exportées de `flatLay.ts`, testées dans `flatLay.test.ts`.

| Écran | Carte | Zone du flat lay |
|---|---|---|
| Accueil | 358 × 307 px (marge de 16 px) | 181 × 203 px, colonne à droite du texte (`clamp(140px, 55,5 %, 181px)`) |
| Tenue du jour | 358 × 564 px (hauteur fixe) | 310 × 350 px, les badges se posent par-dessus le haut |

Le hero et la carte Tenue du jour débordent de 8 px la gouttière de 24 px du reste de l'écran (marge de 16 px) — l'en-tête et
la navigation ne changent pas. Les largeurs de zone suivent l'écran (360 → 164 × 184 px sur l'accueil, 280 × 350 sur Tenue) ; la
hauteur de Tenue reste de 350 px.

- **Pièce héro** : 58 % de la largeur de la zone au plus (elle rétrécit sur place, après l'ajustement à la zone).
- **Chevauchements** : deux pièces ne se recouvrent pas de plus de 18 % de la plus petite, et une pièce n'est jamais masquée à
  plus de 20 % (cumulé) par celles du dessus. Mesuré sur la boîte tournée de chaque pièce — une mesure prudente, la silhouette
  réelle laisse du vide dans sa boîte. La pièce la moins importante s'écarte de proche en proche (`desserrer`).
- **Inclinaisons** (`LIMITE_INCLINAISON`) : héro ±4°, secondaires et bas ±5°, chaussures ±8°, sac ±6°, accessoires ±10°. Elles
  bornent tout angle : gabarit, jitter de la graine, miroir, inclinaison préférée. Elles remplacent les 8° / −12° de la maquette
  du 07/10.
- **Accessoires** : deux au plus ; un accessoire de moins de 8 % de la largeur de la zone n'est pas posé.
- **Marge** : 12 px entre les pièces et les bords de la zone sur l'accueil (6,6 unités), 14 px sur Tenue ; une réserve de 28 px en
  haut de la zone Tenue (`margeHaute`) pour la ligne de badges.
- **Pièce sans visuel** : elle sort de la planche, qui se recalcule avec les autres ; ni vide, ni pastille de couleur. Aucune
  pièce n'a de visuel (mode démo, catalogue hors ligne) : les pastilles restent, sinon la zone serait vide.
- **Tailles par catégorie, ombre, graine** : inchangées (cf. plus haut).

## Regroupement stylistique (08/10/2026)

Le flat lay ne place pas les pièces par catégorie seulement : il comprend celles qui se portent ensemble. Cette règle est
**prioritaire sur l'équilibre géométrique** — on ne cherche pas à remplir toute la zone.

- **Rôle `couche`** : le second haut d'une tenue (t-shirt sous un pull, chemise ou débardeur sous un cardigan, top sous une
  veste). Le haut du second plan est la couche EXTÉRIEURE (un pull ou un cardigan avant un t-shirt) ; une seule couche ; sous
  une robe, un haut de plus reste un surnombre.
- **Pose** : contre la pièce qu'elle double (le haut du second plan, sinon le héro), juste dessous, légèrement derrière
  (`z` 25, entre le bas et le haut), décalée vers le centre. Elle la recouvre de 14 % de sa hauteur (≤ 18 %) : la distance entre
  les deux est donc nulle, jamais plus de 15 % de la largeur de la zone. Le désserrement ne sépare jamais une couche de sa
  pièce (`groupeAvec`) ; face aux autres pièces, la couche prime (importance 4,5, derrière le héro seulement).
- **Gabarit « groupe »** (`refsGroupe`) : un bas héro (pantalon, jean, jupe, short) avec une couche. Le groupe des hauts à gauche,
  le bas à droite, les chaussures sous le groupe, le sac sous le bas. Jamais en miroir — la couche reste lisible.
- **Ordre de construction** : 1. les groupes, 2. la pièce principale, 3. la couche contre son groupe, 4. les autres catégories
  autour, 5. chaussures et accessoires pour équilibrer.
- Profondeur : `dessus` 10, `bas` / `robe` 20, `couche` 25, `haut` 30, `chaussures` 40, `sac` 50, `accessoire` 60.

Limite connue : une tenue à six pièces avec veste héro, deux hauts et un bas se range dans la zone avec moins d'air — la couche
reste contre son haut, le bas s'écarte d'elle.

## Hero mobile (390 px)

Carte 358 px de large (marge de 16 px). La colonne de la composition fait 181 px, zone `100 / 112`. Zone de sécurité : 12 px
autour de la composition + le padding de la carte. Le flat lay ne recouvre jamais le titre, la description, « Voir le look »,
« Sauvegarder » ni « Autre idée ».
