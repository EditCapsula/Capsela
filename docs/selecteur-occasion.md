# Sélecteur d'occasion de Tenue (14/10/2026)

Brief « Sélecteur Occasions », options 2e (sous-occasion dans une feuille) et 2d (mobile étroit). Composant : `src/components/SelecteurOccasion.tsx`. Il remplace les deux pilules du 22/09 (occasion terracotta pleine qui ouvrait une feuille des huit occasions, sous-choix sable).

## Ce qui s'affiche
- L'eyebrow « Qu'est-ce qui est prévu {jour} ? », inchangé.
- **Une ligne d'onglets texte** (`role="tablist"`) : les huit libellés de `OCCASIONS`, tels quels. Actif : 600, encre, soulignement terracotta de 2 px ; inactif : 500, `--color-muted`. Elle déborde jusqu'aux bords de l'écran, défile horizontalement sans barre (`scrollarea`), avec un fondu crème de 36 px à droite et sans flèche. L'onglet actif est ramené dans la zone visible, hors du fondu, au montage et à chaque sélection (`scrollLeft`, jamais `scrollIntoView`). Flèches gauche/droite au clavier.
- **La phrase éditoriale** (`phraseOccasion.ts`, testée) et, pour les seules occasions qui en ont, **le déclencheur de sous-occasion** (pilule blanc cassé, glyphe, première partie du libellé, chevron). La ligne fait 58 px minimum, avec ou sans déclencheur : la carte tenue démarre au même endroit pour toutes les occasions.
- **La feuille** : le `BottomSheet` partagé, options en `role="radio"`, filet bas `--color-border`, 14 px, l'option active en terracotta et en gras avec une coche.

Les actions du store (`setOccasion`, `setWorkMode`, `setDateContext`, `setTravelMode`) recalculent la tenue comme avant : aucune logique ni requête nouvelle.

## Sous-occasions et titres de feuille
| Occasion | Sous-occasions | Titre de la feuille |
|---|---|---|
| Travail / Bureau | Présentiel, Télétravail, Entretien | « Quel type de journée ? » |
| Rendez-vous amoureux | Restaurant / date romantique, Verre, Cinéma / balade, Activité, Soirée festive | « Quel type de date ? » |
| Voyage / Déplacement | Court trajet, Longue distance | « Quel type de trajet ? » |

« Où travailles-tu aujourd'hui ? », proposé par le brief, ne couvre pas « Entretien » (fusionné dans Travail le 08/10) : le titre d'avant reste.

## Les phrases — ARBITRAGE ÉDITORIAL du 14/10/2026
Le produit n'en avait pas. Ce sont des données de présentation sur les valeurs existantes, à revoir par la propriétaire (`phraseOccasion.ts`). La partie en italique terracotta est entre astérisques.

- Quotidien : Une journée *décontractée*
- Travail : Une journée *au bureau* / *en télétravail* / *avec un entretien*
- Rendez-vous : Un dîner *en tête-à-tête* (Restaurant) · Un rendez-vous *autour d'un verre* · Un rendez-vous *ciné ou balade* · Un rendez-vous *autour d'une activité* · Une soirée *festive à deux*
- Soirée : Une sortie *en soirée*
- Sport : Une séance *de sport*
- Cocooning : Une journée *à la maison*
- Voyage : Un trajet *court* / *longue distance*
- Événement : Un événement *à célébrer*

## La feuille partagée (`BottomSheet.tsx`), pour toute l'app
Décidé le 14/10/2026 par la propriétaire, après une comparaison en image : voile .32 (au lieu de .45), fond `--color-card` (au lieu du crème), poignée `--color-sand-border`, rayon haut 24 px, titre Fraunces 500 20 px, croix seule dans une cible de 44 px. Échap ferme toutes les feuilles ; le focus revient à l'élément qui les a ouvertes. Les lignes des autres feuilles (leur contenu) ne changent pas : leurs tuiles ont toutes un filet `--color-border`, qui les détache du nouveau fond.

## Mesures (14/10/2026, rendu réel, mode démo)
- Haut de la carte tenue : **283 px**, identique pour les 7 états mesurés (défaut Travail, Soirée, Rendez-vous, Rendez-vous Restaurant, Événement, Voyage, Quotidien) à 360, 390 et 412 px. À 52 px de ligne (brief), une phrase sur deux lignes la décalait de 5 px.
- Onglet actif entièrement visible, hors du fondu, dans les 21 cas ; aucun débordement horizontal de la page.
- Avant/après à 390 px : la carte tenue garde sa hauteur (564 px, flat lay inchangé) mais démarre **53 px plus bas** (230 → 283 px). Elle est poussée par la ligne de la phrase, que l'ancien sélecteur n'avait pas.
- Échap ferme la feuille et rend le focus au déclencheur.

**NON VÉRIFIÉ** : défilement au doigt et `overscroll-behavior-x` sur un vrai Android ; lecteur d'écran.

**Écart connu** : la carte conseil du voyage « Longue distance » s'affiche toujours entre le sélecteur et la carte tenue, comme avant, et la décale.
