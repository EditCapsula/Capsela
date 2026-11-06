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

## Pendant le séjour

La tenue du jour vient de la valise (valiseDuJour.ts). Un look qui porte une pièce réservée n'est la tenue du jour que **le jour où
le programme prévoit son activité** (plage, piscine, spa, randonnée ; arbitré le 06/11/2026). Jamais les autres jours, jamais dans
« Autre tenue », et jamais hors séjour : tenue du jour, tenues planifiées et idées passent par la capsule, qui les écarte.

## Limites

- Un seul modèle par style : la morphologie ne départage pas ces pièces ; la couleur de la palette, quand elle existe, si.
- À lancer **après** la mise en ligne du code : avant, ces pièces entreraient dans les capsules.

## Piste à instruire (06/11/2026, proposée par la propriétaire)

« Autre tenue » sur les slides du carrousel d'un séjour (désactivé depuis le 06/11/2026, slidesDuSejour) : recomposer un look pour la
même activité, en ne piochant que dans les pièces de la valise (le vivier de la tenue du jour pendant un séjour,
piecesDeLaValisePourLeJour) — deux hauts et deux bas, ou une robe, suffisent à varier. Quota (arbitré le 06/11/2026) : le même que
« Autre tenue », 2 par jour sans abonnement, aucun pour Premium (déjà le cas). La valise deviendra une fonctionnalité Premium : le
quota ne s'y appliquera alors plus, de fait.

## Chaussures de randonnée (06/11/2026)

Demandé : « Pour des randos dans les tenues vacances il faut intégrer une paire de chaussures de randonnée pour femme et homme. »
Une paire par genre, sans style (`docs/capsules/valise/chaussures-de-randonnee.sql`), sous_type « Chaussures de randonnée »,
réservée à la valise. `chaussuresDeRandonnee` choisit celle du genre du profil (jamais l'autre) ; `piecesPourLaSituation` ne la
donne qu'aux journées de randonnée ; `poolDeRandonnee` en fait la seule chaussure de ces journées. Pour le moteur, une chaussure de
sport (Baskets). Les affaires de voyage ne redemandent plus « Chaussures de randonnée » quand la paire est dans la valise (ni
« Maillot de bain » quand le maillot ou le short de bain y est).
