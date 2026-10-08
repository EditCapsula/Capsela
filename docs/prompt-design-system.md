# Prompt « design system » Capsela

Prompt à fournir tel quel à un assistant (Claude, ou un outil de maquettes) pour qu'il conçoive ou code des écrans cohérents avec l'application. Il est tenu à jour avec le code : la source de vérité reste `src/app/globals.css` (jetons et typographie), `src/components/` (composants) et `CLAUDE.md` / `AGENTS.md` (règles). Dernière mise à jour : 08/10/2026 (flat lay, accueil, Mon planning, visuels éditoriaux, silhouette de chargement, règles de saison).

---

## Prompt

Tu mets à jour le design system de **Capsela**, une application mobile qui compose chaque jour une tenue à partir du dressing réel de la personne, de la météo et de son occasion. Le ton est éditorial, chaleureux, jamais gadget. Tu tutoies l'utilisatrice. L'interface est en français. Remplace la version précédente du design system par ce qui suit.

### 1. Marque
- Nom : Capsela (jamais « L'édit Capsela »).
- Logo : « CAPSELA » en capitales, Fraunces, interlettrage large, souligné d'un trait terracotta de 2 px. Pas de cintre. Tailles sm / md / lg, variante claire sur fond sombre.

### 2. Couleurs (jetons, jamais de valeur en dur)
- Fond crème #F3EEE5. Texte encre #1D1A16. Accent terracotta #A66950 (liens, icônes actives, surtitres), survol #8B5E4D.
- Aplats pleins (hero, puce active) : terracotta profond #9E5B43. Texte sur terracotta #FBF3EA, secondaire #F0DDCF.
- Surfaces : carte #FBF8F3, creux et séparateur #EFE7DA, bordure #E6DCCB, fond chaud #F0E5D6 (bordure #DFD3BE), fond photo #F3EDE1, sélection #F6EBE2.
- Texte secondaire : #7B7366, #5C5548, encre douce #3F3B34, placeholder #B3AA9B. Texte chaud : #8A6B4A, #7C5A43, sable #8C5540 (bordure #E2C9A8).
- Statuts : erreur #F4E2DA / #DCB2A0, réussite #5B7A5E / #E7EEDF.

### 3. Typographie
- Fraunces pour les titres et les chiffres, Manrope pour tout le reste. Caveat : un seul usage, la phrase d'ambiance de la tenue.
- Rôles : display 28 (« Bonjour »), titre d'écran 24 (second temps en italique terracotta), titre de section 21, titre de carte 18, ligne 16, vignette 15, chapeau 13, surtitre 11 capitales .16em, label 10, bouton 13 capitales .1em, lien 12 suivi de « → », barre du bas 9 capitales.
- Corps 13, secondaire 12, légende 11.

### 4. Formes
- Rayons : mini 8, champ 12, bloc 14, tuile 16, carte 20, feuille 22, hero 24. Boutons et segments en pastille.
- Boutons : 52 px de haut minimum, capitales. Le bouton principal d'un écran est toujours terracotta. « Sombre » est réservé à des cas précis (Premium, fiche pièce, préférences). Variantes : secondaire, contour, claire (sur fond terracotta), destructif, et le bouton discret pour une action tertiaire.
- Pas de flèche « → » dans un bouton, seulement dans les liens texte. Un bouton inactif reste lisible et dit pourquoi au tap. Cible tactile de 44 px minimum.
- SegmentedControl : deux variantes, piste (Mois / Semaine / Liste) et pastilles (filtres), actif en terracotta profond.
- Composants à réutiliser : Button, Card, Badge, Input, SegmentedControl, BottomSheet, EmptyState, Rangee, OutfitComposition, AppHeader, BoutonRetour, FilEtapes, LogoCapsela, JourEtMeteo, IconeTuile, FlatLayCapsela.

### 5. Navigation
- Une seule page, navigation par état. Barre du bas à cinq onglets : Aujourd'hui · Dressing · Capsule · Journal · Planifier. L'onglet Planifier reste allumé sur « Mon planning » (le calendrier).
- Les parcours guidés (Planifier, Valise, Ajouter une pièce, Premium) masquent la barre et posent leur action principale en pied d'écran.
- Gouttière de 16 px sur l'accueil et le planning, 24 px dans les parcours.

### 6. Flat lay
La tenue s'affiche en pièces posées à plat sur fond crème, sans mannequin.
- Deux contextes : accueil (zone 100 × 112 unités, jusqu'à 2 accessoires) et détail de la tenue (zone 100 × 126, 2 accessoires).
- Rôles de pièce : hero, secondaire, couche, bas, chaussures, sac, accessoire.
- Les couches s'empilent par groupe stylistique : pull ou maille avec chemise ou T-shirt à gauche, bas à droite, chaussures en bas à gauche, sac en bas à droite.
- La pièce principale occupe 58 % de la largeur au plus. Chevauchement limité (18 % en détail, jusqu'à 60 % entre couches à l'accueil). Rotations faibles, bornées par type de pièce. Marge de sécurité de 3 unités. Accessoires de 8 unités de large au minimum.
- À l'accueil, le T-shirt est masqué quand une couche le recouvre ; composition cible : blazer, pull, pantalon, sac, bottines.
- Le sac ne déborde jamais sur la barre du bas (`isolation: isolate`, z-index de 10 en 10). Une pièce sans visuel est exclue.
- Visuels : chaque pièce du catalogue a une version « hero » détourée, générée par une fonction Edge ; les pièces du dressing utilisent leur photo détourée.
- Chargement : silhouette aux mêmes proportions que la composition finale (le haut n'est pas plus grand que le bas), pulsation douce, sans texte.

### 7. Accueil
- Carte hero terracotta profond (rayon 24), hauteur minimale 307 px. Deux colonnes : texte à gauche, flat lay à droite (55 % de la largeur, entre 140 et 181 px).
- Actions sous le hero : « Pas pour moi » et « Autre idée » ouvrent la feuille de quota quand le quota est dépassé. Pas de lien « Voir une autre proposition » sur une tenue planifiée : l'alerte météo reste, en texte.
- « Tout pour ton style » : quatre cartes de même hauteur, chacune avec un visuel éditorial WebP (460 px, cover, object-position réglé par carte), un surtitre, un titre Fraunces et un lien.

### 8. Mon planning
- Titre « Mon planning », vues Mois / Semaine / Liste.
- Pastilles de statut : plein = porté, creux = planifié, cerclé = aujourd'hui. Les jours passés sans tenue n'affichent pas leur date.
- Semaine : en-tête « SEMAINE N » (numérotation simple, la semaine 1 commence le 1er janvier), puis les jours restants.
- Liste : « À VENIR » (10 jours, 6 lignes au plus) et « RÉCEMMENT PORTÉES » (4 lignes au plus). Une ligne : date courte, « occasion · statut », 4 miniatures au plus avec « +n ». Lien « Voir toutes mes tenues → » vers une page Historique groupée par mois, avec filtres.
- Une section sans donnée ne s'affiche pas ; l'état vide est une phrase et une action.

### 9. Règles de contenu
- Aucune donnée inventée à l'écran. Une phrase qui dit qu'une donnée « sert à » quelque chose doit être vraie dans le code.
- Jamais de message morphologique négatif. Interdits : cacher, dissimuler, camoufler, corriger, défaut, grossir, amincir, peu flatteur. Aucune logique fondée sur la couleur de peau, la morphologie, l'âge ou le genre apparents. La colorimétrie passe par un questionnaire sur des traits déclarés, jamais par une photo.
- Météo jamais inventée : prévision du lieu, ou « La météo sera disponible plus près de la date ».
- Pas de sandales d'été sous 15 °C. La saison déclarée d'une pièce du dressing est une règle stricte.
- Pas d'emoji (hors météo), pas de glyphe décoratif : des icônes SVG au trait (1.5 à 1.6, currentColor). Pas de mannequin.
- Chaque écran prévoit ses états vide, chargement, erreur et rempli ; l'accessibilité ne repose jamais sur la couleur seule.
- Largeurs à tenir : 320, 390 et 430 px, sans défilement horizontal.

### Livrable attendu
Pour chaque écran : la hiérarchie (surtitre, titre, chapeau, action principale), les jetons et composants utilisés, les états, et les textes exacts en français.
