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
