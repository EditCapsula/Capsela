# Importer une tenue — une photo, plusieurs pièces

Demandé le 10/10/2026 (option B) ; maquette « Capsela — Importer une tenue » (14 états), prompt dans `prompt-design-import-tenue.md`.

## Parcours

```text
photo (stockage privé) → lecture des objets (OpenAI vision : catégorie, couleur, matière, manches, motif, boîte) → recadrage de chaque
boîte sur la PHOTO D'ORIGINE → détourage de chaque recadrage (Photoroom Segment) → un fichier par objet
```

CADRAGE (11/10/2026) : après le détourage, l'image est rognée sur ce que le service a gardé (`rectangleOpaque`, alpha > 16, marge 3 %) : la pièce remplit sa tuile. Un détourage vide n'est pas proposé.

PAS DE MISE À PLAT AUTOMATIQUE (11/10/2026, demandé : « la mise à plat n'est pas automatique, c'est le détourage qui l'est »). Avant, toute la photo passait par la mise à plat générative (plan Plus) ; elle reste une action demandée sur la fiche d'une pièce. Conséquence : `tenue_url` est toujours `null` (plus de planche, plus de bascule « Voir l'image à plat »), les fichiers s'appellent `….oN.detouree.webp` (détourés, pas « à plat »). Limite : sur une photo portée, le recadrage d'une boîte peut garder un bout de bras ou de jambe, le détourage isole le sujet principal ; NON ESSAYÉ sur de vraies photos (la règle d'origine « jamais de découpe d'une photo portée » est levée à la demande de la propriétaire).

L'app montre les objets, la personne coche et modifie, et seulement alors des pièces sont créées. Les fichiers non gardés sont supprimés par l'app.

## Backend (livré le 10/10/2026)

| Quoi | Où |
| --- | --- |
| Fonction serveur | `supabase/functions/importer-tenue/index.ts` |
| Partie pure : prompt, vérification de la réponse, recadrage, noms de fichiers | `supabase/functions/_shared/analyseTenue.ts` (testée : `src/lib/__tests__/analyseTenue.test.ts`) |
| Listes de valeurs (catégories, sous-types, matières, types, palette) | `supabase/functions/_shared/enumsPiece.ts` — extraites d'`analyze-dressing-photo`, qui les importe maintenant ; le test miroir de la palette lit ce fichier |
| Décodage PNG et encodage WebP des recadrages | `supabase/functions/_shared/webp.ts` (`decoderPng`, `imageDataVersWebp`) |

**Entrée** `{ photo_url }` (URL signée de la photo de la personne). **Sortie** `{ ok: true, tenue_url, objets: [{ nom, cat, sousType?, shoeType?, sacType?, bijouType?, accessoireType?, couleur, couleurLue, matiere?, manches?, boite, photo_url }] }`
ou `{ ok: false, code }` (`non_configure`, `photo_invalide`, `photo_refusee`, `credits_epuises`, `fournisseur_indisponible`, `resultat_invalide`, `quota_atteint`, `lecture_indisponible`).

**Règles**
- Au plus 8 objets, les plus grands, dans l'ordre de lecture ; un objet sans catégorie reconnue, trop petit (< 0,15 % de l'image) ou lu deux fois (recouvrement > 60 %) n'est pas proposé.
- Une valeur hors liste est ignorée, jamais transmise ; la couleur est ramenée à la palette de l'app (celle des métaux pour un bijou) ; `couleurLue: false` quand le
  modèle n'a rien rendu de lisible : la teinte n'est pas à présenter comme détectée.
- Fichiers dans le dossier de la personne : `….oN.detouree.webp` (un objet détouré, reconnu par `estPhotoDetouree`, pas par `estPhotoMiseAPlat`). Plus de planche `….tenue.webp` depuis le 11/10/2026.
- Rien repéré : `objets: []`, aucun détourage payant.
- Plafond : `MAX_IMPORTS_TENUE_PER_USER_PER_DAY` (50 par défaut depuis le 11/10/2026, 5 avant ; une variable déjà définie dans Supabase l'emporte, quota `importer-tenue`) ; secrets `PHOTOROOM_API_KEY`, `OPENAI_API_KEY`, `IMPORT_TENUE_MODEL` (facultatif).
- Coût par tenue : une lecture OpenAI (détail élevé), un détourage PAR OBJET (modifié le 11/10/2026 : avant, un seul détourage de la planche entière, recadré ensuite — les boîtes qui se chevauchent gardaient des fragments des pièces voisines).
- Un objet dont le détourage échoue n'est pas proposé (jamais un recadrage rectangulaire à la place) ; crédits épuisés ou clé refusée arrêtent la boucle ; aucun objet exploitable avec une cause fournisseur rend ce code, pas une liste vide.
- Limite réelle : le fournisseur isole le sujet principal du recadrage. Deux pièces très imbriquées peuvent encore se contaminer. NON ESSAYÉ contre le vrai service.

## NON ESSAYÉ contre les vrais services
- La qualité de la boîte rendue par le modèle (objets qui se touchent, bracelets, montre).
- Le détourage d'un recadrage (la boîte est en fractions de la photo d'origine).

## Écran (livré le 10/10/2026)

`ImporterTenueScreen.tsx` (écran `importerTenue`, hors barre du bas), la carte d'entrée « Importer une tenue entière » en tête d'« Ajouter une pièce » a été RETIRÉE le 11/10/2026 à la demande de la propriétaire : l'écran et l'action `openImporterTenue` existent toujours, mais l'entrée est maintenant le bouton « Détecter toutes les pièces de la photo » du bandeau d'« Ajouter une pièce », qui apparaît quand l'analyse dit que la photo montre une pièce portée ou plusieurs pièces : le fichier choisi est confié à l'écran (`confierPhoto` / `reprendrePhoto`, `importTenue.ts`), qui lance la lecture sans second choix de photo. Depuis le 11/10/2026 (choix de la propriétaire) le passage est AUTOMATIQUE, une fois par photo choisie, dès que l'analyse dit « portée » ou « plusieurs » ; le bouton reste en repli. À savoir : l'import coûte une mise à plat, une lecture et un détourage par objet, et son quota est de 5 par jour. Logique pure testée : `src/lib/importTenue.ts`.

- États : choix de la photo · analyse (3 étapes, la première tient à l'envoi réel) · résultat (une carte par objet, accordéon : nom, catégorie, modèle, couleur, manches, saisons) · ajout un à un (« Ajout 2 sur 3 ») · terminé · une seule pièce (carte ouverte, sans case) · rien repéré · échec (réessayer ou non selon le code) · dressing gratuit trop petit.
- Une pièce n'est créée que si elle est COCHÉE ET COMPLÈTE : saisons (jamais présélectionnées), manches pour une pièce qui en a, modèle pour des chaussures. Une carte incomplète dit « Précise les saisons », le bouton se grise avec « Précise les saisons de [nom] pour l'ajouter ».
- Couleur : dite « À choisir » quand le serveur ne l'a pas lue (`couleurLue: false`). Occasions : aucune enregistrée.
- Dressing gratuit : les cases cochées sont limitées aux places restantes (`limiterAuxPlaces`), l'écran le dit et renvoie vers Premium. `ajouterPieceImportee` (store) relit la limite à chaque pièce.
- Fichiers : les objets non créés et la photo d'origine sont supprimés une fois l'import validé ; en quittant sans valider, tous le sont. Un échec en cours d'ajout garde les pièces non créées dans la liste.
- NON VÉRIFIÉ à l'écran : le rendu n'a pas été vu (la fonction Edge n'est jamais appelée en mode démo), ni le service réel.

## À faire ensuite
Essayer avec la vraie clé Photoroom et OpenAI : qualité des boîtes et des détourages sur photo portée, puis ajuster les points ci-dessus.

## Écran de résultat refondu (11/10/2026, d'après une capture d'une autre application)
Plus de cases à cocher ni de bouton fixe « Ajouter les N pièces » : titre « N pièces détectées », « Tout ajouter » en haut, et une carte par pièce (photo cadrée détourée, nom avec crayon, catégorie, corbeille, « Mettre à plat », « Ajouter »). « Ajouter » d'une carte incomplète ouvre ses champs (saisons, manches, modèle restent requis). Les pièces ajoutées sortent de la liste ; sans pièce restante, l'import est terminé. « Mettre à plat » est SUR DEMANDE (même fonction que la fiche pièce, mêmes messages d'échec) et ne remplace la photo de la carte qu'en cas de succès. Dressing gratuit : jamais plus de pièces ajoutées que de places.

« Ajouter une pièce » (états dans `etatAjout.ts`, testés) : sans photo, seul le choix de la photo (+ « Saisir la pièce sans photo ») ; photo en envoi ou en analyse, champs et bouton masqués ; analyse qui n'a rien lu, message avec « Réessayer », remplacer la photo ou « Saisir à la main » ; analyse faite, le formulaire. « Retirer la photo » (feuille « Changer la photo ») ramène à l'état initial et efface le nom et les champs lus sur elle ; remplacer la photo efface de même les champs lus (jamais ceux que la personne a choisis).

## Parcours fluide (12/10/2026, signalé : « j'ajoute une photo, l'écran pièce s'affiche puis je bascule sur Ajouter une tenue »)
Une seule étape d'analyse : la photo choisie s'affiche en grand (4/5) avec « Capsela analyse ta photo », puis soit le formulaire d'une pièce seule, soit la liste des pièces de la tenue. Quand l'analyse d'« Ajouter une pièce » dit « portée » ou « plusieurs pièces », l'écran reste en chargement (`redirection` dans `etatAjout`), confie à l'import le fichier ET son URL déjà envoyée (`confierPhoto({ fichier, url })` : pas de second envoi), se vide (`retirerPhotoAjout`) et ouvre l'import, qui lit la photo à son tour. Une photo « plusieurs pièces » n'est plus détourée par « Ajouter une pièce » (le détourage supprimait l'original que l'import réutilise). Une seule pièce repérée dans une tenue reste une carte ouverte de l'import.

## Saisons suggérées à l'import (12/10/2026, demandé : l'ajout ne doit pas exiger d'action)
La lecture de la tenue rend aussi `saisons` (une ou plusieurs, parmi les quatre, d'après matière, épaisseur et coupe visibles ; `null` si le modèle n'est pas sûr). Elles préremplissent la carte, modifiables : une pièce dont les saisons sont lues n'exige plus rien avant « Ajouter ». Sans saison lue, rien n'est inventé : la carte dit « Précise les saisons ». Même principe que « Ajouter une pièce » (saisons « lues sur ta photo »). La fonction `importer-tenue` doit être redéployée (workflow Supabase) pour que la lecture les rende.

## Écran d'analyse (12/10/2026)
Photo en grand (4/5, plafonnée à la hauteur disponible), carte au pied de l'image (cintre de marque `LoadingSpinner`, « On prépare ta pièce »), dégradé léger sans voile uniforme. Un seul message stable : l'analyse ne rend ni étape ni pourcentage.

## Fiabiliser les cadrages (12/10/2026, signalé : un pantalon coupé à la jambe, une carte « Baskets » qui montrait du sol)
La boîte de chaque pièce est lue par un modèle de vision (peu fiable pour localiser). Trois garde-fous, tous dans `importer-tenue` + `analyseTenue.ts` (`analyserDecoupe`, `cotesCoupes`, testés) :
- **Consigne** : boîte la plus SERRÉE, de la ceinture à l'ourlet pour un pantalon, sans autre article, sans couper la pièce.
- **Pièce coupée** : si ce que le détourage garde touche le bord du recadrage côté intérieur de la photo, la boîte l'a coupée : UN second détourage avec une marge plus large (0,08 puis 0,22). Coût : un appel Photoroom de plus, seulement dans ce cas (au plus deux par pièce).
- **Pas une pièce** : part gardée < 5 % du recadrage (rien) ou > 92 % (fond non retiré) : la pièce n'est pas proposée plutôt qu'une carte avec du sol.
Les décisions sont journalisées (`console.warn`, part gardée, côtés coupés). NON DÉMONTRÉ sur de vraies photos : aucune mesure du taux de cadrages corrects avant/après. Leviers restants si ce n'est pas assez : un modèle plus fort (`IMPORT_TENUE_MODEL`, ex. gpt-4.1 — plus cher), ou une passe de vérification du recadrage par le modèle.

## Cadrage, deuxième passe (12/10/2026, signalé : une « veste » qui montrait la personne entière, un « sac » qui montrait un pantalon, des « chaussures » qui montraient du sol)
Le détourage d'un recadrage garde le SUJET PRINCIPAL du recadrage : une boîte trop large sur une photo portée donne donc la personne entière. Une boîte lue sur toute la photo est imprécise, la même lecture regarde maintenant de plus près CHAQUE recadrage (`promptVerificationRecadrage`, `assainerVerification`, `rectangleAffine`, testés) : « l'article est-il vraiment dans ce recadrage, et où ? ». **Absent** : la pièce n'est pas proposée, et aucun détourage payant n'est lancé ; **présent** : recadrage plus serré sur ce que le modèle a vu, puis détourage, puis les garde-fous précédents (pièce coupée, part gardée). Une réponse illisible ou un service en panne garde le recadrage d'origine (jamais une pièce rejetée sur une panne). Coût : une lecture OpenAI de plus par pièce (image basse résolution). NON DÉMONTRÉ sur de vraies photos : aucune mesure du taux de bons cadrages ; limite restante : sur une photo portée, un article qui épouse le corps (un haut sous une veste) reste difficile à isoler sans mise à plat.

## Détourage à l'ajout (12/10/2026)

Demandé après le bilan des coûts d'un import (Photoroom représentait l'essentiel du coût, et une partie des pièces proposées n'est jamais gardée). `importer-tenue` ne détoure PLUS : il lit, vérifie et resserre chaque recadrage (`rectangleAffine`), et le dépose brut en `….oN.webp` (sans la marque « détourée »). Le détourage payant se lance à « Ajouter » / « Tout ajouter », uniquement pour les pièces ajoutées : `detourer-photo` avec `recadrer: true` détoure, rogne sur ce que le service a gardé (`rectangleOpaque`) et refuse un résultat qui n'est pas une pièce isolée (part gardée hors de 5–92 %, code `photo_refusee`). Les cartes sont détourées en parallèle ; une pièce dont le détourage échoue n'est pas ajoutée, elle reste dans la liste avec la cause (jamais un recadrage rectangulaire dans le dressing). Plafond `detourer-photo` : 50 par jour (10 avant). Le plafond d'import (50) ne porte plus que sur l'OpenAI.

Conséquences, à connaître : (1) le second détourage « pièce coupée » (marge élargie) n'existe plus, la marge est choisie avant l'appel (large, resserrée par la vérification ; étroite si la vérification est en panne) ; (2) les cartes montrent un recadrage rectangulaire avant l'ajout, détourées seulement ensuite ; (3) le secret PHOTOROOM_API_KEY n'est plus requis par `importer-tenue`. NON DÉMONTRÉ : la qualité du détourage d'un recadrage déjà resserré n'est pas mesurée sur de vraies photos.
