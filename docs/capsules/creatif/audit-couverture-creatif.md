# Audit de couverture des occasions — capsules Créatif

Étape 1, 30/10/2026. 8 occasions (`OCCASIONS`, `src/lib/data.ts`) × 4 saisons × 2 genres = 64 cellules, mesurées à six niveaux dans
la même exécution, sur les mêmes données (règle d'audit, points 3 et 4).

## Ce qui est mesuré

Une cellule est **couverte** quand une tenue complète s'y compose avec des pièces étiquetées pour cette occasion et cette saison :
(un haut ET un bas) OU une pièce unique (robe, combinaison, ensemble), PLUS des chaussures. Une veste ou un manteau n'est pas exigé
(le moteur l'ajoute selon la météo) ; sa présence est seulement relevée.

Correspondance des occasions de la référence : Quotidien → `quotidien` · Travail → `travail_formel` · Date → `date` · Soirée →
`soiree` · Sport → `sport` · Cocooning → `cocooning` · Voyage → `voyage` · Cérémonie → `evenement_perso`.

**Signalé, non interprété** : l'occasion « Vacances » de la référence n'existe pas dans la taxonomie de l'app (7 pièces femme : F-CRE-ÉTÉ-05, F-CRE-ÉTÉ-11, F-CRE-ÉTÉ-12, F-CRE-ÉTÉ-15, F-CRE-ÉTÉ-17, F-CRE-ÉTÉ-29, F-CRE-ÉTÉ-30).
Elle n'est comptée nulle part. La rattacher à « Voyage » serait une décision éditoriale, à prendre explicitement.

Niveaux :

| Niveau | Contenu |
|---|---|
| A | la capsule de référence telle qu'écrite (ses propres occasions) |
| B | les seules pièces dont le catalogue porte déjà un équivalent exact |
| C | B + toutes les correspondances potentielles, si elles étaient validées |
| +T | + les pièces TRANSVERSALES du catalogue, absentes de la référence mais tirées par le moteur pour ces occasions : chaussures d'intérieur (#481 femme, #520 homme ; seules admises en Cocooning, R-B13, `logic.ts`) et baskets de sport (#971 femme, #972 homme). Elles ne servent au style Créatif que si « Créatif » est ajouté à leur colonne `styles` |

Les occasions d'un article du catalogue sont celles de sa pièce de référence (c'est elles que l'intégration porterait). Le moteur n'est
pas exécuté : la composition réelle des tenues (formalité, météo, règles R-S, diversité) est **NON DÉMONTRÉE** à ce stade — le style
n'existant pas dans l'app, il n'y a rien à exécuter. Elle se mesure à l'étape 2 (plan d'intégration).

## Résultat

| Niveau | Femme | Homme |
|---|---|---|
| A — Capsule de référence (Excel) | 22 / 32 | 16 / 32 |
| A+T — Référence + pièces transversales | 28 / 32 | 23 / 32 |
| B — Catalogue, EXACT_MATCH seuls | 0 / 32 | 4 / 32 |
| B+T — EXACT + transversales | 0 / 32 | 4 / 32 |
| C — EXACT + POTENTIAL validés | 20 / 32 | 16 / 32 |
| C+T — EXACT + POTENTIAL + transversales | 23 / 32 | 16 / 32 |

**DÉMONTRÉ** (sur ces données, selon ce critère) :

- La capsule de référence n'est pas complète par elle-même : 22 cellules sur 32 côté femme, 16 sur 32 côté homme. Avec les pièces
  transversales (chaussures d'intérieur, baskets de sport), 28 et 23.
- Le catalogue actuel, en équivalents exacts, ne compose presque aucune tenue Créatif : 0 cellule côté femme (aucune chaussure, aucun
  bas autre que le pantalon en velours), 4 côté homme.
- Même si toutes les bases potentielles étaient validées, la couverture plafonne à celle de la référence (20 et 16 ; 23 et 16 avec
  les transversales) : les manques de la référence restent des manques.

## Matrices

### Femme — niveau A+T

| Occasion | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| Quotidien | couverte | couverte | couverte | couverte |
| Travail | couverte | manque : chaussures | couverte | couverte |
| Rendez-vous | couverte | couverte | couverte | couverte |
| Soirée | couverte | couverte | couverte | couverte |
| Sport | couverte | couverte | couverte (avec 971 Baskets de sport) | couverte (avec 971 Baskets de sport) |
| Cocooning | couverte (avec 481 Chaussures d'intérieur) | couverte (avec 481 Chaussures d'intérieur) | couverte (avec 481 Chaussures d'intérieur) | couverte (avec 481 Chaussures d'intérieur) |
| Voyage | couverte | couverte | manque : haut | manque : haut |
| Événement / Cérémonie | couverte | couverte | manque : chaussures | couverte |

### Femme — niveau B+T

| Occasion | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| Quotidien | manque : haut + bas, ou pièce unique, chaussures | manque : bas, chaussures | manque : chaussures | manque : bas, chaussures |
| Travail | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures |
| Rendez-vous | manque : bas, chaussures | manque : bas, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures |
| Soirée | manque : bas, chaussures | manque : bas, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures |
| Sport | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures |
| Cocooning | manque : haut + bas, ou pièce unique, chaussures | manque : bas, chaussures | manque : bas, chaussures | manque : bas, chaussures |
| Voyage | manque : haut + bas, ou pièce unique, chaussures | manque : bas, chaussures | manque : haut, chaussures | manque : haut + bas, ou pièce unique, chaussures |
| Événement / Cérémonie | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures |

### Femme — niveau C+T

| Occasion | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| Quotidien | couverte | couverte | couverte | couverte |
| Travail | couverte | manque : chaussures | couverte | couverte |
| Rendez-vous | couverte | couverte | couverte | couverte |
| Soirée | couverte | couverte | couverte | manque : haut |
| Sport | couverte | manque : bas | couverte (avec 971 Baskets de sport) | couverte (avec 971 Baskets de sport) |
| Cocooning | couverte (avec 481 Chaussures d'intérieur) | manque : bas, chaussures | manque : bas, chaussures | manque : bas, chaussures |
| Voyage | couverte | couverte | manque : haut | manque : haut |
| Événement / Cérémonie | couverte | couverte | manque : chaussures | couverte |

### Homme — niveau A+T

| Occasion | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| Quotidien | couverte | couverte | couverte | couverte |
| Travail | couverte | manque : bas, chaussures | couverte | couverte |
| Rendez-vous | couverte | couverte | couverte | couverte |
| Soirée | manque : bas, chaussures | manque : chaussures | manque : bas | manque : chaussures |
| Sport | couverte (avec 972 Baskets de sport) | couverte (avec 972 Baskets de sport) | couverte (avec 972 Baskets de sport) | couverte (avec 972 Baskets de sport) |
| Cocooning | manque : bas, chaussures | couverte (avec 520 Chaussures d'intérieur) | couverte (avec 520 Chaussures d'intérieur) | couverte (avec 520 Chaussures d'intérieur) |
| Voyage | couverte | couverte | couverte | manque : haut |
| Événement / Cérémonie | manque : bas | couverte | manque : bas, chaussures | couverte |

### Homme — niveau B+T

| Occasion | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| Quotidien | manque : bas, chaussures | manque : haut + bas, ou pièce unique | couverte | manque : haut |
| Travail | manque : haut, chaussures | manque : haut + bas, ou pièce unique, chaussures | couverte | manque : bas |
| Rendez-vous | manque : haut, chaussures | manque : bas, chaussures | couverte | couverte |
| Soirée | manque : haut + bas, ou pièce unique, chaussures | manque : bas, chaussures | manque : haut + bas, ou pièce unique | manque : bas, chaussures |
| Sport | manque : bas, chaussures | manque : bas, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures |
| Cocooning | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures |
| Voyage | manque : bas, chaussures | manque : haut + bas, ou pièce unique | manque : bas | manque : haut + bas, ou pièce unique |
| Événement / Cérémonie | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique, chaussures | manque : haut + bas, ou pièce unique |

### Homme — niveau C+T

| Occasion | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| Quotidien | couverte | couverte | couverte | couverte |
| Travail | couverte | manque : bas, chaussures | couverte | couverte |
| Rendez-vous | couverte | couverte | couverte | couverte |
| Soirée | manque : bas, chaussures | manque : chaussures | manque : bas | manque : chaussures |
| Sport | manque : bas, chaussures | manque : bas, chaussures | manque : bas, chaussures | manque : bas, chaussures |
| Cocooning | manque : bas, chaussures | manque : bas, chaussures | manque : bas, chaussures | manque : bas, chaussures |
| Voyage | couverte | couverte | couverte | manque : haut |
| Événement / Cérémonie | manque : bas | couverte | manque : bas, chaussures | couverte |

## Trous de la capsule de référence (niveau A+T)

À combler dans la référence elle-même, avant ou pendant l'intégration :

| Genre | Saison | Occasion | Manque | Pièces étiquetées |
|---|---|---|---|---|
| Femme | Été | Travail | chaussures | 6 |
| Femme | Automne | Voyage | haut | 6 |
| Femme | Automne | Événement / Cérémonie | chaussures | 5 |
| Femme | Hiver | Voyage | haut | 5 |
| Homme | Printemps | Soirée | bas, chaussures | 4 |
| Homme | Printemps | Cocooning | bas, chaussures | 1 |
| Homme | Printemps | Événement / Cérémonie | bas | 3 |
| Homme | Été | Travail | bas, chaussures | 2 |
| Homme | Été | Soirée | chaussures | 5 |
| Homme | Automne | Soirée | bas | 5 |
| Homme | Automne | Événement / Cérémonie | bas, chaussures | 2 |
| Homme | Hiver | Soirée | chaussures | 5 |
| Homme | Hiver | Voyage | haut | 9 |
