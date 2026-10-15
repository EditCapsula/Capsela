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

## Seconde passe (15/10/2026), après contrôle des 209 pièces relevées
Chaque pièce relevée a été repassée dans le nouveau constructeur de prompt. Trois défauts restaient :

- **Le gabarit flat lay nommait un type de pièce** (DÉMONTRÉ, `heroPrompt.ts`) : « The t-shirt lies… » pour tous les hauts, « with its lapels visible » pour toutes les vestes et tous les manteaux, « handles » pour les sacs. D'où les chemises, caracos et tops bandeau en t-shirt, et les blousons, vestes matelassées, kimonos en blazer, au flat lay seulement. La pose ne nomme plus de type.
- **Mots répétés** une fois les détails du nom ajoutés (« ribbed ribbed knit beanie hat », « satin satin slip dress », « denim denim jacket ») et « manchette » des boutons de manchette lu comme un bracelet manchette. Un modificateur ou une matière que le sujet dit déjà est retiré ; « de manchette » est consommé sans rien produire.
- **Ce que l'image montre forcément, sans que rien le dise** : la même pièce sortait à manches longues puis courtes, longue puis courte. Valeurs par défaut, écartées dès qu'un détail écrit les contredit : chemise boutonnée à col et à manches longues, doudoune à la hanche, trench et manteau au genou, manteau long sous le genou. Sujets précisés : foulard léger et carré, legging mat, coupe-vent à capuche, veste en daim en blouson, bague statement. Détails du nom ajoutés : texturé, chaîne (fine), souple, léger, basque, palazzo, petites créoles, col ouvert, wide leg.

Mesure sur les 627 pièces, même exécution : 0 refusée par la validation, 171 changent de clé visuelle (le seul visuel existant n'en change pas : l'audit `cles-perimees` les verra comme périmées tant qu'elles ne sont pas régénérées).

**Trois pièces gardent le même sujet** (NON DÉMONTRÉ qu'une régénération suffise) : 1002 (bracelet en cuir, tressé au flat lay), 503 (pull col V dessiné col rond, alors que le prompt dit « v-neck »), 548 (combinaison : la base ne dit ni bretelles ni manches, rien à écrire sans l'inventer).

## Régénération du 15/10/2026, premier passage
- 104 visuels standard et 69 flat lays régénérés, puis interruption : crédit OpenAI épuisé. Chaque échec a passé la pièce en `image_status = 'error'`, ce qui masque son visuel dans l'app. Les 76 pièces touchées ont été remises en `ready` à la main (SQL), car leur ancienne image était intacte.
- **Défaut de la cascade générique (DÉMONTRÉ)** : sans visuel pour la clé exacte, `generate-catalog-image` réutilise un visuel prêt de même genre, sous-type et couleur, sans lire la clé. Cinq pièces ont ainsi hérité du visuel neuf d'une autre : 770 « pendantes » ← créoles texturées, 639 « avec fente » ← jupe imprimée, 565 « imprimée » ← chemise col mao, 535 « imprimé floral » ← top crochet, 762 « satinée » ← blouse brodée. Relevé par la comparaison, sur toutes les pièces au visuel du jour, de la signature des détails attendue et de celle du prompt reçu (`signatureDesDetails`).
- **Correctif** : la cascade n'accepte plus qu'un visuel dont le prompt stocké porte exactement les mêmes détails visibles.
- Planches à l'œil des 173 visuels neufs : en plus des cinq ci-dessus, défauts restants de la génération elle-même — 580 (standard non tressé), 494 (legging encore brillant), 1002 (flat lay tressé), 1051 (flat lay kaki pour du taupe), 779 et 643 (bretelles d'un côté, manches de l'autre : la base ne dit rien).

## Reste à faire
- **Régénérer les 209 pièces relevées** (décidé le 15/10/2026 : toutes, léger compris) : le visuel désigné faux, ou les deux. Environ 0,02 $ le standard, 0,04 $ le flat lay.
- **Corriger la donnée cassée de la #472** : sa couleur vaut « <la couleur> ».
