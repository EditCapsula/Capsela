# Audit de rapprochement — capsules Créatif femme et homme

Étape 1 de l'audit Créatif (brief « Audit et intégration des capsules Créatif Femme & Homme »), arrêtée le 30/10/2026. Lecture seule :
aucune donnée de production, aucune capsule d'un autre style, aucune image n'a été modifiée.

## Configuration gelée

| Élément | Valeur |
|---|---|
| Catalogue | export CSV de `vestiaire_universel` fourni le 30/10/2026 : 627 articles (353 femme, 243 homme, 31 unisexe) |
| Référence femme | `Capsela_capsule_femme_style_creatif_4_saisons_v2.xlsx`, feuille « Catalogue Créatif » : 151 pièces |
| Référence homme | `Capsela_capsule_homme_style_creatif_4_saisons_v2.xlsx`, feuille « Catalogue Créatif » : 128 pièces |
| Outils | `outils/rapprocher.py`, `outils/couverture.py`, `outils/livrables.py` (Python, lecture seule), une seule exécution |

Constat préalable, **DÉMONTRÉ** sur l'export : aucun article ne porte « Créatif » dans sa colonne `styles` (valeurs présentes : les huit
styles de l'app). Le style n'existe donc pas encore dans les données.

## Règles de classement

Une pièce de référence est comparée aux articles du même genre (ou unisexe), du même type de vêtement (lu en tête du nom :
« T-shirt », « Pantalon », « Bottines »…).

| Statut | Règle |
|---|---|
| **EXACT_MATCH** | même type, même genre, la saison de la référence est couverte par `saison_capsule`, et TOUS les traits créatifs du nom de référence se retrouvent dans l'article (nom, sous-type ou matière), à une famille fine près ; sans trait, le même vocabulaire de coupe ; manches compatibles quand la référence les précise |
| **POTENTIAL_MATCH** | même type, même genre, même nature (matière ou usage quand la référence en nomme un : cuir, lin, velours, maille, satin, homewear, technique, cargo, palazzo…), saison couverte, mais sans le trait créatif : l'article est une BASE qui pourrait porter le style après décision, ou servir de modèle à une variante |
| **MISSING** | aucun article du type pour ce genre, ou aucun qui porte la nature demandée |
| **INCOMPATIBLE** | un équivalent existe mais contredit une règle métier : sa saison n'est pas celle de la référence, ou il n'existe que pour l'autre genre |

Familles fines de traits : graphique / illustré · artistique / abstrait · imprimé / motif · fleuri · carreaux · rayures · jacquard ·
color-block / empiècements / patchwork · contrasté / décalé · coloré · sculptural / architectural / statement · asymétrique / drapé ·
velours · ajouré · tressé. Une chemise à carreaux ne porte donc pas un « imprimé artistique », un sac structuré n'est pas « sculptural ».

**Relecture humaine** : les 41 correspondances exactes ont été relues une à une. Les corrections de relecture sont liées à l'article
relu (`RELECTURE`, `outils/rapprocher.py`) : H-CR-HIV-30 → #625 passe en POTENTIAL_MATCH (un sac week-end n'est pas le sac structuré
du quotidien). Deux autres sont déclassées par la règle des manches (t-shirt graphique à manches longues contre article à manches
courtes). Les relectures successives ont durci les règles : familles fines de traits (une chemise à carreaux ne porte pas un « imprimé
artistique ») et, après relecture d'un POTENTIAL_MATCH sur quatre, règle de nature (une veste en cuir n'est pas une veste en jean).
**ARBITRAGE ÉDITORIAL** (propriétaire, 30/10/2026) : « sous-pull et pull col roulé fin ne sont pas pareils ». Le sous-pull est un type
à part ; aucun article n'en est un, les quatre sous-pulls de référence sont MISSING.

## Résultat

| Genre | EXACT_MATCH | POTENTIAL_MATCH | MISSING | INCOMPATIBLE | Total |
|---|---|---|---|---|---|
| Femme | 8 | 119 | 15 | 9 | 151 |
| Homme | 33 | 75 | 17 | 3 | 128 |

Par saison :

| Genre | Saison | EXACT | POTENTIAL | MISSING | INCOMPATIBLE |
|---|---|---|---|---|---|
| Femme | Printemps | 1 | 31 | 3 | 2 |
| Femme | Été | 3 | 29 | 3 | 3 |
| Femme | Automne | 2 | 31 | 2 | 3 |
| Femme | Hiver | 2 | 28 | 7 | 1 |
| Homme | Printemps | 7 | 20 | 4 | 1 |
| Homme | Été | 4 | 22 | 5 | 0 |
| Homme | Automne | 11 | 16 | 4 | 1 |
| Homme | Hiver | 11 | 17 | 4 | 1 |

Lecture, **DÉMONTRÉ** : le catalogue a les BASES de la plupart des pièces Créatif (le type existe, dans la bonne saison et la bonne
matière : 194 pièces sur 279 en POTENTIAL_MATCH), mais presque jamais leur version créative. Côté femme, 8 pièces sur 151 trouvent un
équivalent exact, presque toutes des hauts (t-shirts et sweats graphiques, top drapé asymétrique) et un pantalon en velours côtelé ;
aucune chaussure, aucun bas imprimé, aucune robe. Côté homme, 33 sur 128 : la capsule homme compte davantage de pièces de base
(chemise oxford, bottines, derbies, pull col roulé…), que le catalogue a déjà.

Plusieurs références pointent vers le même article (ex. trois t-shirts graphiques femme → #710). Articles DISTINCTS concernés :

| Genre | Saison | Articles distincts EXACT | Articles distincts EXACT + POTENTIAL |
|---|---|---|---|
| Femme | Printemps | 1 | 32 |
| Femme | Été | 2 | 28 |
| Femme | Automne | 2 | 30 |
| Femme | Hiver | 1 | 25 |
| Homme | Printemps | 7 | 24 |
| Homme | Été | 4 | 23 |
| Homme | Automne | 11 | 26 |
| Homme | Hiver | 11 | 25 |

## Détail par pièce

### Femme — EXACT_MATCH (8)

| ID | Saison | Pièce de référence | Article retenu | Raison |
|---|---|---|---|---|
| F-CRE-PRI-03 | Printemps | Top asymétrique | #1063 Top drapé asymétrique (femme, Printemps, Été, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : asymetrique |
| F-CRE-ÉTÉ-02 | Été | T-shirt illustré | #710 T-shirt oversize graphique (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : graphique |
| F-CRE-ÉTÉ-03 | Été | Top drapé asymétrique | #1063 Top drapé asymétrique (femme, Printemps, Été, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : asymetrique |
| F-CRE-ÉTÉ-25 | Été | T-shirt oversize illustré | #710 T-shirt oversize graphique (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : graphique |
| F-CRE-AUT-02 | Automne | T-shirt graphique | #710 T-shirt oversize graphique (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : graphique |
| F-CRE-AUT-10 | Automne | Pantalon en velours côtelé | #817 Pantalon droit velours côtelé (femme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : velours |
| F-CRE-HIV-07 | Hiver | Sweat illustré | #973 Sweat graphique oversize (femme, Hiver) | même type, même genre, saison couverte, mêmes traits : graphique |
| F-CRE-HIV-26 | Hiver | Sweat chaud graphique | #973 Sweat graphique oversize (femme, Hiver) | même type, même genre, saison couverte, mêmes traits : graphique |

### Femme — POTENTIAL_MATCH (119)

| ID | Saison | Pièce de référence | Article retenu | Raison |
|---|---|---|---|---|
| F-CRE-PRI-01 | Printemps | Chemise oversize à imprimé artistique | #452 Chemise oversize (femme, Printemps, Été, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (artistique, imprime) |
| F-CRE-PRI-02 | Printemps | T-shirt graphique d'auteur | #710 T-shirt oversize graphique (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (artistique, graphique) |
| F-CRE-PRI-04 | Printemps | Blouse à manches sculpturales | #822 Blouse fluide manches longues (femme, Automne, Printemps) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-PRI-05 | Printemps | Débardeur color-block | #450 Débardeur côte / fin (unisexe, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-PRI-06 | Printemps | Pull fin à motif graphique | #814 Pull col rond fin (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique, imprime) |
| F-CRE-PRI-08 | Printemps | Jean à empiècements | #467 Jean droit / brut (Straight/Wide) (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-PRI-09 | Printemps | Pantalon large coloré | #636 Pantalon large à pinces d'été (femme, Été, Automne, Printemps) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-PRI-10 | Printemps | Pantalon tailleur à détail décalé | #469 Pantalon à pinces / Tailleur (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-PRI-11 | Printemps | Jupe midi asymétrique | #470 Jupe midi / maxi fluide (femme, Printemps, Été, Automne) | même type, même genre, saison couverte, sans le trait créatif (asymetrique) |
| F-CRE-PRI-12 | Printemps | Jupe imprimée graphique | #542 Jupe midi imprimée (femme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique, imprime) |
| F-CRE-PRI-13 | Printemps | Robe chemise à imprimé arty | #597 Robe chemise ceinturée (femme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (artistique, imprime) |
| F-CRE-PRI-14 | Printemps | Robe color-block | #473 Robe noire (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-PRI-15 | Printemps | Combinaison utilitaire colorée | #548 Combinaison pantalon fluide (femme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-PRI-16 | Printemps | Blazer oversize coloré | #644 Blazer léger oversize non doublé (femme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-PRI-17 | Printemps | Veste courte à découpes | #953 Veste courte effet cuir (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-PRI-18 | Printemps | Surchemise patchwork | #894 Surchemise épaisse (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-PRI-19 | Printemps | Brassière graphique | #491 Brassière de sport / Top respirant (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-PRI-20 | Printemps | Legging imprimé ou contrasté | #494 Legging de sport / Cycliste (Biker short) (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (contraste, imprime) |
| F-CRE-PRI-23 | Printemps | Jogging coordonné à détail arty | #495 Pantalon de jogger / Jogging structuré (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (artistique) |
| F-CRE-PRI-24 | Printemps | Sweat illustré | #493 Sweat à capuche (Hoodie) / Sweat zippé (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-PRI-25 | Printemps | Baskets color-block | #478 Baskets blanches (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-PRI-26 | Printemps | Mocassins à détail sculptural | #664 Mocassins épurés (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-PRI-27 | Printemps | Sandales graphiques | #549 Sandales plates en cuir (femme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-PRI-28 | Printemps | Ballerines à bout ou bride contrastante | #1015 Ballerines à bout rond (femme, Printemps) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-PRI-29 | Printemps | Sac sculptural | #482 Panier / Sac en rafia (femme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-PRI-30 | Printemps | Foulard imprimé artistique | #555 Foulard imprimé (femme, Été, Automne, Printemps) | même type, même genre, saison couverte, sans le trait créatif (artistique, imprime) |
| F-CRE-PRI-31 | Printemps | Bijoux en résine ou formes organiques | #489 Collier fin (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-PRI-32 | Printemps | Ceinture contrastante | #485 Ceinture fine en cuir (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-ÉTÉ-01 | Été | Chemise en lin à rayures décalées | #452 Chemise oversize (femme, Printemps, Été, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (contraste, rayures) |
| F-CRE-ÉTÉ-04 | Été | Débardeur color-block | #450 Débardeur côte / fin (unisexe, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-ÉTÉ-05 | Été | Blouse ajourée graphique | #533 Blouse légère brodée (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (ajoure, graphique) |
| F-CRE-ÉTÉ-06 | Été | Chemise imprimée arty | #452 Chemise oversize (femme, Printemps, Été, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (artistique, imprime) |
| F-CRE-ÉTÉ-07 | Été | Polo en maille colorée | #586 Polo en maille fine manches courtes (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-ÉTÉ-08 | Été | Pantalon ample en lin coloré | #468 Pantalon en lin / fluide (femme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-ÉTÉ-09 | Été | Jean léger à détails | #543 Jean flare léger (femme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-ÉTÉ-10 | Été | Bermuda tailleur graphique | #466 Short tailleur (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-ÉTÉ-11 | Été | Short imprimé coordonné | #465 Short (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-ÉTÉ-12 | Été | Jupe longue à panneaux | #541 Jupe longue fluide (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-ÉTÉ-13 | Été | Jupe midi asymétrique | #470 Jupe midi / maxi fluide (femme, Printemps, Été, Automne) | même type, même genre, saison couverte, sans le trait créatif (asymetrique) |
| F-CRE-ÉTÉ-14 | Été | Robe color-block | #472 Robe d'été fluide (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-ÉTÉ-15 | Été | Robe imprimée artistique | #472 Robe d'été fluide (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (artistique, imprime) |
| F-CRE-ÉTÉ-16 | Été | Robe chemise graphique | #597 Robe chemise ceinturée (femme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-ÉTÉ-18 | Été | Combinaison pantalon imprimée | #548 Combinaison pantalon fluide (femme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-ÉTÉ-19 | Été | Blazer en lin coloré | #458 Blazer bleu marine (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-ÉTÉ-21 | Été | Brassière technique color-block | #491 Brassière de sport / Top respirant (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-ÉTÉ-23 | Été | Débardeur respirant graphique | #450 Débardeur côte / fin (unisexe, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-ÉTÉ-26 | Été | Baskets colorées légères | #478 Baskets blanches (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-ÉTÉ-27 | Été | Sandales à brides sculpturales | #730 Sandales sport à brides (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-ÉTÉ-28 | Été | Mules graphiques | #477 Mules à talons (femme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-ÉTÉ-29 | Été | Sac tressé coloré | #482 Panier / Sac en rafia (femme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (colore, tresse) |
| F-CRE-ÉTÉ-30 | Été | Lunettes à monture statement | #486 Lunettes de soleil (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-ÉTÉ-31 | Été | Bijoux sculpturaux | #489 Collier fin (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-ÉTÉ-32 | Été | Foulard graphique | #487 Foulard (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-AUT-01 | Automne | Chemise à imprimé abstrait | #452 Chemise oversize (femme, Printemps, Été, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (artistique, imprime) |
| F-CRE-AUT-04 | Automne | Blouse à col travaillé | #927 Blouse fluide à col lavallière (femme, Hiver, Printemps, Été, Automne) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-AUT-05 | Automne | Pull jacquard graphique | #454 Pull col V (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique, jacquard) |
| F-CRE-AUT-06 | Automne | Cardigan à boutons contrastants | #931 Cardigan à boutons nacrés (femme, Hiver, Printemps, Automne) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-AUT-07 | Automne | Sweat brodé ou illustré | #493 Sweat à capuche (Hoodie) / Sweat zippé (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-AUT-08 | Automne | Jean barrel ou wide-leg | #824 Jean wide leg (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-AUT-09 | Automne | Pantalon tailleur coloré | #469 Pantalon à pinces / Tailleur (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-AUT-11 | Automne | Pantalon imprimé | #469 Pantalon à pinces / Tailleur (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-AUT-12 | Automne | Jupe midi plissée contrastée | #800 Jupe plissée midi (femme, Automne, Printemps) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-AUT-13 | Automne | Jupe longue imprimée | #541 Jupe longue fluide (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-AUT-14 | Automne | Robe midi graphique | #475 Robe midi (femme, Printemps, Été, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-AUT-15 | Automne | Robe pull à détail asymétrique | #474 Robe pull (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (asymetrique) |
| F-CRE-AUT-16 | Automne | Robe chemise à ceinture contrastée | #801 Robe chemise midi ceinturée (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-AUT-17 | Automne | Blazer oversize à doublure contrastée | #1039 Blazer oversize beige (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-AUT-18 | Automne | Veste patchwork | #456 Veste en jean (femme, Printemps, Été, Automne) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-AUT-19 | Automne | Veste en cuir coloré | #953 Veste courte effet cuir (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-AUT-20 | Automne | Manteau coloré à ligne architecturale | #463 Manteau droit en laine (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (colore, sculptural) |
| F-CRE-AUT-21 | Automne | Brassière technique imprimée | #491 Brassière de sport / Top respirant (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-AUT-22 | Automne | Legging à empiècements | #494 Legging de sport / Cycliste (Biker short) (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-AUT-24 | Automne | Veste de training | #456 Veste en jean (femme, Printemps, Été, Automne) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-AUT-26 | Automne | Sweat oversize illustré | #717 Sweat léger oversize (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-AUT-27 | Automne | Baskets à empiècements | #478 Baskets blanches (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-AUT-28 | Automne | Bottines à talon architectural | #821 Bottines à talon bloc (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-AUT-29 | Automne | Mocassins à semelle contrastée | #797 Mocassins à semelle épaisse (femme, Automne) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-AUT-31 | Automne | Sac géométrique | #578 Sac bandoulière souple (unisexe, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-AUT-32 | Automne | Écharpe à motif artistique | #488 Echarpe (unisexe, Hiver, Automne) | même type, même genre, saison couverte, sans le trait créatif (artistique, imprime) |
| F-CRE-AUT-33 | Automne | Bijoux sculpturaux | #489 Collier fin (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-HIV-02 | Hiver | T-shirt graphique manches longues | #710 T-shirt oversize graphique (femme, Été, Automne, Hiver, Printemps) | même type et mêmes traits, mais manches courtes (référence : Longues) |
| F-CRE-HIV-04 | Hiver | Pull jacquard audacieux | #454 Pull col V (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (jacquard) |
| F-CRE-HIV-05 | Hiver | Pull à volume sculptural | #454 Pull col V (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-HIV-06 | Hiver | Cardigan bijoux | #816 Cardigan ample (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-HIV-08 | Hiver | Jean wide-leg contrasté | #824 Jean wide leg (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-HIV-09 | Hiver | Pantalon tailleur coloré | #469 Pantalon à pinces / Tailleur (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-HIV-10 | Hiver | Pantalon en velours coloré | #817 Pantalon droit velours côtelé (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (colore, velours) |
| F-CRE-HIV-11 | Hiver | Pantalon imprimé | #469 Pantalon à pinces / Tailleur (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-HIV-12 | Hiver | Jupe midi à panneaux | #818 Jupe midi droite (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-HIV-13 | Hiver | Jupe satinée colorée | #935 Jupe midi satinée (femme, Hiver, Printemps, Automne) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-HIV-14 | Hiver | Robe maille asymétrique | #1036 Robe pull midi noire (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (asymetrique) |
| F-CRE-HIV-15 | Hiver | Robe imprimée manches longues | #889 Robe longue manches longues (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-HIV-18 | Hiver | Veste courte colorée | #953 Veste courte effet cuir (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-HIV-19 | Hiver | Manteau statement | #463 Manteau droit en laine (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-HIV-20 | Hiver | Doudoune color-block | #843 Doudoune longue minimaliste (femme, Hiver) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-HIV-21 | Hiver | Brassière technique graphique | #491 Brassière de sport / Top respirant (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-HIV-22 | Hiver | Legging technique contrasté | #494 Legging de sport / Cycliste (Biker short) (femme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (contraste) |
| F-CRE-HIV-24 | Hiver | Veste de training chaude | #892 Veste en daim à franges discrètes (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-HIV-27 | Hiver | Baskets montantes colorées | #729 Sneakers montantes (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| F-CRE-HIV-28 | Hiver | Bottines à talon sculptural | #821 Bottines à talon bloc (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-HIV-29 | Hiver | Mocassins à boucle statement | #664 Mocassins épurés (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-HIV-30 | Hiver | Bottes à détail graphique | #871 Bottes hautes classiques (femme, Hiver) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| F-CRE-HIV-31 | Hiver | Sac sculptural | #578 Sac bandoulière souple (unisexe, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-HIV-32 | Hiver | Écharpe color-block | #488 Echarpe (unisexe, Hiver, Automne) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-HIV-33 | Hiver | Bijoux statement | #489 Collier fin (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| F-CRE-PRI-A01 | Printemps | Blouse à épaules structurées | #533 Blouse légère brodée (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-PRI-A02 | Printemps | Top cache-cœur imprimé | #453 Top sans manches en maille interlock avec basque (femme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-ÉTÉ-A01 | Été | Chemise col V fluide | #631 Chemise fluide (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-ÉTÉ-A03 | Été | Pantalon fluide taille élastiquée | #637 Pantalon fluide taille haute (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-ÉTÉ-A04 | Été | Robe portefeuille imprimée | #545 Robe midi portefeuille (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-AUT-A01 | Automne | Chemise à col V et épaules souples | #452 Chemise oversize (femme, Printemps, Été, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-AUT-A02 | Automne | Blouse à volume d'épaules | #533 Blouse légère brodée (femme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-AUT-A04 | Automne | Robe portefeuille midi à imprimé mixte | #890 Robe midi portefeuille (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-HIV-A01 | Hiver | Pull col V à ligne verticale | #454 Pull col V (femme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-HIV-A02 | Hiver | Cardigan court à épaules dessinées | #816 Cardigan ample (femme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-HIV-A03 | Hiver | Jupe trapèze midi en matière texturée | #868 Jupe midi trapèze (femme, Hiver) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| F-CRE-PRI-A05 | Printemps | Pantalon palazzo à empiècements | #773 Pantalon palazzo taille haute (femme, Été, Printemps, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| F-CRE-ÉTÉ-A05 | Été | Pantalon palazzo en lin imprimé | #540 Pantalon palazzo (femme, Été) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| F-CRE-AUT-A05 | Automne | Pantalon wide-leg à pinces contrastées | #636 Pantalon large à pinces d'été (femme, Été, Automne, Printemps) | même type, même genre, saison couverte, sans le trait créatif (contraste) |

### Femme — MISSING (15)

| ID | Saison | Pièce de référence | Article retenu | Raison |
|---|---|---|---|---|
| F-CRE-PRI-22 | Printemps | Veste de sport légère | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| F-CRE-ÉTÉ-22 | Été | Short de sport imprimé | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| F-CRE-ÉTÉ-24 | Été | Short de détente coordonné | — | le type existe, mais aucun article ne porte la nature demandée (homewear) |
| F-CRE-AUT-03 | Automne | Sous-pull coloré | — | aucune pièce de ce type pour ce genre |
| F-CRE-AUT-25 | Automne | Jogging en maille graphique | — | le type existe, mais aucun article ne porte la nature demandée (maille) |
| F-CRE-HIV-01 | Hiver | Chemise satinée colorée | — | le type existe, mais aucun article ne porte la nature demandée (satin) |
| F-CRE-HIV-03 | Hiver | Sous-pull coloré | — | aucune pièce de ce type pour ce genre |
| F-CRE-HIV-16 | Hiver | Robe de soirée sculpturale | — | le type existe, mais aucun article ne porte la nature demandée (soiree) |
| F-CRE-HIV-17 | Hiver | Blazer en velours | — | le type existe, mais aucun article ne porte la nature demandée (velours) |
| F-CRE-HIV-25 | Hiver | Pantalon de détente en maille | — | le type existe, mais aucun article ne porte la nature demandée (homewear, maille) |
| F-CRE-PRI-A03 | Printemps | Pantalon barrel taille haute | — | le type existe, mais aucun article ne porte la nature demandée (barrel) |
| F-CRE-PRI-A04 | Printemps | Robe colonne à fente | — | le type existe, mais aucun article ne porte la nature demandée (colonne) |
| F-CRE-HIV-A04 | Hiver | Robe colonne en maille avec ceinture amovible | — | le type existe, mais aucun article ne porte la nature demandée (colonne, maille) |
| F-CRE-ÉTÉ-A06 | Été | Tunique longue col V à imprimé arty | — | aucune pièce de ce type pour ce genre |
| F-CRE-HIV-A05 | Hiver | Pantalon palazzo en laine texturée | — | le type existe, mais aucun article ne porte la nature demandée (laine, palazzo) |

### Femme — INCOMPATIBLE (9)

| ID | Saison | Pièce de référence | Article retenu | Raison |
|---|---|---|---|---|
| F-CRE-PRI-07 | Printemps | Polo en maille contrastée | #586 Polo en maille fine manches courtes (femme, Été) | même type et même genre, mais saison non couverte (Été) |
| F-CRE-PRI-21 | Printemps | Haut technique manches courtes | #521 T-shirt technique / Débardeur sport (homme, Toutes saisons) | le type n'existe qu'en homme |
| F-CRE-ÉTÉ-17 | Été | Combishort coloré | #573 Combishort fluide à col chemise (homme, Été) | le type n'existe qu'en homme |
| F-CRE-ÉTÉ-20 | Été | Surchemise légère patchwork | #894 Surchemise épaisse (femme, Automne, Hiver, Printemps) | même type et même genre, mais saison non couverte (Automne, Hiver, Printemps) |
| F-CRE-AUT-23 | Automne | Haut technique manches longues | #521 T-shirt technique / Débardeur sport (homme, Toutes saisons) | le type n'existe qu'en homme |
| F-CRE-AUT-30 | Automne | Derbies bicolores | #654 Derbies souples (homme, Été) | le type n'existe qu'en homme |
| F-CRE-HIV-23 | Hiver | Haut thermique technique | #521 T-shirt technique / Débardeur sport (homme, Toutes saisons) | le type n'existe qu'en homme |
| F-CRE-ÉTÉ-A02 | Été | Jupe trapèze midi à panneaux | #868 Jupe midi trapèze (femme, Hiver) | même type et même genre, mais saison non couverte (Hiver) |
| F-CRE-AUT-A03 | Automne | Jupe trapèze midi graphique | #868 Jupe midi trapèze (femme, Hiver) | même type et même genre, mais saison non couverte (Hiver) |

### Homme — EXACT_MATCH (33)

| ID | Saison | Pièce de référence | Article retenu | Raison |
|---|---|---|---|---|
| H-CR-PRI-01 | Printemps | T-shirt graphique | #957 T-shirt graphique minimal (homme, Automne, Printemps) | même type, même genre, saison couverte, mêmes traits : graphique |
| H-CR-PRI-06 | Printemps | Surchemise légère | #836 Surchemise (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-PRI-11 | Printemps | Pantalon ample à pinces | #905 Pantalon ample à pinces (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-PRI-16 | Printemps | Blazer déstructuré | #675 Blazer déstructuré (homme, Été, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-PRI-18 | Printemps | Veste en denim | #505 Veste en jean (homme, Printemps, Été, Automne) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-PRI-20 | Printemps | T-shirt technique | #521 T-shirt technique / Débardeur sport (homme, Toutes saisons) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-PRI-31 | Printemps | Lunettes de soleil | #486 Lunettes de soleil (unisexe, Toutes saisons) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-ÉTÉ-04 | Été | Chemise imprimée | #565 Chemise imprimée légère (homme, Été, Printemps) | même type, même genre, saison couverte, mêmes traits : imprime |
| H-CR-ÉTÉ-18 | Été | T-shirt technique | #521 T-shirt technique / Débardeur sport (homme, Toutes saisons) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-ÉTÉ-23 | Été | Sandales en cuir | #574 Sandales en cuir à brides (homme, Été, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-ÉTÉ-29 | Été | Ceinture tressée | #580 Ceinture tressée (unisexe, Été, Automne) | même type, même genre, saison couverte, mêmes traits : tresse |
| H-CR-AUT-02 | Automne | Chemise à motif | #901 Chemise imprimée paisley (homme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : imprime |
| H-CR-AUT-03 | Automne | Chemise oxford | #609 Chemise Oxford (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-AUT-10 | Automne | Pantalon à pinces ample | #905 Pantalon ample à pinces (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-AUT-11 | Automne | Pantalon velours côtelé | #807 Pantalon droit (homme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : velours |
| H-CR-AUT-15 | Automne | Surchemise épaisse | #910 Surchemise épaisse (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-AUT-17 | Automne | Veste workwear | #911 Veste workwear souple (homme, Automne, Hiver, Printemps, Été) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-AUT-18 | Automne | Manteau droit | #512 Manteau droit en laine (homme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-AUT-23 | Automne | Sneakers rétro | #750 Sneakers rétro basses (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-AUT-25 | Automne | Bottines | #813 Bottines en cuir / Chelsea (homme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-AUT-26 | Automne | Mocassins | #577 Mocassins souples (homme, Été, Automne, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-AUT-28 | Automne | Sac crossbody | #756 Sac crossbody (unisexe, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-03 | Hiver | Chemise imprimée sombre | #901 Chemise imprimée paisley (homme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : imprime |
| H-CR-HIV-05 | Hiver | Pull col roulé | #504 Pull col roulé (homme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-07 | Hiver | Cardigan épais | #846 Cardigan épais (homme, Hiver) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-12 | Hiver | Pantalon velours | #807 Pantalon droit (homme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : velours |
| H-CR-HIV-14 | Hiver | Blazer en laine | #506 Blazer noir en laine (homme, Toutes saisons) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-23 | Hiver | Sneakers montantes | #752 Sneakers montantes (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-24 | Hiver | Bottines | #813 Bottines en cuir / Chelsea (homme, Automne, Hiver) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-25 | Hiver | Derbies | #709 Derbies classiques (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-27 | Hiver | Écharpe oversize | #926 Écharpe oversize (unisexe, Hiver) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-28 | Hiver | Bonnet | #851 Bonnet côtelé minimaliste (homme, Hiver) | même type, même genre, saison couverte, mêmes traits : même coupe |
| H-CR-HIV-29 | Hiver | Gants | #852 Gants classiques (homme, Hiver) | même type, même genre, saison couverte, mêmes traits : même coupe |

### Homme — POTENTIAL_MATCH (75)

| ID | Saison | Pièce de référence | Article retenu | Raison |
|---|---|---|---|---|
| H-CR-PRI-02 | Printemps | T-shirt color-block | #451 T-shirt coton col rond (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| H-CR-PRI-03 | Printemps | Chemise oversize unie | #527 Chemise oversize (homme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-04 | Printemps | Chemise à motif graphique | #565 Chemise imprimée légère (homme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique, imprime) |
| H-CR-PRI-05 | Printemps | Polo en maille | #835 Polo en maille fine (homme, Automne, Printemps) | même type et mêmes traits, mais manches longues (référence : Courtes) |
| H-CR-PRI-07 | Printemps | Pull fin à motif | #827 Pull col rond fin (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| H-CR-PRI-08 | Printemps | Sweat-shirt illustré | #522 Sweat à capuche (Hoodie) / Sweat zippé (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-PRI-09 | Printemps | Jean droit délavé | #516 Jean droit clair (Straight/Wide) (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-10 | Printemps | Jean large | #516 Jean droit clair (Straight/Wide) (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-12 | Printemps | Pantalon coloré | #517 Pantalon en lin / fluide (homme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| H-CR-PRI-13 | Printemps | Chino revisité | #571 Pantalon chino léger (homme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-17 | Printemps | Veste courte colorée | #505 Veste en jean (homme, Printemps, Été, Automne) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| H-CR-PRI-23 | Printemps | Sneakers design | #750 Sneakers rétro basses (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-24 | Printemps | Mocassins contemporains | #577 Mocassins souples (homme, Été, Automne, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-25 | Printemps | Derbies épaisses | #709 Derbies classiques (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-26 | Printemps | Sandales minimalistes | #574 Sandales en cuir à brides (homme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-27 | Printemps | Sac bandoulière graphique | #578 Sac bandoulière souple (unisexe, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-PRI-28 | Printemps | Ceinture à boucle singulière | #485 Ceinture fine en cuir (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-29 | Printemps | Foulard ou bandana | #487 Foulard (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-PRI-30 | Printemps | Bijou statement | #489 Collier fin (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| H-CR-PRI-32 | Printemps | Chemise habillée texturée | #527 Chemise oversize (homme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-01 | Été | T-shirt artistique | #451 T-shirt coton col rond (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (artistique) |
| H-CR-ÉTÉ-02 | Été | Débardeur côtelé | #450 Débardeur côte / fin (unisexe, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (velours) |
| H-CR-ÉTÉ-03 | Été | Chemise en lin ample | #527 Chemise oversize (homme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-05 | Été | Polo en maille ajourée | #608 Polo en maille fine (homme, Été) | même type, même genre, saison couverte, sans le trait créatif (ajoure) |
| H-CR-ÉTÉ-06 | Été | Surchemise estivale | #566 Surchemise légère texturée (homme, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-07 | Été | Pantalon en lin ample | #517 Pantalon en lin / fluide (homme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-08 | Été | Pantalon imprimé | #517 Pantalon en lin / fluide (homme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| H-CR-ÉTÉ-09 | Été | Jean léger | #516 Jean droit clair (Straight/Wide) (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-10 | Été | Bermuda ample | #569 Bermuda fluide (homme, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-11 | Été | Short imprimé | #514 Short (homme, Été) | même type, même genre, saison couverte, sans le trait créatif (imprime) |
| H-CR-ÉTÉ-14 | Été | Blazer d'été | #506 Blazer noir en laine (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-15 | Été | Veste utilitaire légère | #621 Veste Harrington légère (homme, Été, Automne, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-19 | Été | T-shirt doux | #451 T-shirt coton col rond (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-21 | Été | Sneakers colorées | #750 Sneakers rétro basses (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| H-CR-ÉTÉ-22 | Été | Espadrilles contemporaines | #575 Espadrilles (homme, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-24 | Été | Mocassins légers | #577 Mocassins souples (homme, Été, Automne, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-25 | Été | Sac cabas graphique | #579 Sac cabas en toile (unisexe, Été) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-ÉTÉ-26 | Été | Casquette design | #629 Casquette baseball épurée (unisexe, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-27 | Été | Lunettes géométriques | #486 Lunettes de soleil (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-ÉTÉ-28 | Été | Bijou sculptural | #489 Collier fin (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| H-CR-ÉTÉ-30 | Été | Chemise de cérémonie | #527 Chemise oversize (homme, Printemps, Été) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-ÉTÉ-31 | Été | Pantalon habillé léger | #571 Pantalon chino léger (homme, Été, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-AUT-01 | Automne | T-shirt manches longues graphique | #957 T-shirt graphique minimal (homme, Automne, Printemps) | même type et mêmes traits, mais manches courtes (référence : Longues) |
| H-CR-AUT-04 | Automne | Pull graphique | #503 Pull col V (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-AUT-05 | Automne | Cardigan texturé | #511 Cardigan / Maille ajourée (homme, Printemps, Été, Automne) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-AUT-06 | Automne | Sweat-shirt illustré | #522 Sweat à capuche (Hoodie) / Sweat zippé (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-AUT-09 | Automne | Jean large | #516 Jean droit clair (Straight/Wide) (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-AUT-12 | Automne | Pantalon cargo revisité | #742 Pantalon cargo ample (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-AUT-13 | Automne | Chino coloré | #618 Pantalon chino droit (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (colore) |
| H-CR-AUT-14 | Automne | Blazer texturé | #506 Blazer noir en laine (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-AUT-19 | Automne | Haut technique manches longues | #521 T-shirt technique / Débardeur sport (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-AUT-21 | Automne | Sweat doux | #522 Sweat à capuche (Hoodie) / Sweat zippé (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-AUT-24 | Automne | Derbies épaisses | #709 Derbies classiques (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-AUT-27 | Automne | Écharpe graphique | #488 Echarpe (unisexe, Hiver, Automne) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-AUT-29 | Automne | Ceinture statement | #485 Ceinture fine en cuir (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| H-CR-AUT-30 | Automne | Bijoux graphiques | #489 Collier fin (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-AUT-31 | Automne | Bonnet graphique | #969 Bonnet côtelé (homme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-AUT-32 | Automne | Chemise habillée | #528 Chemise blanche (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-02 | Hiver | Chemise blanche texturée | #528 Chemise blanche (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-04 | Hiver | Pull color-block | #503 Pull col V (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| H-CR-HIV-06 | Hiver | Gros pull texturé | #961 Pull ample texturé (homme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-08 | Hiver | Sweat-shirt artistique | #522 Sweat à capuche (Hoodie) / Sweat zippé (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (artistique) |
| H-CR-HIV-10 | Hiver | Jean large | #516 Jean droit clair (Straight/Wide) (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-11 | Hiver | Pantalon tailleur ample | #518 Pantalon à pinces / Tailleur (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-13 | Hiver | Pantalon cargo hiver | #742 Pantalon cargo ample (homme, Été, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-16 | Hiver | Veste matelassée | #877 Veste croisée (homme, Hiver) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-17 | Hiver | Manteau long architectural | #832 Manteau droit mi-long (homme, Automne, Hiver) | même type, même genre, saison couverte, sans le trait créatif (sculptural) |
| H-CR-HIV-18 | Hiver | Doudoune color-block | #849 Doudoune minimaliste (homme, Hiver) | même type, même genre, saison couverte, sans le trait créatif (color_block) |
| H-CR-HIV-19 | Hiver | Haut thermique | #521 T-shirt technique / Débardeur sport (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-21 | Hiver | Hoodie confortable | #522 Sweat à capuche (Hoodie) / Sweat zippé (homme, Automne, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-26 | Hiver | Mocassins habillés | #678 Mocassins épurés (homme, Été, Hiver, Printemps) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-30 | Hiver | Sac structuré | #625 Sac week-end structuré (homme, Été, Automne, Hiver, Printemps) | relecture : un sac week-end (voyage) n'est pas le sac structuré du quotidien de la référence |
| H-CR-HIV-31 | Hiver | Bijoux graphiques | #489 Collier fin (unisexe, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (graphique) |
| H-CR-HIV-32 | Hiver | Chemise de cérémonie | #528 Chemise blanche (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |
| H-CR-HIV-33 | Hiver | Pantalon habillé | #518 Pantalon à pinces / Tailleur (homme, Toutes saisons) | même type, même genre, saison couverte, sans le trait créatif (aucun trait lu) |

### Homme — MISSING (17)

| ID | Saison | Pièce de référence | Article retenu | Raison |
|---|---|---|---|---|
| H-CR-PRI-15 | Printemps | Ensemble coordonné léger | — | aucune pièce de ce type pour ce genre |
| H-CR-PRI-19 | Printemps | Veste légère technique | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| H-CR-PRI-21 | Printemps | Short de sport | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| H-CR-PRI-22 | Printemps | Pantalon jogger technique | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| H-CR-ÉTÉ-12 | Été | Ensemble en lin | — | aucune pièce de ce type pour ce genre |
| H-CR-ÉTÉ-13 | Été | Ensemble de soirée décontracté | — | aucune pièce de ce type pour ce genre |
| H-CR-ÉTÉ-16 | Été | Débardeur technique | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| H-CR-ÉTÉ-17 | Été | Short de sport | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| H-CR-ÉTÉ-20 | Été | Short détente | — | le type existe, mais aucun article ne porte la nature demandée (homewear) |
| H-CR-AUT-07 | Automne | Sous-pull fin | — | aucune pièce de ce type pour ce genre |
| H-CR-AUT-16 | Automne | Veste en cuir | — | le type existe, mais aucun article ne porte la nature demandée (cuir) |
| H-CR-AUT-20 | Automne | Jogger technique | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| H-CR-AUT-22 | Automne | Pantalon homewear | — | le type existe, mais aucun article ne porte la nature demandée (homewear) |
| H-CR-HIV-01 | Hiver | Sous-pull graphique | — | aucune pièce de ce type pour ce genre |
| H-CR-HIV-15 | Hiver | Veste en cuir | — | le type existe, mais aucun article ne porte la nature demandée (cuir) |
| H-CR-HIV-20 | Hiver | Pantalon de sport chaud | — | le type existe, mais aucun article ne porte la nature demandée (technique) |
| H-CR-HIV-22 | Hiver | Pantalon homewear chaud | — | le type existe, mais aucun article ne porte la nature demandée (homewear) |

### Homme — INCOMPATIBLE (3)

| ID | Saison | Pièce de référence | Article retenu | Raison |
|---|---|---|---|---|
| H-CR-PRI-14 | Printemps | Short structuré | #514 Short (homme, Été) | même type et même genre, mais saison non couverte (Été) |
| H-CR-AUT-08 | Automne | Jean brut | #998 Jean droit brut (homme, Printemps) | même type et même genre, mais saison non couverte (Printemps) |
| H-CR-HIV-09 | Hiver | Jean brut | #998 Jean droit brut (homme, Printemps) | même type et même genre, mais saison non couverte (Printemps) |
