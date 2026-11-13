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
2. **Visuel créé** : affiché sur la carte, avec « Confirmer ce visuel », « Prendre une photo », « Choisir dans la galerie ». Si le nom,
   la couleur ou la catégorie changent ensuite : « Recréer le visuel ». **Depuis le 13/11/2026** (signalé : un sac ajouté sans toucher
   « Confirmer ce visuel » entrait au dressing sans image), l'article ajouté sans photo part avec son visuel indicatif, même non
   confirmé, tant qu'il correspond à sa description ; une photo personnelle passe toujours avant. La carte le dit : « Il illustrera ta
   pièce, sauf si tu ajoutes ta photo. »
3. **Aucun visuel** (échec, plafond du jour, délai dépassé, mode démo) : « Prendre une photo », « Choisir dans la galerie », ou garder
   la pastille de couleur. Rien n'est bloqué : la pièce s'ajoute avec ou sans photo.
4. Une fois la pièce ajoutée, le visuel confirmé (ou la photo) est sa photo principale, dans le dressing et sur sa fiche. Une photo
   personnelle reste possible ensuite.

Le cas « plusieurs visuels à choisir » du cahier des charges ne s'applique pas : un visuel créé est unique, et l'utilisatrice garde
toujours le choix de sa propre photo.

## Vérification article par article et préremplissage (06/11/2026)

Brief « Optimisation UX/UI du parcours d'ajout au dressing et import de ticket de caisse Premium ».

- **Un article à la fois** (`ImporterTenueScreen`, mode ticket) : « Article 2 sur 3 », la fiche ouverte avec le formulaire de la carte (nom, catégorie, modèle, couleur, manches, motif, saisons — aucun champ ajouté), et une barre fixe en bas : « Ajouter cet article » et « Ajouter la photo de la pièce » (facultative, appareil ou galerie). Le bouton « Ajouter » de la carte et « Tout ajouter » ne s'affichent plus pour un ticket : un seul bouton d'ajout à l'écran. L'article ajouté sort de la liste, le suivant s'affiche ; à la fin, la confirmation et « Voir mon dressing ». L'import de plusieurs pièces depuis une PHOTO ne change pas.
- **Préremplissage enrichi** (`_shared/lectureTicket.ts`, la même fonction `lire-ticket`, aucun second moteur) : en plus du nom, de la catégorie, de la taille et de la couleur, la lecture rend le modèle, les manches, le motif et les saisons, chacun seulement parmi les valeurs permises POUR SA CATÉGORIE (les mêmes listes que le formulaire) ; une valeur incertaine reste vide. La consigne demande d'identifier l'article (abréviations de l'enseigne, référence produit quand elle l'établit avec certitude, jamais recopiée), et de tirer les saisons de la nature du vêtement, jamais de la date d'achat. Le nom n'a qu'une majuscule, la première (`nomAvecUneMajuscule`).
- **Limites** : aucune base produit externe n'est interrogée (aucune source autorisée à ce jour) ; la reconnaissance par référence repose sur ce que le modèle sait de l'enseigne, et reste vide quand il n'est pas sûr. Les champs obligatoires du formulaire (saisons, manches d'une pièce qui en a, modèle d'une chaussure) le restent : la barre le dit (« Précise les saisons ») et amène au champ.

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
