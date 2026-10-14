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

## Accueil : composition ciblée sans le t-shirt (08/10/2026)

Sur l'accueil (`hero-home`, zone 181 × 203 px) la planche privilégie la silhouette : la **couche** (t-shirt sous un pull) reste dans la
tenue, dans le détail du look et dans tous les autres contextes, mais n'est pas posée dans cette planche (`masquerCouche`, résultat
`masquees`). Le gabarit « groupe » se décide sur toute la tenue : un pull + pantalon masqué de son t-shirt garde son gabarit.

Les **collants** sont traités de la même façon (`accessoiresMasques`, 08/10/2026) : leur visuel à plat ne se lit pas, ils ne sont donc
pas posés dans le hero de l'accueil ; ils restent dans la tenue et dans le détail du look.

Composition d'un blazer / manteau héro (`refsDessus`) — positions en parts de la zone, converties en unités du moteur :

| Pièce | Centre x | Centre y | Largeur | Angle |
|---|---|---|---|---|
| Pull | 28 % | 28 % | 40 % | +2° |
| Pantalon | 62 % | 48 % | 44 % | −2° |
| Blazer | 80 % | 32 % | 40 % | +4° |
| Sac | 22 % | 76 % | 28 % | −6° |
| Boots | 78 % | 78 % | 30 % | −8° |

Le moteur ajuste l'ensemble à la zone de sécurité (12 px au minimum, `marge` 7,4 unités — 12 px à 360 px, 13 px à 390 px) : les
largeurs finales sont un peu inférieures aux cibles (le blazer à 80 % + 20 % toucherait le bord). Le blazer reste derrière le
pantalon (règle de profondeur : la veste et le manteau sont toujours au fond), alors que le brief lui donnait un z-index de 2.

**ARBITRAGE ÉDITORIAL** : les positions ciblées font passer le pantalon devant le blazer sur près de la moitié de la BOÎTE de ce
dernier (une mesure prudente — la silhouette réelle laisse du vide). Les seuils de 18 % / 20 % valent pour les autres contextes ;
sur l'accueil ils sont à 60 % (`chevauchementMax`, `masqueMax`). Un arbitrage instruit pour cette composition et ce contexte : il ne
se généralise pas à un autre.

Mesuré sur un look blazer + pull + pantalon + sac + boots : pull 36 % de la zone (27 % avant), pantalon 39 % (26 %), boots 28 %
(23 %), sac 26 % (21 %), blazer 36 % (36 %) ; la planche occupe 84 % de la largeur et 74 % de la hauteur.

## Hero mobile (390 px)

Carte 358 px de large (marge de 16 px). La colonne de la composition fait 181 px, zone `100 / 112`. Zone de sécurité : 12 px
autour de la composition + le padding de la carte. Le flat lay ne recouvre jamais le titre, la description, « Voir le look »,
« Sauvegarder » ni « Autre idée ».

## « Tes looks » du Dressing (09/10/2026)

Cause du manque de lisibilité, mesurée : la zone `look-detail` est un portrait (100 × 126) posé dans une carte à l'italienne (ratio 1,25).
À 390 px, la carte (267 × 214 px) ne laissait à la planche que 170 px de large (le reste était vide) ; les pièces y étaient environ
30 % plus petites que nécessaire. Source des visuels inchangée : les images des pièces (photos détourées de l'utilisatrice ou visuels
du catalogue), composées par `FlatLayCapsela` — le correctif est de présentation.

- Ratio de la carte : 0,9 (au lieu de 1,25), même largeur (`min(78 %, 300px)`) : l'aperçu de la carte suivante reste (≈ 60 px à 390 px).
  La planche passe à 236 px de large (+ 39 %).
- Fond : blanc cassé des cartes (`--color-card`) cerné de `--color-border`, depuis le 14/10/2026 (option 3h, comme le hero de l'accueil). Le grège en dégradé radial d'avant (`--color-flatlay-bg`, retiré) faisait ressortir les pièces blanches et beiges ; à surveiller en rendu réel.
- Ombre `marquee` (propriété `ombre` de `FlatLayCapsela`) : une ombre de contact serrée sous une ombre diffuse. Le hero et la Tenue du
  jour gardent l'ombre `douce`.
- Look montré : parmi les trois premières idées du moteur pour la pièce, la plus complète (`ideeLaPlusComplete`).

Limite connue, hors présentation : quand la photo d'une pièce montre une personne qui la porte, le détourage garde sa silhouette.
Rien dans la pièce ne dit qu'elle est portée (le cadrage lu à l'ajout n'est jamais stocké) : seule une photo à plat règle ce cas.

## Une seconde veste (09/10/2026)

Un manteau héro avec une veste en plus (6 pièces : manteau, haut, bas, veste, chaussures, sac) posait la veste en accessoire, dans un coin de
16 unités : elle rapetissait (13 unités de large contre 28 pour le haut). Elle prend maintenant le rôle de `couche` quand le haut n'en a pas
déjà une : posée contre l'ancre (le haut), à côté du bas du côté de l'ancre en le recouvrant de 15 % au plus, aussi large que l'ancre (13 → 29
unités à 310 px de zone). Une couche de haut (t-shirt sous un pull) garde son comportement : groupe, 62 % de l'ancre, masquée sur l'accueil.
Une veste en plus, elle, reste posée sur l'accueil.

## Accueil : 3 à 4 pièces lisibles (09/10/2026, brief « Optimisation du flat lay sur la homepage »)

Remplace la composition ciblée du 08/10 (5 pièces serrées, bas devant près de la moitié d'une veste).

**Problèmes mesurés** (zone `hero-home`, 100 × 112 unités, ≈ 181 × 203 px) : le bas dominait (jusqu'à 81 unités de haut) et recouvrait 49 à 59 %
d'une veste, d'un manteau ou des chaussures (seuil de 60 % arbitré le 08/10) ; avec 5 ou 6 pièces, chaque pièce se réduisait (×0,88) ; une photo
brute de l'utilisatrice (rectangle avec son fond, parfois une personne) était posée comme une pièce de plus.

**Règles** (constantes dans `flatLay.ts`, `CONTEXTES["hero-home"]`) :
- `maxPieces: 4`. Au-delà, `pieceRepresentatives` garde les plus représentatives : robe, manteau, bas, haut, veste, puis chaussures, sac, accessoire ;
  un second haut ou une seconde veste pèse 60 % du premier. Les autres restent dans la tenue réelle (`masquees`), jamais retirées.
- Une photo brute (`photoBrute`, déduite du type d'image `resolveItemImage → "photo"`) passe après les visuels produit : écartée de la planche
  tant qu'il reste au moins 3 autres pièces. Sans assez de visuels produit, elle reste (jamais moins de 3 pièces).
- Gabarits (parts de la zone, centre de la pièce) : `HOME_BAS` (haut en haut à gauche, bas au centre droit, sac en bas à gauche, chaussures en
  bas à droite ; jamais en miroir sur l'accueil, `sansMiroir`), `HOME_DESSUS` (le haut et la veste côte à côte, à moins de 12 unités l'un de l'autre,
  le bas dessous, plus bas et plus étroit, chaussures en bas à droite), `HOME_ROBE` (robe à droite, surcouche en haut à gauche, sac dessous, chaussures en bas).
- Chevauchements : les seuils par défaut (18 % de la plus petite, 20 % masquée) s'appliquent de nouveau ; mesurés sur 6 configurations : 12 % au plus.
- Accessoires : 1 au plus, seulement s'il reste de la place sous les 4 pièces ; les collants restent masqués.
- Déterministe : la même graine (le look) donne la même planche.

**Limite** : une image où la personne est dans les pixels (photo portée détourée) ne se reconnaît pas : le moteur ne sait pas ce que montre un fichier.
Il écarte seulement les photos brutes. Le CSS ne peut pas retirer cette personne ; il faudrait un traitement de l'image (ou un indicateur « photo
portée » à l'ajout).

### Planche de debug (outil de développement, pas un écran de l'app)

`scripts/planche-flat-lay.audit.ts` rend les six compositions de référence avec le VRAI composant `FlatLayCapsela` (contexte `hero-home`) et de
vraies images du catalogue (bucket `catalog-images`), dans une carte imitant l'accueil, à 390 px (zone 181 px) et à 360 px (zone 164 px) :

    PLANCHE_IMG_DIR=<copies locales, facultatif> PLANCHE_ZOOM=2 PLANCHE_OUT=/tmp/planche.html \
      npx vitest run --config vitest.audit.config.mts scripts/planche-flat-lay.audit.ts

Les marges transparentes des visuels du catalogue sont déjà lues (`catalogMarges.ts` : la pièce est recadrée sur sa boîte réelle, la taille se
calcule sur elle). Les photos détourées de l'utilisatrice n'ont pas de boîte mesurée (un portrait courant est supposé) : les mesurer demanderait de
lire l'alpha de chaque image au chargement (CORS, recalcul après chargement) ou de porter les bornes dans le nom du fichier comme le visuel hero.
Sur l'accueil, une photo brute cède la place au visuel produit déjà généré de la même pièce s'il existe (jamais une nouvelle image).

## Tous les hero du flat lay sont droits (09/10/2026)

Toutes les pièces sont à 0°, dans TOUS les contextes (`hero-home`, `look-detail`, `capsule`, `dressing`, `packing`), quels que soient le gabarit,
la graine, l'inclinaison préférée d'une pièce (`preferredRotation`) et la veste en plus : `placer` (flatLay.ts) force `angle = 0`. Le composant
n'écrit alors aucun `rotate()` CSS (`transform: translate(-50%, -50%)` seul), ni dans la planche (`FlatLayCapsela`) ni dans la silhouette de
chargement (`ZoneLookDuJour`). Écrans concernés : accueil, Tenue du jour, détail d'un look (idées), « Tes looks » et « Tes dernières pièces » du
Dressing. Vérifié sur la planche de debug (`PLANCHE_CONTEXTE=hero-home` et `look-detail`) : aucun `rotate`.

Les positions, tailles et règles de visibilité ne changent pas ; les recouvrements restent ≤ 18 % (≤ 20 % sur l'accueil), testé. Hors périmètre,
laissés tels quels : la planche d'`OutfitComposition` (cartes de Planifier, Agenda, Associations du dressing — une autre composition, avec ses
propres inclinaisons) et l'étiquette d'annotation inclinée de ce composant.

## Accueil : le haut et la veste +20 % (10/10/2026)

`CONTEXTES["hero-home"].echellesCategorie` : `haut`, `pull`, `veste` et `manteau` ×1,2 sur la largeur des pièces (« augmente le haut de 20 % et la veste de 20 % aussi »).
Le manteau suit la veste (même rôle de pièce du dessus). Les autres contextes n'ont pas de table : ils ne changent pas. Les recouvrements restent ≤ 20 %
(testé) ; la planche s'ajuste à la zone, donc le bas et les chaussures gardent leur gabarit mais peuvent perdre quelques % si la hauteur limite.

## Cartes « Par catégorie » du Dressing (09/10/2026)

Les pièces du dressing étant propres (détourées ou mises à plat), elles illustrent elles-mêmes les cartes de catégorie : `piecesPourVisuelCategorie` (`dressingEcran.ts`) retient jusqu'à 3 pièces récentes dont l'image n'est pas une photo brute, posées en `contain` sur le fond grège avec une ombre douce, au-dessus de la pastille. Aucune pièce propre : la carte garde son visuel éditorial. La pastille passe en colonne (libellé sur 2 lignes max, nombre dessous) pour ne plus tronquer « Robes & combinaisons ».

## Pièces du catalogue avec un hero mais sans visuel standard (11/10/2026)

Mesure du 10/10/2026 : 627 pièces sur 627 ont un visuel hero, mais 7 n'ont aucun visuel standard. `resolveHeroImage` les traitait comme sans image et les sortait des flat lay. Elles sont maintenant représentées par leur hero seul, sauf si leur statut est `invalid` (le hero porterait le même défaut) ou `generating`. Un standard présent mais pas prêt reste un placeholder, comme avant.

Les 7 pièces (requête du 11/10/2026) : 1075 Robe blazer cintrée (`error`), 885, 902, 917 et 922 gilets sans manches (`error`), 1055 Sac business noir (`error`), 1085 Blazer gris en lin (`missing`).

- **DÉMONTRÉ** : les 7 visuels hero ont été regardés un par un le 11/10/2026 — propres, fond uni, conformes au nom de la pièce. C'est pourquoi `error` (échec du visuel STANDARD) n'exclut pas ici.
- **ARBITRAGE ÉDITORIAL**, valable à ce seul périmètre (pièce sans `image_url`). Une autre pièce au statut `error` mais avec un standard n'est pas concernée.
- **NON DÉMONTRÉ** : le rendu de ces 7 pièces dans une planche composée (seul leur visuel isolé a été vu).

## Les six templates de composition (14/10/2026)

Une couche mince POSÉE AU-DESSUS du moteur existant (`flatLay.ts`), qui reste le repli. Aucune pièce, aucune recommandation ni aucun écran n'est changé : un template ne fait que poser les mêmes pièces autrement.

**Responsabilités.**
- `flatLayTemplates.ts` : `choisirTemplate` (sélection déterministe, lue sur les catégories ; blazer reconnu par sous-type/nom), `GABARITS_TEMPLATES` (rôle → emplacement), `REGLAGES_TEMPLATES`, `CORRECTIONS_PIECES` (par id de pièce, vide aujourd'hui). Aucun calcul de taille, de collision ni d'aléa.
- `flatLay.ts` : rôles, échelles visuelles, collisions (`desserrer`), graine — inchangés et réutilisés ; il lit le gabarit du template avant celui du contexte.
- `FlatLayCapsela.tsx` : choisit le template (prop `templates`, vraie par défaut) et le passe au moteur.
- `compositionEditoriale.ts` / `OutfitComposition.tsx` (agenda, valise, avis, planche) : NON concernés.

**Périmètre.** Contextes `look-detail` et `hero-home` seulement ; les autres (capsule, dressing, valise) gardent le moteur actuel. Sans template adapté (`choisirTemplate` rend null) : moteur actuel, à l'identique.

**Sélection** (`HIERARCHIE_TEMPLATES`, configurable, premier vrai l'emporte) : robe, combinaison, blazer-chic (blazer + haut + chaussures + sac, bas intégré s'il y en a un), veste-dominante (blazer/manteau + au moins deux autres vêtements), haut-bas-veste (veste + haut + bas), minimaliste (2 ou 3 pièces sans veste).

**Paramètres modifiables** : la hiérarchie, les emplacements de `GABARITS_TEMPLATES`, `agrandissementMax` de `minimaliste`, les corrections par pièce.

**Validation visuelle** : `scripts/flatlay-templates.audit.ts` (lecture seule) compose des tenues réelles du catalogue (8 styles × 4 saisons × 6 occasions) et rend actuel / template côte à côte dans une page HTML (`FLATLAY_SORTIE`, `FLATLAY_MAX`, `FLATLAY_CONTEXTE`).
- **DÉMONTRÉ** (rendu regardé le 14/10/2026, 16 tenues : robe, blazer-chic, haut-bas-veste) : après un premier réglage, les pièces restent entières et lisibles, le sac ne chevauche aucun vêtement. Le premier jet cachait en partie le bas sous la veste ; les gabarits ont été resserrés en conséquence.
- **NON DÉMONTRÉ** : veste-dominante, minimaliste et combinaison (aucune tenue réelle dans l'échantillon, couverts seulement par tests synthétiques de bornes et de déterminisme) ; le contexte hero-home en rendu réel.

## La tenue prend toute la place de sa zone (14/10/2026)

Demandé : « le flat lay des tenues est encore trop timide », puis « le pantalon doit prendre plus de hauteur ». Constat mesuré : la
composition remplissait déjà sa zone dans une dimension ; le vide venait de pièces écartées les unes des autres (gabarits, chevauchement
toléré de 18 %), de chaussures posées sous le pantalon, et d'une planche au format fixe dans un cadre plus large (Tenue : 32 px perdus à
390 px, 72 px à 430 px).

- **Resserrement** (`resserrement: 0.7`, accueil et Tenue du jour) : les emplacements des gabarits sont rapprochés du centre de 30 %, la
  composition est ensuite agrandie pour remplir la zone. Les emplacements des accessoires sont essayés resserrés et tels quels.
- **Chevauchement toléré : 30 %** de la boîte de la pièce (au lieu de 18 %). Mesure (5 à 6 tenues-types × 4 graines, même exécution) :
  pièces couvrant 61 → 75 % de la zone sur l'accueil, 65 → 75 % sur la Tenue ; le resserrement seul 69 %, la tolérance seule 62 %.
- **Le bas** (pantalon, jean, jupe, short) : × 1,2, jusqu'à 92 % de la hauteur de la zone, et les chaussures à côté de lui quand la tenue
  n'a pas de sac (`refsSansSac`). Hauteur du bas : 64 → 77 % de la zone sur l'accueil, 62 → 69 % sur la Tenue. Avec un sac, les
  chaussures restent dessous (à gauche, elles faisaient monter le chevauchement à 52 %).
- **La zone prend le format de son cadre** (`FlatLayCapsela`, `hauteurZone`) : mesuré avant la peinture, borné entre 100 et 140.
- **Écarté** : le sac et les chaussures × 1,25 — ils prenaient la place de la pièce héro et du bas, et les collants sortaient de la planche.
- **Compromis connu** : une veste héro sur la Tenue du jour, avec un bas dessous, perd un peu de largeur (40 → 37 unités) au profit du bas.

Vérifié en rendu réel avec les visuels du catalogue (mode démo, catalogue servi localement), 360 / 390 / 430 px, mêmes tenues avant et après.
**NON VÉRIFIÉ** : les photos détourées du dressing (aucune accessible ici) ; leurs marges transparentes ne sont pas recadrées, elles
peuvent paraître plus petites que les visuels du catalogue.

## Une pièce qui manque, avec un « + » (14/10/2026)
Demandé sur une capture (tenue Cérémonie) : le conseil « il va faire frais ce soir » restait une carte « À prévoir » sans pièce quand aucune veste du dressing ni de la capsule n'atteint la formalité de l'occasion. Sur Tenue, il passe dans le hero : la silhouette de veste (dessin de chargement), un « + », et la phrase « Il va faire frais ce soir : appuie sur + pour ajouter une veste à ton dressing ». Toucher la silhouette ou son « + » ouvre l'ajout d'une veste (`openAddForCategory("veste")`). La silhouette des chaussures manquantes reçoit le même « + » (ajout de chaussures). Prop `onFantome` de `FlatLayCapsela` ; sans elle, les silhouettes restent décoratives (accueil).

Les « + » (silhouettes et pièces conseillées) sont posés dans un calque au-dessus de la planche : dans leur pièce, ils prenaient sa profondeur et passaient sous les pièces voisines.

Le hero de Tenue prend le même fond que l'accueil le même jour : `--color-card` cerné de `--color-border`.

**NON VÉRIFIÉ** : le cas réel (veste_soir sans pièce) n'a pas été reproduit ici, faute de météo fraîche en mode démo ; le rendu a été contrôlé en forçant la condition, puis le forçage retiré. Le « + » d'une pièce conseillée de l'accueil n'a pas été revu en rendu.

## Tenue incomplète : l'emplacement, la phrase, les paires possibles (14/10/2026)
Brief « Tenue incomplète ». Quand la tenue n'a pas de chaussures, sur Tenue :
- **Statut** : « À compléter · 3/4 pièces ». Le dénominateur vient des manques de structure réels (`piecesStructurellesManquantes`, `statutTenue.ts`), jamais d'une estimation ; sans manque de structure (veste sans dessous, manque de chaleur) : « À compléter » seul.
- **Emplacement dans le flat lay** : la silhouette de chaussures cernée d'un pointillé terracotta discret, avec son « + ». La phrase dessous, « Il te manque une paire de chaussures pour compléter ce look. », est une ligne cliquable avec un chevron. Les deux ouvrent la feuille « Choisir des chaussures » s'il existe des paires possibles, sinon l'ajout de chaussures au dressing.
- **Compléter la tenue** : une rangée de vraies paires, avec la vignette (qui ouvre la fiche), le nom, la provenance (« Ton dressing » / « Suggérée ») et « Choisir ». « Voir plus » ouvre la feuille de toutes les paires. Choisir met la paire dans la TENUE (`addPieceToOutfit`, toast avec « Annuler »), jamais dans le dressing. Sans paire possible : un état vide qui mène à l'ajout au dressing.
- **Les paires** viennent de `candidatsDeRemplacement` avec un id hors tenue : les règles du remplacement d'une pièce (saison, occasion, formalité, R-B6, pluie, chaussures d'été…), le dressing d'abord, puis l'accord avec le reste de la tenue. Aucun score nouveau ; la seule « pertinence » affichée est la provenance.
- **Priorité** : tant que des chaussures manquent, les conseils de style (touche de couleur, layering) ne s'affichent pas ; ils reviennent quand la tenue est complète, avec leur « Ignorer ».
- **Correctif** : les manques signalés par le tirage (`outfitMissingCats`) sont relus sur les pièces affichées (`manquesActuels`). Avant, une tenue complétée à la main restait « À compléter ».

Vérifié en rendu réel (mode démo, 360 et 390 px), le manque étant simulé en retirant les chaussures du tirage, puis la simulation retirée :
- statut « 3/4 », puis « Tenue complétée · 4 pièces » et « Tenue complète · 4 pièces » après le choix ;
- la feuille s'ouvre depuis les pointillés comme depuis la phrase ;
- sans paire possible, l'état vide et la phrase mènent à l'ajout ;
- sur une tenue complète, ni pointillés ni carte.

**NON VÉRIFIÉ** : un vrai tirage sans chaussures, les vraies images. Seules les chaussures ont l'emplacement et la rangée ; un haut ou un bas manquant garde la carte « À compléter » d'avant.
