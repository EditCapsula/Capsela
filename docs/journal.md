# Journal — refonte du 12/10/2026

Brief « Capsela — Refonte UX/UI du Journal ». L'écran existait déjà (`HistoryScreen.tsx`, refonte du 25/09/2026, tous les chiffres tirés de l'historique réel) : la refonte l'a ADAPTÉ, pas réécrit. Ordre de la page : en-tête · Ton bilan du mois · Tes chiffres clés · Ton dressing en chiffres · Tes pièces fétiches (saison) · À sortir du placard · À envisager de vendre · Mes avis de styliste · Tes dernières tenues.

## Ce qui a changé
- **Ton bilan du mois** : la carte « Ton style ce mois-ci » (`styleDuMois`) est montée en tête et renommée. L'insight est DÉTERMINISTE (occasion dominante des tenues du mois, seuil de 3 tenues) ; sous le seuil, une carte neutre le dit. Aucun appel IA.
- **Tes chiffres clés** : sélecteur « Ce mois-ci / 3 derniers mois / Toute la période » et trois indicateurs calculés par `chiffresPeriode` (`selectors.ts`, testé) : tenues portées, pièces utilisées, part du dressing. Définitions : une tenue portée = une entrée d'historique (validée par la personne) ; pièces utilisées = pièces du DRESSING RÉEL présentes dans une tenue de la période (une pièce ajoutée n'est pas portée ; une suggestion de la capsule n'est pas comptée) ; part = pièces utilisées / taille du dressing réel. Bornes : mois civil, « 3 mois » = le mois en cours et les deux précédents (mois entiers), heure locale de l'appareil, borne basse incluse (la tenue du 1er à 00:00 est du nouveau mois, jamais des deux). Avant, la part portait sur le pool affiché (dressing + suggestions de la capsule).
- **Ton dressing en chiffres** : anneau SVG + légende (nombre et pourcentage par catégorie, jamais la couleur seule), `repartitionDressing` : une pièce, une catégorie, la somme des parts = le total affiché ; pourcentages au plus fort reste (somme 100) ; catégorie hors taxonomie = « Autres ». Section absente si le dressing est vide.
- **À sortir du placard** : chaque carte porte « Trouver une tenue » → parcours existant « Comment porter … ? » de la pièce (`openItemOutfits`, même moteur). Le lien « Voir les idées de tenues » de la première pièce est retiré.

## Ce qui n'a PAS été fait, et pourquoi
- **Pièces fétiches sur la période choisie** : elles restent PAR SAISON (demandé par la propriétaire le 26/09/2026, « par saison et non de manière générale »). Le brief les voulait sur la période sélectionnée : conflit à arbitrer (ARBITRAGE ÉDITORIAL ouvert).
- **Répartition par saison, couleur, style** : non montrée. Saison (`saisons`, migration 0040) et couleur existent mais le « style » d'une pièce n'est pas une donnée de pièce ; rien n'a été calculé à moitié.
- **Conseils de styliste** (`AvisEnregistresJournal`) et **dernières tenues** (filtre par occasion, regroupement par période, détail) : conservés tels quels, déjà conformes (filtre limité aux occasions présentes dans l'historique, agit sur la liste).
- **Pièce « jamais portée » vs « port non enregistré »** : le Journal ne sait que ce que l'historique contient ; la distinction n'est pas démontrable avec les données actuelles.
- Aucune migration, aucune requête de plus : tout vient de l'état déjà chargé par le store.
