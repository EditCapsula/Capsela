# Prompts — visuels des styles (étape Style de l'onboarding)

Rédigé le 14/11/2026 pour la découverte des styles (`DecouverteStyles.tsx`). Deux familles de visuels :

1. **Les looks portés** — 3 par style et par genre, affichés sous le flat lay de la carte. Aucun n'existe encore ; la galerie reste
   masquée tant qu'ils ne sont pas déclarés dans `LOOKS_PORTES_STYLE` (`src/lib/profile.ts`).
2. **Les flat lays paysage** (facultatifs) — si l'on veut le grand visuel large de la maquette au lieu du flat lay carré actuel (recadré
   au centre des flat lays portrait 3:4 existants).

## Formats et livraison

| Visuel | Génération | Livré | Emplacement |
|---|---|---|---|
| Look porté | 1024 × 1536 (portrait) | **900 × 1200**, WebP qualité 82 (recadrage 3:4 centré, sans couper tête ni pieds) | `public/images/styles/looks/<femme\|homme>/<slug>-<1\|2\|3>.webp` |
| Flat lay paysage (facultatif) | 1536 × 1024 | **1200 × 900**, WebP qualité 82 | `public/images/styles/paysage/<femme\|homme>/<slug>.webp` |

Slugs : `minimaliste`, `casual-chic`, `classique-chic`, `romantique`, `boheme`, `streetwear`, `preppy`, `glamour`, `creatif`.
Côté homme, pas de `romantique` ni de `glamour` (styles non proposés aux profils homme). Total des looks portés : 27 femme + 21 homme
= 48 images (à confirmer : 7 ou 9 styles côté femme).

## Prompt commun (à placer avant chaque prompt de look)

> Photographie de mode éditoriale, plein pied, une seule personne debout, pose naturelle et détendue, regard hors champ ou légèrement
> vers l'objectif. Fond uni crème chaud (#F3EEE5), sol légèrement plus clair, lumière naturelle douce venant de la gauche, ombres
> légères, aucune autre source de couleur. Cadrage vertical 2:3, la personne occupe 80 % de la hauteur, marge identique au-dessus de
> la tête et sous les pieds, centrée. Rendu photo réaliste, grain fin, tons chauds et doux, sans filtre. Vêtements nets, matières
> lisibles (maille, laine, coton, cuir), associations bien visibles de la tête aux chaussures. Aucun texte, aucun logo, aucune marque
> visible, aucun accessoire de décor. Visage naturel, maquillage discret.

**Cohérence de la série** : même fond, même lumière, même cadrage, même distance pour les 48 images. Varier les personnes d'un look à
l'autre (âges adultes, carnations, silhouettes et coiffures différentes), sans jamais associer une personne à un style : chaque style
montre trois personnes différentes. Aucune pose ni retouche qui mette en avant ou masque une partie du corps.

## Looks portés — FEMME

Chaque style : trois interprétations différentes (quotidien, plus habillé, saison ou matière différente), jamais la même pièce
principale deux fois.

**Minimaliste** — épuré, essentiel, intemporel ; palette crème, blanc, gris, noir, camel.
1. Pantalon large crème en laine, pull fin col rond gris chiné, mocassins noirs, petit sac noir structuré.
2. Robe chemise noire longue ceinturée, bottines noires à talon bas, aucun bijou sauf de fines créoles dorées.
3. Jean droit brut, t-shirt blanc épais, manteau long camel ouvert, baskets blanches en cuir.

**Casual chic** — décontracté mais soigné ; denim, maille, camel, kaki.
1. Jean droit bleu moyen, pull col roulé crème, trench beige ouvert, mocassins marron.
2. Pantalon chino kaki, chemise rayée bleu et blanc rentrée, veste en maille marine, baskets blanches.
3. Jupe midi plissée camel, sweat gris doux, bottines en daim taupe, sac cabas en cuir marron.

**Classique chic** — élégant, toujours approprié ; marine, blanc, beige, noir.
1. Tailleur pantalon marine, chemise blanche, escarpins nude, sac à main structuré noir.
2. Trench beige ceinturé sur pull marinière, pantalon cigarette blanc, ballerines noires.
3. Col roulé noir fin, pantalon beige à pinces, ceinture cuir noir, mocassins noirs.

**Romantique** — douceur, fluidité, détails ; rose poudré, ivoire, fleuri.
1. Robe midi fluide à petites fleurs, gilet court ivoire, ballerines beige.
2. Blouse ivoire à volants, jupe longue satinée rose poudré, sandales à brides fines.
3. Pull en maille douce rose pâle, jupe en dentelle crème, bottines claires.

**Bohème** — naturel, libre, inspiré des voyages ; terracotta, kaki, écru, imprimés.
1. Robe longue imprimée terracotta, ceinture tressée, sandales plates en cuir, chapeau de paille.
2. Blouse brodée écru, jupe longue à volants kaki, bottines en daim marron, sac en crochet.
3. Jean évasé clair, gilet long en maille épaisse crème, débardeur en lin, sandales compensées.

**Streetwear** — urbain, confort, attitude ; noir, gris, denim, blanc.
1. Sweat à capuche gris oversize, pantalon cargo noir, baskets montantes blanches.
2. Bomber noir, t-shirt blanc, jean large délavé, baskets épaisses.
3. Veste en jean oversize, legging noir, sweat court, baskets grises, sac banane porté en bandoulière.

**Preppy** — soigné, frais, esprit collégial ; marine, vert, bordeaux, blanc.
1. Blazer marine, chemise oxford blanche, jupe plissée courte écossaise, mocassins bordeaux.
2. Pull col V vert bouteille sur chemise rayée, chino beige, baskets en toile blanches.
3. Gilet en maille marine à boutons, polo blanc, pantalon droit gris, mocassins marron.

**Glamour** — sophistiqué, audacieux ; noir, rouge, doré, satin.
1. Robe portefeuille satinée rouge profond, escarpins noirs, pochette dorée.
2. Pantalon large noir fluide, top satiné champagne, veste smoking noire sur les épaules, sandales à talons.
3. Robe noire ajustée mi-longue, manteau camel long, bijoux dorés discrets, escarpins nude.

**Créatif** — imprimés, couleurs, lignes inattendues.
1. Pantalon large à imprimé graphique, pull court color block, baskets colorées.
2. Robe chemise asymétrique vert vif, veste courte orange, bottines noires.
3. Jupe midi à motifs, chemise oversize jaune moutarde, mocassins argentés.

## Looks portés — HOMME

**Minimaliste**
1. Pantalon droit gris anthracite, pull fin col rond noir, baskets blanches en cuir.
2. Manteau long camel, col roulé crème, pantalon noir, derbies noires.
3. Chemise blanche, chino beige, mocassins marron, montre fine.

**Casual chic**
1. Surchemise en laine marron, pull crème, chino kaki, baskets blanches.
2. Jean brut, polo en maille marine, veste en daim beige, bottines chelsea marron.
3. Pantalon beige, chemise en lin bleu ciel, cardigan gris, mocassins en daim.

**Classique chic**
1. Costume marine, chemise blanche, cravate unie bordeaux, richelieus noires.
2. Blazer gris chiné, pull col roulé noir, pantalon noir, mocassins noirs.
3. Trench beige, chemise bleu clair, pantalon de flanelle gris, derbies marron.

**Bohème**
1. Chemise en lin écru col ouvert, pantalon large kaki, sandales en cuir, bracelets en cuir.
2. Gilet en maille épaisse terracotta, t-shirt blanc, jean clair, bottines en daim.
3. Chemise imprimée à motifs, pantalon en lin beige, espadrilles, chapeau de paille.

**Streetwear**
1. Sweat à capuche noir, pantalon cargo kaki, baskets montantes.
2. Veste varsity, t-shirt blanc, jean large, baskets blanches épaisses.
3. Doudoune sans manches noire, sweat gris, jogging noir, baskets grises.

**Preppy**
1. Blazer marine, chemise oxford blanche, chino beige, mocassins bordeaux.
2. Pull col V vert bouteille sur chemise rayée, pantalon gris, derbies marron.
3. Polo blanc, gilet en maille marine, short chino beige, chaussures bateau.

**Créatif / Artistique**
1. Chemise à imprimé graphique, pantalon large noir, baskets colorées.
2. Veste de travail bleu vif, pull à rayures, pantalon crème, derbies noires.
3. Cardigan color block, t-shirt blanc, pantalon vert sauge, bottines.

## Flat lays paysage (facultatif)

> Flat lay vu de dessus, vêtements à plat sur un fond uni crème chaud (#F3EEE5), lumière naturelle douce, ombres légères. Format
> horizontal 3:2, composition aérée, toutes les pièces entières et non coupées par le cadre, 15 % de marge sur chaque bord. Aucun texte,
> aucun logo, aucune main ni personne. [Liste des pièces : celles du look 1 du style.]

## Après génération

- Recadrer chaque image au format livré, convertir en WebP qualité 82, contrôler qu'aucune pièce ni partie du corps n'est coupée.
- Déposer dans les dossiers ci-dessus, puis déclarer chaque série dans `LOOKS_PORTES_STYLE` (`src/lib/profile.ts`). La galerie apparaît
  dès qu'un style a au moins une photo.
- Valider chaque série à l'écran avant mise en ligne (règle : aucune donnée inventée, aucun visuel qui ne correspond pas au style).
