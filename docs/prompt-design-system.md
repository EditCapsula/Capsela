# Prompt « design system » Capsela

Prompt à fournir tel quel à un assistant (Claude, ou un outil de maquettes) pour qu'il conçoive ou code des écrans cohérents avec l'application. Il est tenu à jour avec le code : la source de vérité reste `src/app/globals.css` (jetons et typographie), `src/components/` (composants) et `CLAUDE.md` / `AGENTS.md` (règles). Dernière mise à jour : 07/10/2026 (nom « Capsela », nouveau logo, barre à cinq onglets).

---

## Prompt

Tu conçois des écrans pour **Capsela**, une application mobile (site statique Next.js, empaqueté avec Capacitor) qui compose chaque jour une tenue à partir du dressing réel de la personne, de la météo et de son occasion. Le ton est éditorial, chaleureux, jamais gadget. Tu tutoies l'utilisatrice. L'interface est en français.

### Marque
- Nom : **Capsela** (jamais « L'édit Capsela »).
- Logo : « CAPSELA » en capitales, Fraunces, interlettrage large, souligné d'un trait terracotta de 2 px. **Pas de cintre.** Composant : `LogoCapsela` (tailles sm / md / lg, variante claire sur fond sombre).

### Couleurs (jetons, jamais de valeur en dur)
- Fond : crème `#F3EEE5`. Texte : encre `#1D1A16`. Accent : terracotta `#A66950` (liens, icônes actives, surtitres) ; terracotta profond `#9E5B43` pour les aplats pleins (hero, puce active) ; texte sur terracotta `#FBF3EA`.
- Surfaces : carte `#FBF8F3`, creux `#EFE7DA`, séparateur `#EFE7DA`, bordure `#E6DCCB`, fond chaud `#F0E5D6`.
- Texte secondaire : `#7B7366` (muted), `#5C5548` (muted-3), placeholder `#B3AA9B`.
- Erreur `#F4E2DA` / `#DCB2A0`, réussite `#5B7A5E` / `#E7EEDF`.

### Typographie
- Titres et chiffres : **Fraunces**. Tout le reste : **Manrope**. Manuscrite (Caveat) : un seul usage, la phrase d'ambiance de la tenue.
- Rôles : display 34 (le « Bonjour »), titre d'écran 27 (second temps en italique terracotta), titre de section 21, titre de carte 18, ligne 16, vignette 15, chiffre 21 ; chapeau 13, surtitre 11 capitales .16em, label 10, bouton 13 capitales .1em, lien 12 suivi de « → », barre du bas 9 capitales.
- Texte courant : 13 de corps, 12 secondaire, 11 légende.

### Formes
- Rayons : mini 8, champ 12, bloc 14, tuile 16, carte 20, feuille 22, hero 24 ; boutons et segments en pastille.
- Boutons : 52 px de haut au moins, pleine largeur par défaut. Variantes : principal (terracotta), sombre (encre), secondaire, contour, claire (sur terracotta), destructif. Cible tactile ≥ 44 px partout.
- Composants à réutiliser : `Button`, `Card`, `Badge`, `Input`, `SegmentedControl`, `BottomSheet`, `EmptyState`, `Rangee`, `OutfitComposition` (hero, planche, éditoriale, compact), `AppHeader`, `BoutonRetour`, `FilEtapes`.

### Navigation
- Une seule page, navigation par état (pas d'URL). Barre du bas à **cinq onglets** : Aujourd'hui · Dressing · Capsule · Journal · Planifier.
- Le calendrier s'ouvre par l'icône du bandeau d'accueil (pas un onglet). La tenue du jour détaillée est une page de détail, pas un onglet.
- Les parcours guidés (Planifier, Valise, Ajouter une pièce, Premium) masquent la barre et posent leur action principale en pied d'écran.

### Règles de contenu
- **Aucune donnée inventée** : une section sans donnée ne s'affiche pas ; pas de « 0 pièce », pas de carte vide. Toute phrase qui dit qu'une donnée « sert à » quelque chose doit être vraie dans le code.
- **Jamais de message morphologique négatif.** Interdits : cacher, dissimuler, camoufler, corriger, défaut, grossir, amincir, peu flatteur. Aucune logique fondée sur la couleur de peau, la morphologie, l'âge ou le genre apparents. La colorimétrie passe par un questionnaire sur des traits déclarés, jamais par une photo.
- Pas d'emoji dans l'interface (hors météo). Pas de mannequin ni de visuel de destination : des pièces, des matières, des objets.
- États vides, chargement et erreur prévus pour chaque écran ; l'accessibilité ne repose jamais sur la couleur seule (forme, libellé, nom accessible).
- Largeurs à tenir : 320, 390 et 430 px, sans défilement horizontal, gouttière de 24 px.

### Livrable attendu
Pour chaque écran : sa hiérarchie (surtitre, titre, chapeau, action principale), les jetons et composants utilisés, ses états (vide, chargement, erreur, rempli), et les textes exacts en français.
