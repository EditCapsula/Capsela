# Importer une tenue — une photo, plusieurs pièces

Demandé le 10/10/2026 (option B) ; maquette « Capsela — Importer une tenue » (14 états), prompt dans `prompt-design-import-tenue.md`.

## Parcours

```text
photo de la tenue (stockage privé) → mise à plat Photoroom (Flat Lay) → lecture des objets (OpenAI vision : catégorie, couleur, matière,
manches, boîte) → détourage de la planche → recadrage de chaque boîte → un fichier par objet
```

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
- Fichiers dans le dossier de la personne : `….oN.detouree.plat.webp` (un objet : détouré et mis à plat, donc reconnu par `estPhotoDetouree` / `estPhotoMiseAPlat`) et
  `….tenue.webp` (la planche entière, sans marque : la photo d'aucune pièce).
- Sans mise à plat, pas de découpe : jamais de recadrage d'une photo portée (le service doit rendre une planche, sinon `code` d'échec, photo inchangée).
- Rien repéré : `objets: []`, aucun détourage payant.
- Plafond : `MAX_IMPORTS_TENUE_PER_USER_PER_DAY` (5 par défaut, quota `importer-tenue`) ; secrets `PHOTOROOM_API_KEY`, `OPENAI_API_KEY`, `IMPORT_TENUE_MODEL` (facultatif).
- Coût par tenue : une mise à plat (génératif, plan Plus), une lecture OpenAI (détail élevé), un détourage.

## NON ESSAYÉ contre les vrais services
- Le contrat de la mise à plat (extraits de documentation) ; la planche qu'elle rend n'a jamais été lue pour une tenue entière.
- La qualité de la boîte rendue par le modèle (objets qui se touchent, bracelets, montre).
- Que le détourage rende une image de même taille que la planche (la boîte est en fractions : un recadrage de la planche détourée suppose les mêmes proportions).

## Écran (livré le 10/10/2026)

`ImporterTenueScreen.tsx` (écran `importerTenue`, hors barre du bas), entrée par la carte « Importer une tenue entière » en tête d'« Ajouter une pièce » (création, sans photo). Logique pure testée : `src/lib/importTenue.ts`.

- États : choix de la photo · analyse (3 étapes, la première tient à l'envoi réel) · résultat (bascule « Voir ma photo / Voir l'image à plat », une carte par objet, accordéon : nom, catégorie, modèle, couleur, manches, saisons) · ajout un à un (« Ajout 2 sur 3 ») · terminé · une seule pièce (carte ouverte, sans case) · rien repéré · échec (réessayer ou non selon le code) · dressing gratuit trop petit.
- Une pièce n'est créée que si elle est COCHÉE ET COMPLÈTE : saisons (jamais présélectionnées), manches pour une pièce qui en a, modèle pour des chaussures. Une carte incomplète dit « Précise les saisons », le bouton se grise avec « Précise les saisons de [nom] pour l'ajouter ».
- Couleur : dite « À choisir » quand le serveur ne l'a pas lue (`couleurLue: false`). Occasions : aucune enregistrée.
- Dressing gratuit : les cases cochées sont limitées aux places restantes (`limiterAuxPlaces`), l'écran le dit et renvoie vers Premium. `ajouterPieceImportee` (store) relit la limite à chaque pièce.
- Fichiers : la planche, les objets non créés et la photo d'origine sont supprimés une fois l'import validé ; en quittant sans valider, tous le sont. Un échec en cours d'ajout garde les pièces non créées dans la liste.
- NON VÉRIFIÉ à l'écran : le rendu n'a pas été vu (la fonction Edge n'est jamais appelée en mode démo), ni le service réel.

## À faire ensuite
Essayer avec la vraie clé Photoroom et OpenAI : qualité de la planche et des boîtes, puis ajuster les points ci-dessus.
