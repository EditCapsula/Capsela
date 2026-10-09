# Prompt Claude Design — « Importer une tenue » (option B)

À coller dans Claude Design. Produit une planche d'états (comme « Ajouter une pièce V3 ») : un fichier HTML avec un composant d'écran réutilisable et une page de présentation des états.

---

## Rôle

Tu es Lead UX/UI Designer d'applications mobiles premium de mode. Tu conçois, pour Capsela, un nouveau parcours : **importer une tenue complète depuis une seule photo**, puis la transformer en **pièces séparées** du dressing, une pièce par objet.

Livre une **planche de 12 états** d'un même écran mobile (390 × 844 px), dans le même format que la planche « Ajouter une pièce V3 » : un composant d'écran paramétré par un état, une page qui les affiche côte à côte, chaque état légendé. Ne dessine pas d'autres écrans.

## Le problème à résoudre

Aujourd'hui, une photo = une pièce. Mais beaucoup de personnes photographient une tenue entière portée (robe, sac, sandales, bracelets, montre). Capsela sait déjà remettre cette photo « à plat » : tous les vêtements et accessoires de la photo sont posés sur un fond uni, à plat, comme un visuel de catalogue. Le nouveau parcours part de cette image à plat et propose de **créer une pièce par objet détecté**, chacune avec sa fiche, que la personne valide avant l'ajout.

Une pièce ne se crée jamais sans l'accord de la personne. Rien n'est inventé : si un objet n'est pas détecté, il n'est pas proposé.

## Design system (ne rien inventer)

- Fond app `#F3EEE5` · surfaces `#FBF8F3` · bordures `#E6DCCB` · sable `#F0E5D6` / `#E2C9A8`
- Terracotta plein `#9E5B43` (actions, sélection) · accent `#A66950`
- Texte `#1D1A16` / `#5C5648` / `#8B8375`
- Fraunces (titres, valeurs) + Manrope (interface). Aucune autre famille. Pas d'emoji.
- Eyebrow : Manrope 10,5 px, capitales, `letter-spacing .16em`, `#8B8375`
- Chips : 40 px de haut, rayon 100, 12,5 px / 500 ; actif = terracotta plein + texte `#FBF3EA`, inactif = `#FBF8F3` + bord `#E6DCCB`
- Bouton principal 52 px, pilule, capitales, `letter-spacing .08em` ; secondaire 44 px
- Icônes SVG linéaires, trait 1,6. Cibles tactiles ≥ 44 px. Rayons de cartes 20–24 px.
- Même écriture que les écrans existants : header retour 44 px + titre centré Fraunces 19 px ; CTA fixe en bas (fond `#F3EEE5`, filet haut, zone de sécurité) ; spinner « cintre » 24 px.
- Tutoiement. Phrases courtes. Jamais de message négatif sur le corps, la silhouette ou l'apparence ; Capsela parle des pièces, pas de la personne.

## Contenus honnêtes (règles)

- « Capsela a repéré … » uniquement quand l'analyse a réellement trouvé des objets. Jamais de chiffre ou de nom inventé.
- Le visuel à plat est **généré** : dis-le une fois, sobrement (« Image générée à partir de ta photo : vérifie qu'elle ressemble à tes pièces »), sans jargon technique ni nom de fournisseur.
- Aucun filigrane, aucune mention d'un service tiers à l'écran.
- La photo d'origine reste à la personne tant qu'elle n'a pas validé.

## Structure de l'écran (une page défilante, un CTA fixe)

1. **Header** : retour · titre « Importer une tenue ».
2. **Zone image** (ratio 1,3 comme « Ajouter une pièce », même hauteur à tous les états) : la photo d'origine, puis l'image à plat. Un bouton « Voir ma photo » / « Voir l'image à plat » bascule entre les deux (segmenté, 44 px).
3. **Phrase de statut** (`role="status"`).
4. **Liste des objets détectés** : une carte par objet, 72 px de haut au repos —
   - miniature carrée (objet recadré sur l'image à plat, fond `#F0E5D6`),
   - nom suggéré en Fraunces 16 px, catégorie en Manrope gris,
   - case à cocher ronde 44 px à droite (cochée = sera créée),
   - toucher la carte l'ouvre en place (accordéon) pour modifier : Nom, Catégorie, Modèle, Couleur principale, et — selon la catégorie — Manches (obligatoire pour haut, robe, veste) ; Saisons (obligatoire, aucune présélection, au moins une).
5. **CTA fixe** : « Ajouter N pièces » (N = objets cochés et complets). Aide dessous.

Une carte incomplète (saisons ou manches manquantes) affiche, dans sa ligne, « Précise les saisons » en terracotta, sans rouge ni bloc d'alerte ; le CTA se désactive avec le message « Précise les saisons de [nom] pour l'ajouter. » et ne compte pas cette pièce.

## Les 12 états à dessiner

1. **Point d'entrée** — depuis « Ajouter une pièce » : une carte secondaire « Importer une tenue entière » (sous-titre « Une photo, plusieurs pièces ») au-dessus de la zone photo. Montre cet écran-là, pas le nouveau.
2. **Choix de la photo** — zone vide : « Photographie ta tenue » · « Porte-la en pied, sur un fond simple, bien éclairée. » · boutons « Prendre une photo » / « Importer ». Une ligne d'aide : « Capsela repère chaque pièce, tu choisis celles à ajouter. »
3. **Analyse en cours** — voile `rgba(243,238,229,.64)` + carte « Capsela regarde ta tenue » avec 3 étapes : « Mise à plat de la tenue · Repérage des pièces · Couleurs et catégories » (faite = coche terracotta, en cours = point plein `#A66950`, à venir = cercle `#CFC3B0`). CTA désactivé.
4. **Résultat — 5 objets repérés** (le cas de la capture : une robe, un sac, des sandales, des bracelets, une montre). Tous cochés par défaut. Bascule photo / à plat visible. Phrase : « Capsela a repéré 5 pièces. » + ligne d'honnêteté sur l'image générée.
5. **Une carte ouverte** — la robe en édition : Nom, Catégorie, Modèle, Couleur (8 pastilles + « Toutes les couleurs »), Manches (4 options), Saisons (4 chips, aucune présélection).
6. **Pièce incomplète** — la robe sans saisons : message dans la carte, CTA désactivé avec son message.
7. **Je décoche** — 3 pièces cochées sur 5 ; les cartes décochées sont atténuées (opacité .55, texte « Ne sera pas ajoutée ») ; CTA « Ajouter 3 pièces ».
8. **Ajout en cours** — barre de progression sobre « Ajout 2 sur 3 » dans le CTA (spinner cintre) ; les cartes s'ajoutent une à une (coche à mesure) ; `aria-busy`.
9. **Terminé** — « 3 pièces ajoutées à ton dressing » ; une rangée de leurs miniatures ; boutons « Voir mon dressing » (principal) et « Importer une autre tenue » (secondaire).
10. **Un seul objet** — la photo ne contient qu'une pièce : l'écran propose simplement de l'ajouter (une carte ouverte), sans liste, avec le texte « Une seule pièce repérée ».
11. **Aucun objet repéré** — « Capsela n'a pas repéré de pièces sur cette photo. » · conseils en trois puces (en pied, fond simple, bonne lumière) · boutons « Reprendre une photo » / « Ajouter une pièce à la main ». Ton rassurant, jamais culpabilisant.
12. **Échec ou limite** — deux variantes côte à côte :
    - service indisponible ou plafond du jour atteint : « La mise à plat n'a pas abouti. Ta photo est inchangée. » + « Réessayer » ; pour le plafond, « Tu as atteint la limite du jour, reviens demain. » ;
    - dressing gratuit plein (la limite gratuite est atteinte avant d'ajouter toutes les pièces) : « Il te reste N places dans ton dressing gratuit. » + sélection des N pièces à garder (cases) + lien « Découvrir Premium ». Sans ton de reproche.

## Contraintes d'ergonomie

- Une seule page défilante, CTA fixe, jamais d'étape « Continuer ».
- Padding bas du contenu ≥ 132 px ; le clavier ouvert ne masque jamais le champ actif (scroll du champ au-dessus de la barre).
- Cartes repliées par défaut ; une seule carte ouverte à la fois.
- Le visuel du bouton « Importer une tenue » ne doit pas concurrencer le chemin principal « Prendre une photo » d'une pièce seule.
- Accessibilité : cases `role="checkbox"` + `aria-checked` ; chips en `aria-pressed` ; sélection jamais signalée par la seule couleur (coche, anneau, libellé) ; statuts en `aria-live="polite"` ; focus visible.
- 360 / 390 / 412 px : aucun débordement, aucun texte tronqué sans retour à la ligne.

## Ce que tu livres

1. Le fichier HTML de la planche (composant + page des 12 états), même structure que la planche « Ajouter une pièce V3 ».
2. En dessous de chaque état, une ligne : le comportement attendu (ce qui se passe au toucher).
3. Une liste courte des **décisions à arbitrer** (nombre maximal de pièces proposées par photo, ordre des cartes, case « tout cocher », ce qui se passe pour un accessoire minuscule comme une montre).

Ne génère aucune image : utilise des vignettes de remplacement neutres (aplat `#F0E5D6` + pictogramme de la catégorie) et indique où viendront les vraies images.
