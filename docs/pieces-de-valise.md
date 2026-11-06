# Les pièces réservées à la valise

Mises en place le 06/11/2026 (demandé : « pour la valise seulement, on crée des pièces pour couvrir toutes les occasions, mais ces
pièces ne sont visibles que dans la valise et propres à chaque style » ; périmètre et tableau validés le même jour).

## Ce qui est couvert

- **Plage, piscine** (rattachées à Quotidien) : un maillot une pièce et une surchemise de plage (femme), un short de bain et une
  chemise de plage (homme).
- **Spa** (rattaché à Cocooning) : le maillot ou le short de bain ; chaussures d'intérieur (R-B13), sans surchemise.
- **Mariage, cérémonie** : pas de pièce réservée. Sans tenue, la valise le dit : « Ton dressing n'a pas encore de tenue pour un mariage
  ou une cérémonie. »
- Un modèle par style et par genre (9 styles femme, 7 homme) : 32 pièces, `docs/capsules/valise/pieces-de-baignade.sql`.
- Saisons : maillot et short de bain toute l'année (spa, piscine couverte) ; surchemise et chemise de plage au printemps et en été.

## Fonctionnement (`src/lib/piecesDeValise.ts`)

- Reconnues par leur `sous_type` (Maillot de bain, Short de bain, Surchemise de plage, Chemise de plage, Kimono de plage) : aucune
  colonne, aucune migration.
- Dans le catalogue chargé (une valise enregistrée les retrouve), mais **jamais dans une capsule** : `computeDefaultCapsule` les écarte
  à la source. Ni Capsule, ni Explorer, ni tenue du jour, ni idées.
- La valise choisit celles du profil (`piecesDeBaignade` : le style du profil, la pièce la plus spécifique, puis une couleur de la
  palette ; jamais l'autre genre), les ajoute à la capsule du séjour quand il compte plage, piscine ou spa, et au pool de ces seules
  situations (`generateurMoteur`).
- En baignade, la tenue de bain et sa couverture tiennent lieu de vêtements (`poolDeBaignade`) ; le moteur compose comme toujours. À
  la plage et à la piscine, la surchemise est ajoutée au maillot (`ajouterCouverture`), le moteur ne superposant pas un haut à une
  pièce entière.

## Limites

- Un seul modèle par style : la morphologie ne départage pas ces pièces ; la couleur de la palette, quand elle existe, si.
- À lancer **après** la mise en ligne du code : avant, ces pièces entreraient dans les capsules.
