# Le visuel d'un article de ticket de caisse

Mis en place le 06/11/2026 (option 2 arbitrée par la propriétaire : « Option 2 »).

## Pourquoi un visuel créé, et non retrouvé

Le ticket ne donne pas de photo. L'audit du 06/11/2026 n'a trouvé aucune source autorisée qui rende la photo du produit acheté :
pas d'API publique Zara / Inditex (et pas de scraping), l'API d'images de Google fermée aux nouveaux clients (arrêt le 01/01/2027),
une recherche d'images (Brave) qui rend des photos appartenant aux marques. Capsela **crée** donc un visuel **indicatif** de l'article
décrit, avec le moteur des visuels du catalogue : même fond transparent, même lumière, même style que le reste du dressing.

Il n'est jamais présenté comme la photo du produit : badge « Visuel indicatif » et phrase « ce n'est pas la photo de ton article ».

## Parcours (Ajouter une pièce → ticket → liste des articles)

1. Dès que la liste s'affiche, chaque article dont la catégorie est connue reçoit son visuel, deux à la fois (« Création du visuel… »).
   Une catégorie encore à choisir attend : le visuel en dépend.
2. **Visuel créé** : affiché sur la carte, avec « Confirmer ce visuel », « Prendre une photo », « Choisir dans la galerie ». Il n'est
   associé à la pièce qu'après « Confirmer ce visuel ». Si le nom, la couleur ou la catégorie changent ensuite : « Recréer le visuel ».
3. **Aucun visuel** (échec, plafond du jour, délai dépassé, mode démo) : « Prendre une photo », « Choisir dans la galerie », ou garder
   la pastille de couleur. Rien n'est bloqué : la pièce s'ajoute avec ou sans photo.
4. Une fois la pièce ajoutée, le visuel confirmé (ou la photo) est sa photo principale, dans le dressing et sur sa fiche. Une photo
   personnelle reste possible ensuite.

Le cas « plusieurs visuels à choisir » du cahier des charges ne s'applique pas : un visuel créé est unique, et l'utilisatrice garde
toujours le choix de sa propre photo.

## Architecture

- `supabase/functions/_shared/visuelArticle.ts` (pur, testé) : la demande validée (`articleValide`), la ligne lue par
  `buildImagePrompt` (le nom tient lieu de sous-type), la clé de cache (`cleVisuel`), le chemin du fichier.
- `supabase/functions/visuel-article` : authentification, règle d'accès du ticket (`LIRE_TICKET`), cache, plafond par compte et par
  jour, génération (gpt-image-1, fond transparent), WebP, rangement dans `dressing-photos/{user}/visuel-{empreinte}.detouree.webp`
  (dossier privé ; la marque `.detouree.` évite un second détourage). Lien signé de 24 h. Jamais d'erreur dure : `{ code }`.
- `src/lib/visuelArticle.ts` : l'appel, un délai de 75 s, une seule demande par description et par session.
- `ImporterTenueScreen.tsx` : les états de la carte, la confirmation, la photo personnelle ; les visuels créés et non retenus sont
  supprimés en quittant l'écran.

Une même description redemandée rend le même fichier, sans nouvelle génération ni quota.

## Dépendances et coûts

- `OPENAI_API_KEY` : déjà en place (catalogue, analyse des photos, ticket).
- Facultatifs : `IMAGE_GENERATION_MODEL`, `IMAGE_GENERATION_QUALITY` (ceux du catalogue), `MAX_VISUELS_ARTICLE_PER_USER_PER_DAY`
  (30 par défaut).
- Coût : environ 0,02 $ par visuel (gpt-image-1, qualité basse, estimation du catalogue), pour chaque article de ticket affiché.
- Aucune migration : le plafond utilise `consommer_edge_quota` (déjà en place), les fichiers le bucket `dressing-photos`.
- Déploiement : automatique au merge sur `main` (workflow « Déployer les fonctions Supabase »).

## Non fait

- **Lecture des références (SKU, EAN)** : approuvée le 06/11/2026, mais sans usage avec un visuel créé ; elle servira le jour où une
  source autorisée (partenariat, flux d'affiliation) rendra la photo d'un produit par sa référence. Le ticket ne garde toujours ni prix
  ni numéro.
