# Prompts des visuels — Mise en valeur et Coupes préférées

31/10/2026. Mise en valeur : reçus le 31/10/2026 en planche 4 × 2, découpés en 3:4 (~300 × 400) dans `public/onboarding/mise-en-valeur/<option>.webp`.

Pour un générateur d'images (ChatGPT). Visuels carrés, comme les vignettes de colorimétrie (`public/onboarding/colorimetrie/`, affichées en 288 × 288) : générer en 1024 × 1024, puis conversion en WebP au moment de l'intégration.

Les deux réponses neutres (« Aucune préférence particulière », « Cela dépend du vêtement ») réutilisent `neutre-lin.webp`, déjà présent : 13 visuels à produire.

## Base commune (à coller en tête de chaque prompt)

> Photographie éditoriale de mode, format carré 1:1, 1024 × 1024. Vêtement seul, posé à plat ou sur un cintre en bois clair, sur un fond de lin ivoire (#F4EFE6) légèrement texturé. Lumière naturelle douce venant de la gauche, ombres légères. Palette sobre : écru, sable, camel, terracotta (#B5573A), encre (#1D1A16). Aucun mannequin, aucun corps, aucune peau, aucune main, aucun visage. Aucun texte, aucun logo, aucune marque. Cadrage centré, marge autour du sujet, style magazine haut de gamme, rendu photo réaliste.

## Mise en valeur (8)

| Fichier | Option | Prompt (après la base) |
|---|---|---|
| `mise-en-valeur-taille.webp` | Ma taille | Gros plan sur la taille d'une robe midi écrue posée à plat, marquée par une fine ceinture en cuir terracotta nouée ; le pli de la taille est le sujet. |
| `mise-en-valeur-jambes.webp` | Mes jambes | Une jupe midi fluide sable, fendue sur le côté, posée à plat en légère diagonale ; la fente est bien visible ; une paire d'escarpins nude à côté. |
| `mise-en-valeur-decollete.webp` | Mon décolleté | Gros plan sur l'encolure en V croisée d'un top cache-cœur en crêpe terracotta, sur un cintre en bois. |
| `mise-en-valeur-epaules.webp` | Mes épaules | Un top à encolure bateau dégageant les épaules, en maille fine écrue, posé à plat ; la ligne d'épaule horizontale est le sujet. |
| `mise-en-valeur-bras.webp` | Mes bras | Un top sans manches à emmanchures américaines en lin camel, sur un cintre en bois, emmanchures bien visibles. |
| `mise-en-valeur-hanches.webp` | Mes hanches | Une jupe crayon en laine encre à taille haute, posée à plat, dont la ligne arrondie des hanches dessine la courbe de la pièce. |
| `mise-en-valeur-dos.webp` | Mon dos | Une robe longue en satin sable vue de dos sur un cintre en bois, au dos largement ouvert en V, fines bretelles croisées. |
| `mise-en-valeur-courbes.webp` | Mes courbes | Une robe portefeuille en jersey terracotta posée à plat, taille marquée par le lien noué, jupe qui s'évase doucement. |

## Coupes préférées (5)

| Fichier | Option | Prompt (après la base) |
|---|---|---|
| `coupe-ajustees.webp` | Ajustées | Flat lay : un top en maille côtelée écrue près du corps et un pantalon cigarette encre, pièces étroites, bords nets. |
| `coupe-droites.webp` | Droites | Flat lay : une chemise droite en popeline blanche et un pantalon droit sable, lignes verticales parallèles, aucun évasement. |
| `coupe-fluides.webp` | Fluides | Une blouse en soie camel et une jupe en viscose terracotta posées avec des plis souples et un drapé naturel, la matière qui coule. |
| `coupe-amples.webp` | Amples | Flat lay : une chemise oversize en lin écru et un pantalon large à pinces sable, volumes généreux, tissu qui s'étale. |
| `coupe-structurees.webp` | Structurées | Un blazer en laine encre aux épaules nettes et revers marqués, sur un cintre en bois, tenant sa forme seul. |

## Contrôle avant intégration

- Aucun corps, aucune peau, aucun mannequin (règle du brief et de CLAUDE.md).
- Même fond, même lumière, même cadrage sur les 13 : à comparer côte à côte.
- Lisible en 288 px : le détail qui nomme l'option (fente, encolure, ceinture…) doit se voir en petit.
