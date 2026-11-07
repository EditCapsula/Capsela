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

### Randonnées sans look, trajets (06/11/2026)

Signalé sur une valise pour le Cap-Vert : deux journées de randonnée « Aucun look de ta valise ne répond encore à cette occasion », et
un look Voyage · trajet avec un blazer du dressing (« Il faut que ce soit plus décontracté »).

- **Cause des randonnées sans look** (DÉMONTRÉ, test du même jour, même pool, seul ce levier changé) : les deux paires avaient été
  créées en niveau « décontracté » ; une randonnée passe par les règles Sport du moteur, qui n'admettent que des chaussures de niveau
  sport. 0 look sur 20 en « décontracté », 20 sur 20 en « sport ». Correction des données :
  `docs/capsules/valise/chaussures-de-randonnee-niveau-sport.sql` (deux lignes, une colonne), à lancer à la main.
- **Randonnée sans tenue de sport** : le moteur Sport demande aussi des vêtements et un sac de sport. Quand la valise n'en a pas, la
  randonnée reçoit une tenue de marche décontractée (Quotidien, contrainte « marche »), toujours avec la paire de randonnée, dite
  élargie (`generateurMoteur`). La tenue de sport reste le premier choix.
- **Les trajets d'un séjour avec randonnée portent la paire** (demandé : « pour les trajets aller et retour pour limiter le poids dans
  la valise ») : `situationsDuProgramme` marque ces trajets (`avecRandonnee`), `piecesPourLaSituation` et `poolDeRandonnee` leur
  donnent la paire comme seule chaussure. Une valise enregistrée avant n'a pas la marque : elle la reçoit quand elle est refaite.
- **Trajets et randonnées en tenue décontractée** (`poolDecontracte`) : jamais de blazer (exclu) ; une pièce business casual ou
  habillée sort de sa catégorie quand il y reste une pièce décontractée — privilégier, pas exclure. ARBITRAGE ÉDITORIAL, à confirmer
  sur de vrais voyages ; instruit sur le trajet et la randonnée seulement.

### Talons, visites, paire de randonnée hors randonnée (06/11/2026)

- **Plage et piscine : jamais de talons** (signalé : des slingbacks à talons pour la plage). `aTalon` (`programmeValise.ts`) :
  escarpins, sandales à talons, slingbacks, ou un talon écrit dans le nom ; la contrainte « chaleur » les écarte.
- **Visites, balade, excursion** (rappelé : « en fonction de la température une paire de baskets, une paire de sandales sans talons
  si la marche n'est pas longue ou des chaussures de randonnées si elles sont bien dans la valise ») : la règle des chaussures de marche
  reste celle de la saison du jour (baskets, bottines ; bottes au froid ; sandales au chaud), et une sandale « à talon » dans son nom
  sort désormais. La longueur de la marche n'est pas connue de l'app : rien n'en est déduit (NON DÉMONTRÉ qu'il faille distinguer
  visites et excursion).
- **La paire de randonnée hors randonnée** (précisé le même jour : « peut être proposée lors d'un trajet, lors de balades longues,
  lors d'activités entraînant beaucoup de marche, sans tenue de sport et avec une tenue ordinaire », puis : « ne doit pas être
  proposée dans une valise si le séjour n'inclut pas une activité de randonnée ») : seulement dans un séjour qui compte une randonnée,
  les trajets et journées de marche (visites, balade, excursion) la reçoivent (`avecRandonnee`, `estJourneeDeMarche`), parmi les
  autres chaussures ; le trajet la porte d'office. Sans randonnée au programme, la paire n'entre dans aucun look ni aucune valise.
- **Jours sans activité** : aucun look n'y est ajouté (arbitré le 06/11/2026 : « Non »).
- **La paire de randonnée sans tenue de sport hors randonnée** (demandé le même jour) : aux trajets et aux journées de marche, un
  vêtement de sport sort de sa catégorie quand il y reste un vêtement ordinaire (`sansTenueDeSport`).

### Le spa sans look (07/11/2026)

Signalé : les journées « Spa · détente » d'une valise pour Pékin, toujours « Aucun look ». Cause (DÉMONTRÉ, 0 look sur 20, avec ou
sans maillot) : le spa passe par Cocooning, où le moteur refuse tout sac (R-B14) et n'admet que des chaussures d'intérieur (R-B13) ;
la valise exigeait pourtant un sac dans chaque look. Correctif : `completerChaussuresEtSac` n'ajoute pas de sac à un look « chez soi »,
et `lookAChaussuresEtSac` accepte un look sans sac quand ses chaussures sont des chaussures d'intérieur (20 sur 20 après). Sans
chaussures d'intérieur dans la valise ni la capsule, le spa reste sans look : la règle R-B13 n'est pas touchée.
