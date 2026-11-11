Tu es styliste. Tu classes des pièces d'un catalogue de mode (application Capsela, garde-robe capsule) selon leur NIVEAU DE FORMALITÉ. Chaque pièce reçoit exactement un niveau parmi les cinq ci-dessous, avec la valeur technique exacte.

## Les cinq niveaux

| Valeur | Niveau | Définition | Exemples |
|---|---|---|---|
| `sport` | 0 | Pièce technique, faite pour une activité physique. | legging de sport, brassière, baskets de running |
| `decontracte` | 1 | Le quotidien sans effort : confort, pièces de week-end. | t-shirt basique, sweat, jean délavé, baskets de ville, bonnet |
| `casual_chic` | 2 | Le décontracté relevé (smart casual) : une matière ou une coupe plus soignée, portable au bureau détendu comme le week-end. | maille fine, chemise col ouvert, jean brut, ballerines, bottines Chelsea en cuir |
| `business_casual` | 3 | La tenue de bureau : structurée, nette. | chemise repassée, blazer, pantalon à pinces, mocassins, escarpins à petit talon |
| `habille` | 4 | Soirée, cérémonie : matières nobles, pièces d'apparat. | robe de cocktail, soie, satin, paillettes, escarpins hauts |

## Ce que le niveau change dans l'application

- Chaque occasion demande un niveau minimum :
  - 1 pour Quotidien, Voyage et Cocooning ;
  - 3 pour Travail présentiel, Soirée et Rendez-vous « soirée festive » ;
  - 4 pour Événement, Soirée habillée et Rendez-vous « restaurant ».
- Le minimum ne filtre que les VÊTEMENTS (hauts, pulls, robes, bas). Un vêtement sous le minimum est exclu de l'occasion.
- Les chaussures, sacs, accessoires et bijoux ne sont pas exclus par ce minimum. Mais une tenue évite d'associer des pièces trop éloignées : plus de 2 niveaux d'écart avec la moyenne des pièces déjà choisies.
- Ne surclasse pas. Un vêtement classé trop haut sera proposé au bureau ou en soirée alors qu'il n'y a pas sa place. Un vêtement classé trop bas disparaît des occasions habillées.
- Une pièce polyvalente se classe à son niveau le plus BAS courant, pas à son niveau le plus habillé possible. Exemple : un pull col V en mérinos se porte au bureau, mais aussi le week-end.

## Règles

1. Juge sur ce que la ligne dit : nom, sous-type, matière, couleur, styles. N'invente aucun détail absent.
2. Utilise uniquement les cinq valeurs techniques (`sport`, `decontracte`, `casual_chic`, `business_casual`, `habille`).
3. Si une pièce est vraiment ambiguë, donne ton choix ET signale-la « à relire ».
4. Les pièces en double (même nom, genre différent) reçoivent le même niveau, sauf raison écrite.
5. Les accessoires d'hiver (bonnet, écharpe, gants), les lunettes et les collants : demande-toi avec quelles tenues ils se portent réellement.

## Format de réponse attendu

Un tableau, une ligne par pièce, dans l'ordre reçu :

`id | nom | niveau proposé | justification en une phrase | à relire (oui/non)`

Puis, à la fin :
- le décompte par niveau ;
- la liste des pièces « à relire ».

N'écris pas de SQL.

## Les 52 pièces

Colonnes : id | nom | catégorie | sous-type | genre | styles | matière | couleur | saisons

```
451 | T-shirt coton col rond | hauts | T-shirt col rond | unisexe | Minimaliste, Casual chic | — | Blanc | Toutes saisons
454 | Pull col V | pulls_gilets | Pull col V | femme | Classique chic, Preppy, Minimaliste | Laine mérinos | Marine | Automne, Hiver, Printemps
455 | Pull col roulé | pulls_gilets | Pull col roulé | femme | Classique chic, Bohème | Grosse maille | Bordeaux | Automne, Hiver
474 | Robe pull | robes | Robe maille | femme | Bohème, Casual chic | Laine | Écru | Automne, Hiver
476 | Sandales plates / Tropéziennes | chaussures | Sandales plates | femme | Bohème, Casual chic, Minimaliste | Cuir | Noir | Été
479 | Ballerines | chaussures | Ballerines | femme | Casual chic, Classique chic, Preppy, Minimaliste, Romantique | — | Noir | Printemps, Automne, Été
480 | Bottines en cuir / Chelsea | chaussures | Bottines | femme | Classique chic, Preppy | Cuir | Cognac | Automne, Hiver
482 | Panier / Sac en rafia | sacs | Panier | femme | Bohème, Casual chic | Rafia | Sable | Printemps, Été
483 | Cabas en cuir clair / foncé | sacs | Cabas | femme | Minimaliste, Casual chic, Classique chic | Cuir | Camel | Toutes saisons
485 | Ceinture fine en cuir | accessoires | Ceinture | unisexe | Minimaliste, Classique chic, Preppy, Casual chic | Cuir | Camel | Toutes saisons
486 | Lunettes de soleil | accessoires | Lunettes | unisexe | Minimaliste, Glamour, Bohème, Preppy, Casual chic, Classique chic, Streetwear | Acétate | Écaille | Toutes saisons
487 | Foulard | accessoires | Foulard | unisexe | Romantique, Classique chic, Bohème | Soie | Terracotta | Toutes saisons
488 | Echarpe | accessoires | Écharpe | unisexe | Minimaliste, Classique chic, Preppy, Casual chic, Streetwear | Laine | Bordeaux | Hiver, Automne
489 | Collier fin | bijoux | Collier | unisexe | Minimaliste, Romantique, Casual chic | Métal doré | Doré | Toutes saisons
490 | Bagues | bijoux | Bagues | unisexe | Bohème, Glamour | — | Doré | Toutes saisons
496 | Collants fins transparents 15–20 DEN | accessoires | Collants | femme | Classique chic, Glamour | Polyamide / élasthanne | Noir | Printemps, Automne
497 | Collants semi-opaques 30–40 DEN | accessoires | Collants | femme | Minimaliste, Classique chic, Glamour | Polyamide / élasthanne | Noir | Automne, Hiver, Printemps
498 | Collants opaques 60–80 DEN | accessoires | Collants | femme | Minimaliste, Classique chic | Polyamide / élasthanne | Noir | Automne, Hiver
503 | Pull col V | pulls_gilets | Pull col V | homme | Classique chic, Preppy, Minimaliste | Laine mérinos | Marine | Automne, Hiver, Printemps
504 | Pull col roulé | pulls_gilets | Pull col roulé | homme | Classique chic, Bohème, Romantique, Minimaliste, Casual chic, Créatif | Grosse maille | Chocolat | Automne, Hiver
526 | Chemise blanche | hauts | Chemise | femme | Classique chic, Preppy, Minimaliste | Lin | Blanc | Toutes saisons
528 | Chemise blanche | hauts | Chemise | homme | Classique chic, Preppy, Minimaliste | Lin | Blanc | Toutes saisons
684 | Bagues | bijoux | Bagues | unisexe | Minimaliste, Classique chic, Streetwear | Métal | Argenté | Toutes saisons
704 | Foulard carré | accessoires | Foulard | femme | Classique chic, Preppy | Soie | Marine | Toutes saisons
813 | Bottines en cuir / Chelsea | chaussures | Bottines | homme | Classique chic, Preppy, Casual chic, Créatif | Cuir | Marron foncé | Automne, Hiver
820 | Bottines Chelsea | chaussures | Bottines Chelsea | femme | Casual chic, Preppy, Minimaliste | Cuir | Noir | Automne, Hiver, Printemps
823 | Pull col V | pulls_gilets | Pull col V | femme | Casual chic, Preppy | Laine mérinos | Gris chiné | Automne, Hiver
833 | Écharpe fine | accessoires | Écharpe | homme | Casual chic | Laine | Gris | Automne
844 | Bonnet côtelé minimaliste | accessoires | Bonnet | femme | Casual chic, Bohème, Preppy | Laine | Écru | Hiver
851 | Bonnet côtelé minimaliste | accessoires | Bonnet | homme | Casual chic, Créatif | Laine | Marine | Hiver
852 | Gants classiques | accessoires | Gants | homme | Casual chic, Classique chic, Bohème, Créatif | Cuir | Cognac | Hiver
853 | Écharpe épaisse | accessoires | Écharpe épaisse | homme | Casual chic, Minimaliste | Laine | Gris | Hiver
858 | Foulard léger | accessoires | Foulard | femme | Casual chic | Soie | Bleu ciel | Printemps
862 | Foulard léger | accessoires | Foulard | homme | Casual chic | Coton / soie | Marine | Printemps
863 | Pull fin col V | pulls_gilets | Pull col V | homme | Casual chic | Mérinos / coton | Gris clair | Printemps
872 | Gants classiques | accessoires | Gants | femme | Classique chic, Minimaliste | Cuir | Noir | Hiver
882 | Cabas en cuir clair / foncé | sacs | Cabas | homme | Minimaliste, Casual chic, Classique chic | Cuir | Camel | Toutes saisons
896 | Bottines Chelsea | chaussures | Bottines Chelsea | femme | Bohème | Daim | Chocolat | Automne, Hiver
913 | Bottines Chelsea | chaussures | Bottines Chelsea | homme | Bohème | Daim | Chocolat | Automne, Hiver
925 | Bonnet côtelé | accessoires | Bonnet | homme | Bohème | Laine | Écru | Hiver
926 | Écharpe oversize | accessoires | Écharpe oversize | unisexe | Bohème | Laine | Terracotta | Hiver
943 | Écharpe douce | accessoires | Écharpe | femme | Romantique | Laine/cachemire | Rose poudré | Hiver
955 | Bonnet côtelé | accessoires | Bonnet | femme | Streetwear | Maille | Gris | Automne, Hiver
969 | Bonnet côtelé | accessoires | Bonnet | homme | Streetwear | Maille | Gris anthracite | Automne, Hiver
987 | Lunettes de soleil rectangulaires | accessoires | Lunettes rectangulaires | unisexe | Streetwear | Acétate | Noir | Printemps
1019 | Lunettes de soleil classiques | accessoires | Lunettes de soleil | homme | Preppy, Minimaliste | Acétate | Écaille | Printemps
1033 | Jean droit noir | jeans | Jean droit | femme | Minimaliste, Casual chic | Denim | Noir | Toutes saisons
1036 | Robe pull midi noire | robes | Robe maille | femme | Minimaliste, Casual chic | Maille | Noir | Automne, Hiver
1043 | Écharpe oversize gris clair | accessoires | Écharpe oversize | femme | Minimaliste | Laine | Gris clair | Hiver
1044 | Pull col roulé fin noir | pulls_gilets | Pull col roulé | homme | Minimaliste, Classique chic | Mérinos | Noir | Automne, Hiver, Printemps
1054 | Bottines Chelsea noir | chaussures | Bottines Chelsea | homme | Minimaliste, Classique chic, Casual chic | Cuir | Noir | Automne, Hiver, Printemps
1057 | Bonnet côtelé noir | accessoires | Bonnet | homme | Minimaliste, Casual chic | Laine | Noir | Hiver
```
