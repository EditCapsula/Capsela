# Audit des visuels du catalogue (14–15/10/2026)

Demandé : « s'assurer que les visuels catalogue et flat lay soient raccords (même couleur, mêmes détails) ». Audit en lecture seule, sans écriture en base ni génération.

## Méthode
- **620 paires** (visuel standard `url_image` et visuel flat lay `url_image_hero`) sur 627 pièces.
- **Mesure automatique** : couleur moyenne (Lab) des pixels opaques de chaque image, ΔE entre les deux, sur la même exécution. 150 paires au-dessus de ΔE 10, 24 au-dessus de 20.
- **Revue à l'œil des 620 paires**, sur 21 planches triées par ΔE décroissant : couleur, forme, motif, détails.

## Résultat
| Gravité | Visuel faux | Pièces |
|---|---|---|
| écart | catalogue seul | 46 |
| écart | flat lay seul | 11 |
| écart | les deux (même erreur) | 68 |
| léger (longueur, col, détail) | — | 84 |

La liste complète (id, constat, visuel à refaire) a été remise à la propriétaire le 14/10/2026.

## Les deux causes (DÉMONTRÉ sur les prompts stockés)
1. **Visuels standard anciens, faux de couleur ou de forme** (jupe rose poudré rendue noire, panier en rafia rendu en sac en cuir…). Le flat lay est juste : une régénération du standard suffit.
2. **Sous-type inconnu du vocabulaire, ou détail écrit seulement dans le nom.**
   - Sous-type inconnu : `image_prompt` stocké de « Bonnet » : « women's écru wool **accessory** » ; « Gants » : « men's cognac leather **accessory** » ; « Hoodie » : « loose-fitting **sweater** ».
   - Détail seulement dans le nom : « Chemise rayée » a pour sous-type « Chemise ». La génération ne lisait jamais le nom.
   - Régénérer sans corriger reproduisait l'erreur.

## Correctif (15/10/2026)
- **Vocabulaire** (`_shared/imagePrompt.ts` et son miroir `src/lib/imagePrompt.ts`) : bonnet, béret, bob, gants, boutons de manchette, babies, sabots, slingbacks, chaussures bateau, bottines Chelsea, desert boots, boots (lacées, chunky, workwear, doublées), bottes hautes, caraco, crop top, top bandeau, chemise bowling, blouse lavallière, hoodie, Harrington, varsity, veste matelassée, kimono, manteau cape / shearling / croisé, caban croisé, parachute, sac banane / baguette / besace, robe nuisette / fourreau / pull, mini-jupe, velours côtelé, col mao, col lavallière, une épaule, cache-cœur. Mots-clés de contrôle ajoutés (« gloves », « cufflinks »), sans lesquels la génération aurait refusé ces pièces.
- **Détails du nom** (`detailsDuNom.ts`, deux copies identiques vérifiées par un test) :
  - ce qui est lu : motifs (rayé, carreaux, imprimé, paisley, fleuri, graphique), aspect (dentelle, brodé, franges, torsadé, côtelé, matelassé, ajouré, crochet, tressé, satiné, velours), longueur, encolures et manches, forme d'un bijou (jonc, manchette, perles, créoles, puces, pendantes) ;
  - ils sont ajoutés comme modificateurs, jamais comme sujet : la règle du 18/08/2026 tient pour le type de pièce.
- **Clé visuelle** : les détails du nom absents du sous-type y entrent. Une chemise rayée ne réutilise plus le visuel d'une chemise unie.
- **Mesuré sur les 627 pièces** : 0 pièce refusée par la validation ; 135 pièces changent de clé (celles dont le nom porte un détail).
- **Ce qui change, et quand** : le visuel flat lay (`heroPrompt.ts`) reprend le sujet de `buildImagePrompt`, il profite donc du même correctif. Aucun visuel existant ne change avant une régénération.

## Reste à faire
- **Régénérer les visuels faux** (environ 0,02 $ l'image), d'abord une poignée de pièces validées à l'œil, puis le reste.
- **Corriger la donnée cassée de la #472** : sa couleur vaut « <la couleur> ».
