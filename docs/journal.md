# Journal — refonte du 12/10/2026

Brief « Capsela — Refonte UX/UI du Journal ». L'écran existait déjà (`HistoryScreen.tsx`, refonte du 25/09/2026, tous les chiffres tirés de l'historique réel) : la refonte l'a ADAPTÉ, pas réécrit. Ordre de la page : en-tête · Ton bilan du mois · Tes chiffres clés · Ton dressing en chiffres · Tes pièces fétiches (saison) · À sortir du placard · À envisager de vendre · Mes avis de styliste · Tes dernières tenues.

## Ce qui a changé
- **Ton bilan du mois** : la carte « Ton style ce mois-ci » (`styleDuMois`) est montée en tête et renommée. L'insight est DÉTERMINISTE (occasion dominante des tenues du mois, seuil de 3 tenues) ; sous le seuil, une carte neutre le dit. Aucun appel IA.
- **Tes chiffres clés** : sélecteur « Ce mois-ci / 3 derniers mois / Toute la période » et trois indicateurs calculés par `chiffresPeriode` (`selectors.ts`, testé) : tenues portées, pièces utilisées, part du dressing. Définitions : une tenue portée = une entrée d'historique (validée par la personne) ; pièces utilisées = pièces du DRESSING RÉEL présentes dans une tenue de la période (une pièce ajoutée n'est pas portée ; une suggestion de la capsule n'est pas comptée) ; part = pièces utilisées / taille du dressing réel. Bornes : mois civil, « 3 mois » = le mois en cours et les deux précédents (mois entiers), heure locale de l'appareil, borne basse incluse (la tenue du 1er à 00:00 est du nouveau mois, jamais des deux). Avant, la part portait sur le pool affiché (dressing + suggestions de la capsule).
- **Ton dressing en chiffres** : anneau SVG + légende (nombre et pourcentage par catégorie, jamais la couleur seule), `repartitionDressing` : une pièce, une catégorie, la somme des parts = le total affiché ; pourcentages au plus fort reste (somme 100) ; catégorie hors taxonomie = « Autres ». Section absente si le dressing est vide.
- **À sortir du placard** : chaque carte porte « Trouver une tenue » → parcours existant « Comment porter … ? » de la pièce (`openItemOutfits`, même moteur). Le lien « Voir les idées de tenues » de la première pièce est retiré.

## Anneau interactif (15/10/2026)
Brief « Rendre le camembert du dressing interactif ». Composant `CompositionDressing` (`HistoryScreen.tsx`), état local, aucune autre section touchée.
- **Choisir une part** : sur l'arc ou sur sa ligne de légende (boutons, `aria-pressed`, Entrée/Espace) ; la même part ou « Tout le dressing » revient à la vue d'ensemble. Arc choisi : 16 → 22 px ; les autres à 32 % d'opacité ; ligne de légende en gras sur fond sable, les autres atténuées. Centre : nombre et libellé de la part (« 5 / Haut »), sinon le total.
- **Détail** sous l'anneau (`detailPartDressing`, testé) : libellé pluriel de la taxonomie (« Hauts »), « 5 pièces · 26 % du dressing », « Voir les pièces », « Tout le dressing ». Mêmes parts que l'arc et la légende : aucun second calcul.
- **Voir les pièces** : `goWardrobePieces(filtrePourPart(part))` — la catégorie exacte, `retour: "journal"` (flèche « Revenir au Journal »). Les puces du Dressing regroupent des catégories (« Hauts & mailles ») : une catégorie portée seule par une puce l'active (Jupes, Chaussures, Sacs) ; sinon elle s'applique comme le filtre par teinte, avec son libellé et « Tout afficher » (`categoriesHorsPuces`, testé). « Autres » n'a pas de filtre : pas d'action.
- **Animations** : 200 ms (arc, légende, fondu du détail), coupées par `prefers-reduced-motion`. Clavier : l'arc atteint s'épaissit (un contour encadrerait l'anneau entier).
- **Vérifié en rendu réel** (mode démo, 19 pièces, 7 catégories) à 320, 390 et 1 280 px : chaque arc et chaque ligne choisissent la même part, centre et détail justes, double clic et « Tout le dressing » réinitialisent, Dressing filtré (Hauts : 5 pièces ; Jupes : la puce), retour au Journal, aucun débordement horizontal.
- **Limites connues** : à 320 px, un libellé long de la légende est tronqué (comme avant), le centre et le détail le donnent en entier ; au retour du Dressing, le Journal reprend en haut et sans part choisie.

## Une seule période (15/10/2026, brief « Optimisation UX du Journal »)
**Cause de l'incohérence (DÉMONTRÉ dans le code)** : le titre « 31 tenues portées » comptait TOUT l'historique (`entries.length`), le bilan et les chiffres clés le MOIS en cours (« 4 tenues »). Seconde contradiction : la phrase d'en-tête lisait `journalInsights.topOccasion`, qui prend la première occasion même à égalité (« surtout accompagné ton quotidien »), au-dessus d'un bilan `styleDuMois` à égalité (« aucune occasion ne se détache »).

**Règles retenues**
- Un seul sélecteur (« Ce mois-ci », « 3 derniers mois », « Toute la période »), placé sous l'en-tête : il pilote le titre, la phrase, le bilan et les chiffres clés. Bornes : `debutPeriode` (mois civils, heure locale de l'appareil, borne basse incluse), inchangées.
- Titre : tenues de la période (`chiffresPeriode.tenues`). Le total historique n'apparaît que nommé (« Depuis le début : 31 tenues portées »), et seulement s'il diffère.
- Bilan et phrase d'en-tête : `styleDePeriode` (les règles de `styleDuMois` sur la période) — sous 3 tenues « Ton style se dessine », égalité en tête « Des occasions variées », sans occasion notée « Des tenues sans occasion notée », tendance : l'occasion, « domine » au-delà de la moitié, « arrive en tête » sinon (`titreStyle`, avec la période).
- Chiffres clés : tenues ; pièces DISTINCTES du dressing réel portées au moins une fois, « 7 / 19 » ; part = distinctes / taille du dressing (7/19 = 36,8 → 37 %). Zéro pièce : « Aucune des 19 pièces de ton dressing n'a été portée ce mois-ci », pas « 0 pièce… soit 0 % ».
- Les pièces fétiches gardent leur propre période (arbitrage du 14/10).

**Vérifié** : tests (31 tenues en tout, 4 en octobre, égalité en tête ; 7/19 = 37 %), rendu réel en démo à 320 et 390 px pour les trois périodes, aucun débordement.

## Ce qui n'a PAS été fait, et pourquoi
- **Pièces fétiches sur la période choisie** : elles restent PAR SAISON (demandé par la propriétaire le 26/09/2026, « par saison et non de manière générale »). Le brief les voulait sur la période sélectionnée : conflit à arbitrer (ARBITRAGE ÉDITORIAL ouvert).
- **Répartition par saison, couleur, style** : non montrée. Saison (`saisons`, migration 0040) et couleur existent mais le « style » d'une pièce n'est pas une donnée de pièce ; rien n'a été calculé à moitié.
- **Conseils de styliste** (`AvisEnregistresJournal`) et **dernières tenues** (filtre par occasion, regroupement par période, détail) : conservés tels quels, déjà conformes (filtre limité aux occasions présentes dans l'historique, agit sur la liste).
- **Pièce « jamais portée » vs « port non enregistré »** : le Journal ne sait que ce que l'historique contient ; la distinction n'est pas démontrable avec les données actuelles.
- Aucune migration, aucune requête de plus : tout vient de l'état déjà chargé par le store.

## Revue du 12/10/2026 — fiabilité de « À sortir du placard »
Une pièce sans port dans l'historique était présentée « jamais portée » même ajoutée la veille, ou même marquée portée (`Item.worn`) hors d'une tenue validée. `peutEtreDiteJamaisPortee` (`selectors.ts`, testé) l'écarte du placard : ajout de moins de 30 jours (seuil de présence existant), ou `worn` renseigné. Une pièce sans date d'ajout reste admise. NON RÉSOLU : l'historique ne contient que les tenues validées, « aucun port enregistré » ne prouve donc pas « jamais portée » ; distinguer « confirmée portée / sans port enregistré / jamais portée » demanderait de collecter l'information (par exemple une question à l'ajout d'une pièce déjà possédée) — évolution produit, non faite.
Rappel : les bornes de période suivent le fuseau de l'appareil (`new Date(an, mois, 1)`), qui gère les changements d'heure ; pour une utilisatrice en France, c'est l'heure française. Rendu sur appareil réel et données de production : non vérifiés.

## 15/10/2026 — rapprochement de la maquette

- **En-tête** : la période passe dans un menu à droite du titre (« Octobre 2026 », « 3 derniers mois », « Depuis le début »). C'est le
  seul sélecteur de période : les pastilles reprises de la maquette sous « Tes chiffres clés » ont été retirées le même jour (redondantes).
- **Bilan** : plus de surtitre (il reste le nom de la section pour le lecteur d'écran). Hors tendance, la carte a une pastille de
  calendrier à gauche ; à égalité, son titre nomme la période (« Un mois aux occasions variées »).
- **Chiffres clés** : l'anneau à gauche, puis tenues et pièces utilisées, chacun avec sa pastille d'icône ; la phrase qui dit les
  chiffres passe dans la carte, derrière une ampoule.
- **Dressing en chiffres** : un chevron mène au Dressing. La légende sur deux colonnes de la maquette a été essayée puis écartée
  (libellés tronqués à 390 px, illisibles à 320 px).
- **Pièces fétiches** : une carte sable par pièce. Le sélecteur de période des fétiches est gardé (demandé le 14/10/2026) ; pas de
  chevron, faute d'écran qui liste toutes les pièces fétiches.
- **Non repris** : le visuel éditorial (sac et lunettes) de la carte du bilan, aucun visuel existant ne correspondant ; la phrase
  d'en-tête de la maquette (« … pour ton quotidien »), qui affirmerait une occasion que les données ne portent pas à égalité.

## 16/10/2026 — moteur de commentaires éditoriaux

Spécification « Moteur de commentaires éditoriaux du Journal » et arbitrages produit du même jour. Le commentaire de la carte (et la
phrase d'en-tête) vient de `commentaireJournal` (`src/lib/commentaireJournal.ts`, fonction pure, testée) ; les mots, de
`OCCASIONS_EDITORIALES` et `TEXTES_JOURNAL` (`src/lib/occasionEditoriale.ts`). Il remplace `styleDePeriode` et `titreStyle`.

- **Données** : les tenues de `state.history` sur la période choisie — une entrée n'existe que pour une tenue validée « je la porte ».
  Une tenue sans occasion compte dans le total, dans aucune occasion ; les parts se calculent sur ce total.
- **Seuils** (`SEUILS_COMMENTAIRE`, ARBITRAGE ÉDITORIAL à valider sur données réelles) : 5 tenues pour une observation, 10 pour
  désigner une occasion ; dominante à 40 % et 15 points d'avance ; équilibre à 5 points d'écart ou moins ; diversité à 4 occasions.
- **Ordre** : vide → secours (aucune occasion renseignée) → moins de 5 → moins de 10 → égalité à trois ou plus (diversifiée) → égalité
  à deux (équilibrée) → écart de 5 points ou moins (équilibrée, deux occasions au moins) → dominante → quatre occasions ou plus
  (diversifiée) → en tête. Les seuils sont atteints « au moins » (40 % exactement est dominant). À égalité, l'ordre du référentiel
  `OCCASIONS` départage le classement, jamais le commentaire.
- **Carte** : une occasion désignée (dominante ou en tête) garde la carte magazine — badge, titre, « 14 / 35 », visuel, barre,
  description, bouton rédigé par occasion ; les autres états gardent la carte simple à pastille calendrier.
- **Bouton** : il ouvre « Tout mon journal » filtré sur l'occasion ET la période du Journal ; une mention « Octobre 2026 · Tout
  afficher » (le mois du menu) retire la période, l'occasion restant filtrée (`filtrerListeJournal`).
- **Écarts assumés** : « Prête à bouger avec style » (Voyage) devient « Le style en mouvement », neutre en genre. L'équilibre à 5 points
  exige deux occasions représentées : une seule occasion, très minoritaire face à des tenues sans occasion, n'est pas « un équilibre
  entre plusieurs occasions ». Le secours passe avant les seuils de volume : sans aucune occasion, rien ne se dit sur elles.
