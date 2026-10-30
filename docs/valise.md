# Capsela — Préparer sa valise

Sep 27, 2026 · @Angela

Ce document décrit « Préparer sa valise » tel qu'il est codé : le lot 1 (27/09/2026, maquette « Exploration »), puis la refonte UX/UI du même jour (maquette « Parcours Ma valise », 10 écrans), qui l'a remplacé à l'écran sans toucher au moteur. Il documente le comportement réel du code.

Les statuts reprennent la légende de `docs/avis-de-styliste.md` : **[DÉCIDÉ]**, **[RECOMMANDÉ]**, **[À ARBITRER]**, **[HYPOTHÈSE TECHNIQUE]**. Les seuils choisis sans mesure sont marqués **ARBITRAGE ÉDITORIAL**, au sens de la règle d'audit (AGENTS.md).

## 1. Principe

« Une valise. Plus de looks. Moins de pièces. » Capsela choisit **les pièces de ton dressing** à emporter, puis le moteur de tenues existant (`generateOutfitWithFallback`) compose les looks avec ces seules pièces. Il n'y a pas de second moteur : un choix de pièces, puis le moteur unique. [DÉCIDÉ]

Tout ce qui s'affiche est compté, jamais estimé : « 12 pièces → 10 looks », ce sont 10 tenues réellement produites par le moteur avec ces 12 pièces. La formule combinatoire « N looks possibles » a été retirée de Capsule le 22/09/2026 (erreur de ×0,5 à ×1,7) et n'est pas réintroduite. [DÉCIDÉ]

## 2. Parcours

Quatre questions, puis la génération et le résultat. Aucune cinquième question (brief de refonte). [DÉCIDÉ]

| Écran | Contenu |
| --- | --- |
| 1 / 4 — Où pars-tu ? | Ville (autocomplétion de Planifier), « Tes lieux planifiés » (villes de tes tenues planifiées), dates départ et retour dans un seul calendrier (20/10/2026 : premier toucher le départ, second le retour, `calendrierPeriode.ts`), « 9 jours · 8 nuits ». Séjour de 21 jours au plus. Si la prévision couvre le départ : « Berlin · 17° – 18° prévus » et un conseil (section 5) |
| 2 / 4 — Quelle valise prends-tu ? | Grille 2 × 2, S / M / L / XL, capacité (section 3). Le glyphe valise de l'accueil grandit avec la taille |
| 3 / 4 — Quel type de séjour ? | Cartes à visuel éditorial (10 types) et « Autre ». Présélectionne les occasions de l'écran 4 (section 4) |
| 4 / 4 — Qu'est-ce qui est prévu ? | Occasions avec leurs glyphes, plusieurs choix. « Capsela a déjà préparé une première sélection selon ton séjour. Tu peux la modifier. » « Passer cette étape » garde la présélection, sinon « Quotidien » |
| Génération | « Je prépare ta valise… » et quatre étapes cochées quand elles sont faites (section 6) |
| Ta valise est prête | Période, durée, météo prévue s'il y en a ; « Une sélection pensée pour ton séjour, ta météo et ton dressing. » ; pièces → looks → occasions couvertes ; « Uniquement ton dressing » ; onglets **Looks** (par défaut) et **Pièces** ; « Ajuster ma valise », « Nouvelle valise » |
| Détail d'un look | Nom fait de ses pièces, occasions en métadonnées, composition éditoriale, navigation 1 / N, pièces du look (« Dans N looks »), « Enregistrer dans mes looks » |
| Détail d'une pièce | Visuel, nom, « Dans N looks », aperçus des looks où elle figure, occasions couvertes, « Remplacer », « Retirer de la valise » |

Entrée : « Préparer une valise » sur l'Accueil, selon la règle d'accès `PREPARER_VALISE` (section 9).

### Écarts assumés avec la maquette — une donnée qui n'existe pas ne s'affiche pas

- **Noms de looks** (« City day », « Dîner en ville ») : aucune donnée ne les fournit. Un look porte le nom de ce qu'il contient (`resumeLook` : « Chemise · jean · sandales · sac ») et ses occasions en métadonnées, jamais sur le visuel. [DÉCIDÉ]
- **« Pourquoi cette pièce ? »** : aucun système de justification stylistique n'existe. Le détail dit ce qui est compté : le nombre de looks, les occasions couvertes. [DÉCIDÉ]
- **Cœur** : l'action réelle est « Enregistrer dans mes looks » (`enregistrerIdeeLook`, sans doublon). [DÉCIDÉ]
- **Interrupteur « Uniquement ton dressing »** : il n'existe pas d'autre source. La ligne l'affirme, sans bascule. [DÉCIDÉ]
- **Photos de valises et illustration de chargement** : aucun visuel de ce type dans le projet ; le glyphe valise existant en tient lieu. [DÉCIDÉ]
- **Lieux favoris** : l'app n'en enregistre aucun ; « Tes lieux planifiés » les remplace. [DÉCIDÉ]
- **Visuels « look » fournis** (`11_look_work_city`, `12_look_casual_city`) : non utilisés, ce ne sont pas les pièces de l'utilisatrice. [DÉCIDÉ]

### Ce que la refonte a retiré du lot 2 non publié

Le lot 2 (question du transport, tenue de trajet hors capacité, onglets Trajet et Checklist) n'a jamais été mis en production. Le brief de refonte fixe 4 questions et deux onglets : ces éléments sont retirés. Restent du lot 2 : l'enregistrement dans le compte, « Remplacer », « Ajouter une pièce » et « Optimiser ». [DÉCIDÉ]

## 3. Capacité par valise

**Révisé le 09/10/2026** (demandé : « est-ce que tu te bases sur de vraies estimations ? ») : la capacité n'est plus un nombre de pièces mais un **volume**, en unités d'encombrement (un t-shirt plié = 1). Le barème et les capacités sont un **ARBITRAGE ÉDITORIAL** validé le 09/10/2026 : des ordres de grandeur, ni mesurés ni pesés. [DÉCIDÉ]

| Taille | Libellé | Capacité (unités) | L'écran dit |
| --- | --- | --- | --- |
| S | Cabine souple | 14 | environ 8 pièces |
| M | Cabine | 22 | environ 12 pièces |
| L | Grande valise | 32 | environ 18 pièces |
| XL | Très grande valise | 44 | environ 24 pièces |

| Catégorie | Unités |
| --- | --- |
| Bijou | 0,25 |
| Accessoire | 0,5 |
| Haut, short, jupe | 1 |
| Robe, combinaison | 1,5 |
| Pantalon, jean, pull, sac | 2 |
| Veste / blazer | 2,5 |
| Chaussures | 3 |
| Manteau | 4 |

Le « environ N pièces » suppose 1,8 unité par pièce en moyenne : il n'est qu'un affichage. Le moteur remplit le volume ; ses ratios « looks par pièce » restent comptés en pièces. Chaussures, sacs et accessoires comptés ; ne dépend que de la taille (ni durée, ni saison, ni transport). Un vêtement porté pour le trajet compte quand même : l'app ne sait pas ce qui est porté.

La capacité est un plafond, pas un objectif : le résultat met en avant « pièces → looks » et dit en second le remplissage (« 9 pièces · remplie à 65 % »). [DÉCIDÉ]

**Cible « prête »** (04/10/2026, révisée le 09/10/2026) : une valise n'est « prête » qu'avec au moins un look par occasion demandée ET 70 % de son volume atteint (S 10, M 16, L 23, XL 31 unités), sans dépasser le plafond. Sinon, « Ta valise à compléter », et l'écran dit environ combien de pièces manquent. **Le 70 % est une proposition, à confirmer : ARBITRAGE ÉDITORIAL.**

## 4. Type de séjour → occasions présélectionnées

| Séjour | Occasions présélectionnées |
| --- | --- |
| Plage / resort | Quotidien, Sortie / Soirée |
| City break | Quotidien, Sortie / Soirée |
| Nature / randonnée | Quotidien, Sport |
| Week-end | Quotidien, Sortie / Soirée |
| Professionnel | Travail / Bureau |
| Road trip | Quotidien |
| Événement | Événement / Cérémonie, Quotidien |
| Montagne / ski | Quotidien, Sport, Cocooning |
| Détente | Quotidien, Cocooning |
| Multi-activités | Quotidien, Sport, Sortie / Soirée |
| Autre | aucune |

Le type de séjour n'entre pas dans le moteur, qui ne connaît que des occasions. **ARBITRAGE ÉDITORIAL**, instruit type par type. [DÉCIDÉ]

Visuels : `public/editorial/sejours/sejour_<type>.webp`, fournis le 27/09/2026 (unisexes, sans texte intégré), réencodés en 600 × 800. [DÉCIDÉ]

## 5. Météo

- Prévision du lieu (`fetchPrevisionByCity`) pour chaque jour qu'elle couvre (4 jours), en « Toute la journée ». Demandée dès l'écran 1 quand le départ est dans l'horizon, et réutilisée par la génération.
- Au-delà, la règle de Planifier : **saison de la date, température d'aujourd'hui**, et l'écran le dit.
- Résumé de l'écran 1 : seulement si au moins un jour est prévu. Conseil (`conseilMeteo`, **ARBITRAGE ÉDITORIAL**) : moins de 8° « Temps froid, prévois des pièces chaudes. » ; moins de 15° « Temps frais, prévois des couches. » ; minimum ≥ 23° « Temps chaud, privilégie les matières légères. » ; sinon « Températures douces, prévois des couches légères. » ; « De la pluie est prévue. » si c'est le cas. [DÉCIDÉ]

## 6. Génération

Quatre étapes, chacune cochée quand elle est faite : la météo (prévision ou règle de repli), le programme (situations occasion × météo), la sélection dans le dressing et l'optimisation (`composerValise`). Le calcul prend une fraction de seconde : chaque étape reste affichée un court instant (≈ 1,5 s au total) pour être lue. Rien n'est simulé. [DÉCIDÉ]

## 7. Choix des pièces (`src/lib/valise.ts`, testé)

1. **Situations** : une occasion sous une météo. Les jours de même météo (même saison, température à 3° près, même condition) ne font qu'une situation par occasion.
2. **Tirages** : 10 tenues du moteur par situation, dans le dressing entier. Deux tenues qui ne diffèrent que par un accessoire sont le même look.
3. **Couvrir** : tant qu'une situation n'a pas de look, la tenue qui en couvre une en ajoutant le moins de pièces. Jamais au-delà de la capacité ; une situation qui n'y tient pas reste sans look, et l'écran le dit.
4. **Alléger** : retirer toute pièce dont l'absence garde chaque situation couverte et ne coûte pas plus d'un look.
5. **Enrichir** : tant qu'il y a moins d'un look par jour, ajouter ce qui rapporte au moins un look par pièce ajoutée ; au-delà, seulement ce qui en rapporte au moins deux.
6. **Looks finaux** : nouveaux tirages du moteur sur les seules pièces choisies. Une pièce dans aucun look final est laissée au placard.

Seuils : **ARBITRAGE ÉDITORIAL**, à revoir sur des dressings réels. Une tenue dont le moteur a dû élargir l'occasion le dit (« Occasion élargie »). [DÉCIDÉ]

## 8. Ajuster la valise

« Ajuster ma valise » ouvre trois choix, tous déjà codés :

- **Retirer / remplacer une pièce** (onglet Pièces, ou détail de la pièce). Remplacer propose les pièces du même groupe absentes de la valise, chacune avec le nombre de looks que la valise aurait — compté par le moteur (`alternatives`).
- **Ajouter une pièce de ton dressing** : les looks sont recomposés avec elle. Au-delà de la capacité, l'onglet Pièces propose « On allège un peu ? » et « Optimiser » (`allegement` : retirer d'abord ce qui sert le moins).
- **Modifier le séjour** : retour aux quatre questions, réponses préremplies.

Chaque changement recompte les looks (`looksDeLaValise`). [DÉCIDÉ]

## 8 ter. Le minimum pour préparer une valise (27/09/2026)

Pour une **nouvelle** valise, le dressing doit contenir de quoi remplir la plus petite : **autant de pièces que la capacité d'une valise S (8)** et **la base d'une tenue** — un haut et un bas, ou une robe / une combinaison, et des chaussures (`pretPourUneValise`, testé, règle d'`isCompleteOutfit`). En dessous, les questions ne s'ouvrent pas : écran « Ton dressing d'abord », « 6 / 8 pièces · encore 2 pièces », la base qui manque en boutons (« + des chaussures », ajout sur cette catégorie), et « Ajouter une pièce » ; l'ajout revient à la valise. Une valise existante reste consultable et modifiable. Seuil : **demandé par la propriétaire**. [DÉCIDÉ]

## 8 bis. Inciter à compléter le dressing (27/09/2026)

La valise ne puise que dans le dressing : quand il la limite, l'écran le dit et mène à l'ajout. [DÉCIDÉ]

- **Écran 1** : « Ta valise sera composée avec les N pièces de ton dressing : plus il est complet, plus elle aura de looks. Ajouter des pièces ».
- **Résultat — « Complète ton dressing »**, seulement sur un manque réel :
  - une occasion **sans look**, ou couverte seulement par des looks **« élargis »** (pièces pensées pour d'autres occasions) ;
  - **moins de looks que de jours** (« 3 looks pour 7 jours : quelques pièces de plus varieraient tes tenues »).
- **Ce qui manque est dit par le moteur, pas inventé** (`categoriesPourCompleter`, testé) : pour chaque occasion concernée, le moteur compose le look dans le pool habituel de l'app (`composeWardrobePool` : la capsule complète le dressing) ; les catégories des pièces venues de la capsule sont ce qui manque (« il te manque [pantalon] [veste] »), chacune un bouton qui ouvre l'ajout sur cette catégorie. Si le dressing suffit, c'est la place qui a manqué, et l'écran le dit.
- **Retour de l'ajout** : l'ajout revient à la valise (`openAddForCategory`, `openAddEtRevenir`). Une pièce ajoutée depuis le calcul se reconnaît (`dressingIds`, gardé dans `calcul`) : « Une nouvelle pièce dans ton dressing · Recomposer ma valise », qui relance le calcul avec les mêmes réponses, sur la même valise.
- **Onglet Pièces** : « Une pièce qui n'est pas encore dans ton dressing ? L'ajouter à mon dressing », distinct de « Ajouter une pièce de ton dressing » (qui met une pièce du dressing dans la valise).

## 8 quinquies. Refonte « Préparer ma valise V2 » — phase 1, le parcours (11/10/2026)

Demandé : « il faut suivre les maquettes » (maquette « Capsela — Préparer ma valise V2 », 19 états). Livré en phases ; la phase 1 est le PARCOURS.

- **Trois étapes au lieu de cinq** : « Ton voyage » (destination et dates), « Quelle valise emportes-tu ? », « Quel est l'esprit de ton séjour ? ». Le type de séjour, l'écran du programme (fréquences) et la synthèse sont retirés du parcours.
- **Étape 2** : « 8 / 12 / 18 / 24 pièces » et l'usage de chaque valise (week-end, semaine, long, très long séjour), « Conseillée » selon la durée (`bagageConseille` : ≤ 3 jours S, ≤ 8 M, ≤ 15 L, au-delà XL — ARBITRAGE ÉDITORIAL).
- **Étape 3** : neuf activités (Plage, Ville, Nature, Randonnée — ajoutée le 19/10/2026 ; Nature garde la balade, la randonnée et ses chaussures ne viennent que de Randonnée —, Détente, Soirée, Travail, Sport, Événement spécial), autant que voulu (la limite de quatre est retirée le 19/10/2026, demandé : « on peut tout sélectionner si besoin »). **Elles pilotent toujours le moteur** : `programmeDesActivites` les traduit en entrées du programme (donc en occasions mères) avec le trajet ; le planning jour par jour et les contraintes de pool de la phase B restent. Les parts des jours par activité sont un ARBITRAGE ÉDITORIAL à revoir sur de vrais voyages. Le programme n'est plus ajustable à la main dans le parcours : la personne choisit des activités, Capsela propose les fréquences.
- **Génération** en cinq étapes (« Analyse des besoins du séjour », « Sélection des pièces du dressing », « Complétion avec la capsule si nécessaire », « Composition des looks », « Vérification de la capacité de la valise »). Les deux premières correspondent à du calcul réel (météo et situations, `composerValise`), la troisième à `completerAvecCapsule` ; les deux dernières sont affichées un court instant, le calcul des looks et de la capacité étant compris dans `composerValise`.
- **Erreur** : « La préparation n'a pas abouti », réponses gardées, « Réessayer » et « Modifier mes réponses ».
- **Écarts assumés avec la maquette** : le champ « Un besoin particulier ? » n'est pas repris (aucune donnée ne l'utiliserait) ; la carte « Ta valise sera composée avec les N pièces de ton dressing » reste à l'étape 1 (chemin vers l'ajout de pièces) ; les dates restent les sélecteurs natifs ; le seuil de 8 pièces (§ 8 ter) est inchangé.
- **À venir** : phase 2, le résultat (en-tête « Ma valise », onglets Aperçu / Looks / Pièces / Checklist, collages de looks, filtres Toutes / Ton dressing / Capsule) ; phase 3, « Vérifier ma valise », « Ta valise est prête ! » et la liste des valises.

## 8 sexies. Parcours « Préparer ma valise » — intégration de la maquette V2 (11/10/2026)

Brief : intégrer les améliorations pertinentes de la maquette sans la recopier, avec les composants existants, et vérifier chaque interaction.

**Priorité dressing puis capsule, dans le moteur** (`completerAvecCapsule`, valise.ts) : le moteur compose d'abord avec le dressing seul (`composerValise`) ; une occasion est « à compléter » quand aucun look ne la couvre, ou quand tous ses looks sont ÉLARGIS. La capsule n'entre qu'à ces conditions :
- le look composé dans le pool dressing + capsule (`composeWardrobePool`, le moteur habituel) apporte au moins une pièce que le dressing n'a pas ;
- les suggestions DÉJÀ retenues pour une autre occasion sont réutilisées avant d'en ajouter une seconde (aucune redondance) ;
- le volume de la valise n'est jamais dépassé ;
- jamais plus de suggestions que la moitié des pièces possédées de la valise, arrondie au-dessus (`PLAFOND_SUGGESTIONS`, ARBITRAGE ÉDITORIAL à revoir sur des dressings réels) : la capsule complète, elle ne remplace pas le dressing.
Un dressing qui couvre tout : aucune suggestion. Ce que ni le dressing ni la capsule ne couvrent reste dit (« Optimise ta valise » : seulement les pièces pas encore dans la valise).

**Capacité** : un seul endroit, `BAGAGES` et le barème de volume (valise.ts), paramètres métier documentés au § 3 ; l'écran dit « environ N pièces », jamais une capacité universelle. Corrections : le remplacement d'une pièce est refusé quand il ferait dépasser la valise (`alternatives(…, capacite)` rend `tient: false`, la pièce est grisée avec la raison) ; le **changement de taille après génération** conserve la sélection — plus petite et dépassée, l'écran le dit et mène à « On allège un peu ? » ; plus grande, il dit qu'il reste de la place et propose de recomposer. Rien n'est retiré sans la personne. Compteurs : toujours calculés sur la sélection enregistrée.

**Résultat** : en-tête « Valise M · N pièces sélectionnées · Changer », pastilles « N pièces de ton dressing » / « N suggestions capsule », quatre vues Aperçu / Looks / Pièces / Checklist. Pièces : filtre Toutes / Ton dressing / Capsule (compteurs réels), tous les groupes (l'onglet Accessoires est fusionné), chaque suggestion marquée « Suggestion capsule · à ajouter à ton dressing ».

**Persistance** : la check-list vit désormais AVEC la valise (`cochees`, dans `calcul` jsonb : appareil et compte, aucune migration) ; l'ancienne clé de l'appareil (`capsela.valise.check.<id>`) est reprise à la première coche. Les activités (`activites`) sont gardées pour rouvrir le parcours tel qu'il a été rempli. Retirer, remplacer ou recomposer retire des coches les pièces qui ne sont plus dans la valise. Il n'y a toujours qu'une source de vérité (`state.valises`).

**Autres retouches** : dates invalides dites (« La date de départ est passée »), « Utiliser ma position actuelle » retiré du choix de destination de la valise (on part ailleurs ; l'option reste pour « Planifier une tenue »), les looks passés ne s'affichent plus sous l'onglet Valise de Planifier.

**Vérifié dans l'app (mode démo, navigateur)** : parcours de bout en bout ; retrait d'une pièce (11 → 10) ; filtre capsule ; check-list ; changement S puis XL ; rechargement (taille et coches retrouvées, sur l'appareil) ; dressing du quotidien avec activités Soirée et Événement (2 suggestions entrent, plus rien à compléter) ; dressing vide (« Ton dressing d'abord ») ; 360 et 412 px sans débordement. **NON vérifié** : la persistance dans le compte Supabase (l'API est inaccessible depuis le conteneur) ; le téléchargement de la check-list (il n'existe pas).

## 8 septies. Affaires de voyage (11/10/2026)

Demandé : « intégrer toutes les pièces liées aux vacances — chaussures de randonnée, parfum, dentifrice, crème solaire… » (et maquette V2 : « Essentiels de voyage » dans la check-list).

- **Une couche À PART des vêtements** (`affairesVoyage.ts`, pur, testé) : le moteur de tenues ne connaît que le dressing ; ces affaires n'ont ni catégorie ni volume. **Elles ne changent ni la capacité, ni « prête », ni les looks** ; l'écran le dit (« Hors vêtements : elles ne comptent pas dans la place de la valise »).
- **Essentiels** (papiers, carte bancaire, billets et réservations, brosse à dents, dentifrice, déodorant, parfum, soins habituels, médicaments personnels, chargeur) : toujours proposés.
- **Conditionnelles, chacune liée à une donnée RÉELLE du séjour, avec sa raison affichée** : crème solaire (plage ou piscine au programme, ou chaleur attendue ≥ 24°), maillot et serviette (plage, piscine), chaussures de randonnée et gourde (randonnée au programme), maillot de spa, parapluie ou imperméable (pluie dans une PRÉVISION seulement, jamais dans une météo de repli), gants et bonnet (≤ 5° attendus). Sans la donnée, l'affaire n'apparaît pas. Les températures sont celles de `valise.meteos` (prévision ou températures habituelles du lieu).
- **Valise S** : la règle générale des liquides en cabine (100 ml par contenant) est dite, à vérifier selon la compagnie ; rien pour les autres tailles (on ne sait pas si elles voyagent en soute).
- **La personne garde la main** : elle coche, masque (réversible : « Afficher les N affaires masquées ») et ajoute les siennes (sans doublon). Tout est gardé AVEC la valise (`affaires`, dans `calcul` jsonb : appareil et compte, aucune migration) ; seul ce que la personne a fait est enregistré, le catalogue est recalculé à l'affichage. Le compteur « N / M prêtes » de la check-list les inclut.
- Le catalogue et les seuils (24°, 5°) sont un **ARBITRAGE ÉDITORIAL** du 11/10/2026, à valider et compléter. Non repris : anti-moustiques, adaptateur de prise (aucune donnée de destination ne les justifie).
- **Chaussures de randonnée** : proposées comme affaire quand la randonnée est au programme ; si elles sont dans le dressing, elles entrent dans la valise comme n'importe quelle chaussure (le moteur retient baskets, bottines et bottes pour la randonnée). Un type de chaussure « randonnée » dans le dressing n'a pas été ajouté (il demanderait une valeur de plus en base).
- **Vérifié dans l'app (démo)** : essentiels, crème solaire et chaussures de randonnée avec leur raison, règle des liquides en valise S, cocher, masquer, réafficher, ajouter, doublon refusé, rechargement (tout retrouvé sur l'appareil). **NON vérifié** : l'enregistrement dans le compte.

## 8 quater. La capsule complète la valise quand le dressing ne suffit pas (11/10/2026)

Demandé : « capsule dans la valise si les pièces du dressing ne permettent pas de compléter une valise ». Arbitré en deux temps le même jour : d'abord les pièces de capsule en compléments « à ajouter » hors de la valise (option A), puis, à la demande de la propriétaire, **dans la valise, mais seulement quand le dressing ne couvre pas le séjour**. [DÉCIDÉ]

- **Déclencheur exact** (`completerAvecCapsule`, valise.ts, testé) : une occasion du séjour qu'AUCUN look du dressing ne couvre. Pour chacune, le moteur compose le look dans le pool habituel de l'app (`composeWardrobePool`, la capsule complète ce que le dressing n'a pas) ; les pièces de ce look entrent dans la valise si le volume le permet, celles de la capsule étant des SUGGESTIONS.
- **Un dressing qui couvre tout : rien n'est ajouté**, la valise reste faite de pièces possédées, et l'écran dit toujours « Uniquement ton dressing ». Si le moteur compose le look avec le dressing seul, c'est la place qui manque : rien n'est ajouté non plus.
- **Marquage.** `ValiseGardee.suggestionIds` (dans `calcul`, jsonb : aucune migration) liste les pièces de capsule ; elles sont aussi dans `pieceIds`. L'écran dit « Dont N pièces de ta capsule à ajouter à ton dressing », « Ton dressing, complété par ta capsule », et marque chaque pièce « Suggestion capsule · à ajouter à ton dressing » (onglet Pièces, check-list).
- **Comptage.** Elles comptent dans le volume (une fois ajoutées, elles prendront de la place) et dans « pièces → looks » ; l'écran les distingue dans le résumé. « Ta valise est prête » reste fondé sur les occasions couvertes et le volume, et la mention « dont N à ajouter » l'accompagne : une valise prête n'est pas dite entièrement possédée.
- **Résolution.** Les suggestions sont retrouvées par identifiant dans la capsule et le catalogue (`poolDeLaValise`) ; le moteur les voit à chaque modification (retirer, remplacer, ajouter), sinon leurs looks se perdraient. Une suggestion qui disparaîtrait du catalogue n'est plus dans la valise.
- **Reste hors de la valise** : une occasion qui ne tient pas dans la capacité garde l'encart « Optimise ta valise », avec les pièces de capsule « À ajouter » (« ne comptent ni dans ses pièces, ni dans son remplissage »).
- Le minimum de 8 pièces pour ouvrir le parcours (§ 8 ter) est inchangé. **À arbitrer** : le baisser maintenant que la capsule peut compléter.
- **NON DÉMONTRÉ** : le rendu à l'écran ; le comportement sur des dressings réels (quand une occasion reste sans look malgré la capsule).

## 9. Accès

Règle `PREPARER_VALISE` dans `REGLES_ACCES` (`src/lib/autorisations.ts`, copie serveur pour le test miroir) : **gratuite**, `ACCES_LIBRE` (décidé le 30/10/2026 : « enlève le premium de la préparation de valise » ; elle était Premium, en accès libre pendant la phase de test). Badges Premium retirés des cartes Valise de l'accueil et de Planifier, et de la liste de l'écran Premium. [DÉCIDÉ]

## 10. Conservation et « Mes planifications »

- **Plusieurs valises** (27/09/2026). Elles remontent dans « Mes planifications » de Planifier, mêlées aux tenues planifiées (`repartirPlanifications`, testé) : **à venir jusqu'à la date de retour** (pendant le séjour, c'est encore elle qu'on ouvre), puis **passées**. À venir : la plus proche d'abord ; passées : la plus récente d'abord. Chaque ligne montre ses vraies pièces, la destination, les dates et le nombre de looks. [DÉCIDÉ]
- Toucher une valise l'ouvre sur son résultat ; « retour » ramène à Planifier. La carte « Préparer ma valise » du hub ouvre le parcours (même règle d'accès que l'accueil, `ouvrirValise` dans le store). [DÉCIDÉ]
- **« Nouvelle valise »** en ajoute une : la précédente reste. **Supprimer** est une action explicite (« Ajuster ma valise » → « Supprimer cette valise », avec confirmation). « Modifier le séjour » remplace la valise modifiée, sans en créer une autre. [DÉCIDÉ]
- Toujours **sur l'appareil** (`localStorage`, clé `capsela.valises.<userId>` ; l'ancienne clé à valise unique est reprise une fois), et **dans le compte** : table `valises` (0038), plusieurs lignes par compte depuis **0039** (à exécuter à la main). Une valise créée hors ligne ou avant la migration porte un identifiant local (« local-… ») jusqu'à ce que le compte l'accepte. [DÉCIDÉ]
- L'écran dit où elle est gardée : « Enregistrée dans ton compte » ou « Enregistrée sur cet appareil seulement » (identifiant local, ou dernière écriture refusée). Avant 0039, une deuxième valise ne peut pas entrer dans le compte : elle reste sur l'appareil, et l'écran le dit. [DÉCIDÉ]

## 11. Fichiers

| Fichier | Contenu |
| --- | --- |
| `src/lib/valise.ts` | Bagages, séjours, situations, choix des pièces, looks, allègement, remplacement, occasions couvertes, `resumeLook`, `conseilMeteo` |
| `src/lib/valises.ts` | Valises enregistrées : appareil et compte, `repartirPlanifications` |
| `src/lib/__tests__/valise.test.ts`, `valises.test.ts` | Tests (générateur de test et vrai moteur à aléa fixé) |
| `src/components/screens/ValiseScreen.tsx` | Parcours, génération, résultat, détail look, détail pièce, feuilles Ajuster / Ajouter / Remplacer |
| `public/editorial/sejours/` | Visuels des types de séjour |
| `supabase/migrations/0038_valises.sql`, `0039_valises_plusieurs.sql` | Table `valises`, plusieurs valises par compte |
| `src/components/screens/PlanifierScreen.tsx` | Valises dans « Mes planifications », carte « Préparer ma valise » |
| `src/lib/autorisations.ts`, `supabase/functions/_shared/premium.ts` | Règle `PREPARER_VALISE` |

## Écran résultat — refonte du 04/10/2026

Hiérarchie : destination → « Ta valise est prête » → météo → couverture du séjour → ratio pièces/looks → looks → optimisation → ajout → action. Moteur, calculs et données inchangés ; seule la présentation a été reprise. Ce que l'écran ne montre PAS, faute de donnée :
- le moment de la journée (« Midi à Dakar ») et la description d'un look : un look porte toujours le nom de ce qu'il contient (`resumeLook`) ;
- « Chaud » et les mots de température : seule la plage prévue (`amplitudePrevue`) et la pluie annoncée (`pluieAnnoncee`, prévision seulement) sont affichées ; sans prévision, « Météo non disponible pour ces dates » ;
- la température d'un look : seulement celle des jours PRÉVUS qu'il habille ;
- le bloc vert « Ta valise couvre les besoins de ton séjour » n'apparaît que si c'est vrai (un look par occasion demandée, et au moins un look par jour) ; sinon, la phrase neutre d'avant ;
- « Optimise ta valise » distingue « Nécessaire » (occasion sans look, catégories du moteur) et « Optionnel » (moins de looks que de jours) ; sans l'un ni l'autre, la section n'existe pas — aucune suggestion n'est inventée ;
- pas d'image sur les suggestions : le moteur rend des catégories, pas des pièces.

## Chaussures et sac dans chaque look — 04/10/2026

Demandé : « pour les looks de valise, il faut toujours une paire de chaussures et un sac ». Le moteur des tenues du jour est inchangé ; le générateur de la valise (`generateurMoteur`) complète une tenue qui manque de chaussures ou de sac avec une pièce de ce type prise dans la valise (`completerChaussuresEtSac`, tirage au hasard comme les tenues). Sans pièce de ce type, la tenue n'est pas un look de valise : « Optimise ta valise » dit ce qui manque. L'écran ne montre plus, pour les valises gardées avant cette règle, les looks qui n'ont pas les deux (`lookAChaussuresEtSac`) : « Recomposer » en refait avec. **Limite** : la pièce ajoutée n'est pas jugée par le moteur (compatibilité de style, de saison) — c'est un complément tiré parmi les pièces de la valise, pas une recommandation.

## Refonte « programme du séjour » — phase A (04/10/2026)

Cinq écrans au lieu de quatre : l'étape 4 « Qu'est-ce qui est prévu ? » devient un PROGRAMME (occasions retenues + fréquence), suivie d'une synthèse « Ton programme est prêt » (étape 5), où chaque bloc se corrige d'un tap. [DÉCIDÉ]

- **Une couche, pas un second référentiel.** Les dix occasions de Capsela restent toutes proposées (« Ajouter une occasion »). Les sous-occasions du voyage (Visites, Balade, Shopping, Excursion, Plage, Piscine, Spa, Randonnée, Restaurant, Dîner, Sortie en vacances, Soirée festive, Travail / réunion, Mariage / cérémonie, Voyage / trajet) renvoient chacune à une occasion MÈRE, la seule que le moteur reçoit : `occasionsDuProgramme` → situations. Rattachements : Plage et Piscine → Quotidien (contrainte « chaleur »), Spa → Cocooning, Restaurant / Dîner / Sortie en vacances → Sortie / Soirée, Randonnée → Sport (« outdoor »), Trajet → Voyage. Date reste une occasion à part. `src/lib/programmeValise.ts`, testé. [DÉCIDÉ]
- **Jour + créneau.** Une fréquence est bornée PAR SON CRÉNEAU, jamais par la somme : un « jour » ou un « soir » jusqu'aux jours du séjour, un trajet jusqu'à deux. Plusieurs occasions peuvent tomber le même jour : « Visites 5 jours, Plage 3 jours, Restaurant 4 soirs » ne fait pas douze jours. [DÉCIDÉ]
- **Capsela propose, la personne corrige.** `programmeParDefaut(sejour, nbJours)` donne la proposition (parts de la durée par type de séjour : **ARBITRAGE ÉDITORIAL**, à revoir sur de vrais voyages) ; tant qu'on n'y touche pas, elle suit le séjour et la durée ; ensuite c'est le programme de la personne, rebordé si les dates changent.
- **Météo.** Trois niveaux, jamais une fausse précision : prévision disponible (utilisée précisément), prévision indisponible (« Prévisions météo non disponibles », la saison fait contexte), aucune donnée (séjour + saison + dressing). `couvertureMeteo` donne les plages (« 20–23 oct. » / « 24–29 oct. »). [DÉCIDÉ]
- **Morphologie.** Aucune logique morphologique propre à la valise ; le moteur de tenues actuel (où le terme morphologique est retiré depuis le 29/08/2026) est la source de vérité, sans divergence avec Tenue du jour. [DÉCIDÉ]
- **Données.** Le programme est gardé dans `calcul` (jsonb) de `valises` : aucune colonne, aucune migration. Une valise d'avant (occasions mères seules) s'ouvre ; modifiée, elle reprend une entrée par occasion sans fréquence inventée.
- **Ce que la phase A ne fait PAS.** Les fréquences et les contraintes (chaleur, marche, outdoor) sont enregistrées et affichées ; leur effet sur la génération (planning jour par jour, looks par créneau, filtre de pool par contrainte) est la phase B. Aujourd'hui, la génération reçoit les occasions mères du programme, comme avant.

## Refonte « programme du séjour » — phase B (04/10/2026)

**Le programme pilote la génération.** `situationsDuProgramme` (valise.ts) transforme chaque élément du programme en situations pour le moteur, avec sa contrainte et les `sousIds` qu'elle couvre. Le moteur reste `generateOutfitWithFallback` : aucune règle de style n'est ajoutée à la valise, aucun scoring morphologique (R-S9 retiré le 29/08/2026).

**Contraintes = filtres de pool, pas de règles de style** (`filtrerParContrainte`, programmeValise.ts) :
- chaleur (Plage, Piscine) : écarte manteaux, pulls, vestes, pièces « Automne / Hiver », bottes, bottines, chaussures d'intérieur ;
- marche (Visites, Balade, Shopping, Excursion) : écarte escarpins, sandales à talons, chaussures d'intérieur ;
- outdoor (Randonnée) : parmi les chaussures typées, ne garde que baskets, bottines, bottes ; une chaussure sans type reste.
Pas de repli sur le pool complet : si le pool filtré ne permet aucune tenue, la situation reste sans look et l'écran le dit. ARBITRAGE ÉDITORIAL : il n'y a pas de maillot dans le modèle de pièces, Plage/Piscine ne se distinguent donc que par la chaleur.

**Planning jour par jour** (`planningValise.ts`) : calculé à l'affichage, jamais stocké. Trajets : premier et dernier jour. Éléments « jour » et « soir » étalés sur les jours les moins chargés ; pour chaque créneau, le look de la valise qui répond à la situation correspondante, le moins utilisé d'abord. Aucun look adapté : le créneau le dit (« Aucun look de ta valise ne répond encore à cette occasion. »), rien n'est inventé.

**Résultat à onglets** : Ensemble, Looks (jour par jour), Pièces, Accessoires (Sacs, Bijoux & accessoires). « Ensemble » plutôt que « Vue d'ensemble » : quatre segments ne portent pas le libellé complet à 320 px ; `SegmentedControl` reçoit une option `serre` pour ce cas.

**Limite** : le planning n'existe que pour les valises générées avec ce code (les situations doivent porter des `sousIds`) ; une valise plus ancienne garde l'affichage précédent.

## Refonte « programme du séjour » — phase C (04/10/2026)

Module pur : `ajustementsValise.ts` (tests : `ajustementsValise.test.ts`). Rien n'est stocké, tout se relit des pièces et des looks ; le moteur reste celui de la tenue du jour (aucun scoring morphologique).

- **Polyvalence.** Onglet Pièces : « Dans N looks · portée J1, J4 » (jours d'après le planning, rien sans planning) et « Pièce polyvalente » à partir de `SEUIL_POLYVALENTE` (3 looks). La signature de l'onglet Ensemble est « N pièces · N looks · N jours » ; la pièce la plus réutilisée est dite avec son compte réel.
- **Alléger ma valise** (Ajuster ma valise → Alléger). Les pièces proposées sont celles sous le seuil de polyvalence, avec une raison VRAIE : aucun look, doublon (une autre pièce du même type sert davantage), un seul look, peu polyvalente. Pas de raison « remplaçable » : elle demanderait un calcul du moteur par pièce. L'aperçu avant → après compte les looks CONSERVÉS (ceux sans pièce retirée) : c'est un plancher, le moteur recompose ensuite avec les pièces restantes. Les occasions qui perdraient tout look sont nommées.
- **Ajouter une tenue.** On choisit une occasion du séjour (une situation, dite par ses éléments de programme) ; le moteur propose une tenue d'abord avec les pièces de la valise, à défaut avec le reste du dressing (la tenue qui demande le moins de pièces à ajouter), jamais un look déjà présent. La feuille dit les pièces qui s'ajoutent et un éventuel dépassement de capacité. « Autre proposition » retire au sort. Aucune pièce inventée ni « à acheter » : si le dressing ne permet rien, la feuille le dit.
- **Pièces manquantes.** Dit seulement quand la cible de pièces n'est pas atteinte : « N pièces de plus compléteraient ta valise X (n sur cible visées) », avec « Trouver dans mon dressing ». Le brief disait « Il te manque N pièces » : la formule est interdite dans tout src (outfitCopy.test.ts, arbitrage du 31/08/2026), le texte décrit donc l'apport d'un ajout.
- **Check-list de départ.** « À préparer » → « Dans la valise », sur les seules pièces de la valise (aucun autre objet inventé). Gardée sur l'appareil (localStorage, clé par valise), jamais dans le compte : ARBITRAGE ÉDITORIAL, c'est une aide de préparation, pas une donnée de la valise.

## Pas de mocassins ni de derbies en vacances (19/10/2026)

Les mocassins et les derbies (type de chaussure déclaré) ne servent qu'aux looks d'un événement professionnel (Travail · Bureau). Pour toute autre situation de la valise, ils sortent du pool avant le moteur (`sansChaussuresSerieusesHorsTravail`, `valise.ts`) : ils ne sont emportés que si le séjour compte un événement professionnel. Arbitrage instruit sur ces deux types seulement ; babies, escarpins et bottines ne sont pas concernés.

## Affaires de voyage étoffées (19/10/2026)

À partir de l'infographie « Les choses à avoir dans sa valise » (`affairesVoyage.ts`) :
- **Essentiels ajoutés** : carte Vitale, assurance voyage (« si tu en as une ») ; un groupe « Linge et nuit » (sous-vêtements, chaussettes, pyjama, sac pour le linge sale) ; gel douche et shampoing, brosse ou peigne, élastiques et pinces, maquillage et démaquillant, rasoir ou épilateur ; petite trousse de secours ; batterie externe, adaptateur de prise (« si tu pars à l'étranger » : la valise ne connaît pas le pays).
- **Liés au séjour, avec leur raison** : plage ou piscine → tongs, sac de plage ; plage, piscine ou chaleur (24° et plus) → lunettes de soleil, chapeau ou casquette ; trajet au programme → un groupe « Pour le trajet » (écouteurs, livre ou liseuse, coussin de voyage, en-cas et bouteille d'eau).
- **Écartés** : vêtements, sacs, bijoux, montre, ceinture et foulard, que la valise choisit dans le dressing avec les looks.
- Chaque affaire reste masquable ; c'est un ARBITRAGE ÉDITORIAL, à ajuster à l'usage.

## Refonte UX/UI du 19/10/2026

Brief « Refonte UX/UI de la fonctionnalité Valise ». Le moteur, la sélection et les données ne changent pas ; aucune migration.

- **Audit.** Un seul écran, `ValiseScreen.tsx` (parcours, résultat, détail look et pièce, feuilles). La valise est gardée sur l'appareil et dans le compte (`valises`, jsonb `calcul`). La **sélection** (`pieceIds`) et la **préparation** (`cochees` pour les pièces, `affaires.cochees` pour les affaires de voyage) sont déjà deux données distinctes. Il n'existe **pas de quantité** : une pièce du dressing est un objet unique, présent une fois dans la valise même s'il sert à plusieurs looks. Aucun contrôle de quantité n'est donc ajouté.
- **Checklist** (`checklistValise.ts`, testé) : « Ma checklist de départ », une progression unique (articles préparés / total, restants, %), filtres Tout / À préparer / Préparés, sections repliables avec leur progression (Vêtements, Chaussures, Sacs et accessoires, puis les groupes des affaires de voyage), lignes compactes (miniature, nom, case). Cocher ne touche ni la sélection ni les looks. « Ta valise est prête à partir » quand tout est coché. Pas de « Tout marquer comme préparé » : une validation accidentelle effacerait le suivi réel.
- **Aperçu** : la composition par famille (Vêtements, Chaussures, Sacs et accessoires, Affaires de voyage) et « Ma préparation », la même progression que la Checklist. En-tête plus compact ; la destination reste typographique, sans photo.
- **Looks** : cartes de jour resserrées, trois miniatures plus grandes des vraies pièces du look.
- **Retirer une pièce** dit ce que deviennent les looks (« looks recomposés : 5 → 4 ») : la valise les recompose déjà avec les pièces restantes.
- **Ajuster ma valise** : les mêmes actions, regroupées — Mes tenues (Ajouter une tenue), Ma sélection (Optimiser ma valise, Ajouter une pièce, Gérer les pièces), Mon départ (Préparer ma valise, Modifier mon séjour) — et « Supprimer cette valise » à part, toujours derrière sa confirmation.

## La valise fait la tenue du jour pendant le séjour (20/10/2026)

Entre le départ et le retour d'une valise (`valiseDuJour.ts`, testé) :
- **Le look de la journée** que la valise prévoit pour ce jour (planning jour par jour, à défaut le look du trajet) devient la tenue du jour, sous la forme d'une tenue planifiée virtuelle — jamais enregistrée — qui passe par le mécanisme des tenues planifiées (`planDuJour.ts`). Une tenue planifiée par la personne pour ce jour passe avant. L'accueil dit « Look de ta valise · Jour 2 de ton séjour à Lisbonne » ; « Voir la valise » ouvre la valise.
- **Le look du soir** est rappelé sous la tenue (« Ta valise · Ce soir »).
- **« Autre tenue »** passe au look suivant de la valise (complet, composé pour ce voyage) ; sans autre look, il tire dans les seules pièces de la valise, sans complément de la capsule — jamais une pièce restée à la maison (vivier, secours compris).
- Une valise sans planning jour par jour (composée avant le 04/10/2026) n'attribue pas de look ; la tenue du jour se tire alors dans ses pièces.
- Limite : la météo de l'accueil reste celle de la position ou de la ville du profil, pas la prévision de la destination.

## Les événements datés (22/10/2026)

Demandé : « il manque une étape d'événements dans la planification de valises ». Une **4e étape**, facultative, après « L'esprit du séjour » : la personne ajoute des moments précis — type (Mariage · cérémonie, Dîner, Soirée, Rendez-vous, Réunion · travail), jour du séjour, moment (Journée ou Soirée, proposé selon le type), nom facultatif (`evenementsValise.ts`).

- **Une situation par événement** (`situationsDesEvenements`) : son occasion mère, la météo de son seul jour, le sous-identifiant `evt:<id>`. Ajoutées après celles du programme, dont les indices ne bougent pas. Le moteur reçoit l'occasion mère, rien d'autre : une réunion autorise donc les mocassins pour son look, comme un événement professionnel.
- **Le planning** (`planningDuProgramme`, paramètre `evenements`) place chaque événement à son jour et à son moment AVANT d'étaler les activités, qui évitent ce créneau quand elles le peuvent. Les événements choisissent leur look en premier ; les autres créneaux évitent ensuite ces looks quand un autre look leur répond — sans autre look, il est partagé, jamais retiré. Le créneau porte `evenement: true` ; l'écran l'affiche en terracotta avec son moment (« Mariage de Léa · Soirée »).
- **La tenue du jour** pendant le séjour passe par le même planning (`planningDeLaValise`, partagé par l'écran Valise et `valiseDuJour.ts`) : un événement du soir devient le plan de soirée, un événement de journée la tenue du jour.
- Gardés dans `ValiseGardee.evenements`, dans le jsonb `calcul` : **aucune migration**. Un événement hors des dates (les dates ont changé) est ignoré, jamais déplacé.
- **Refonte de l'étape (22/10/2026, brief « Refonte UX/UI de l'étape 4/4 »)** : « Événements ajoutés (N) » en cartes compactes (nom, jour · moment, type sous un nom personnalisé), chacune modifiable (le formulaire reprend ses valeurs et garde son identifiant : aucun doublon) et supprimable (« Annuler » pendant 6 s, comme la checklist). Jours en rangée défilante (jour, numéro, mois), calculés depuis les dates du séjour. Un champ obligatoire manquant (type, jour) est signalé au toucher d'« Ajouter cet événement ». Type « Autre » → occasion Quotidien (ARBITRAGE ÉDITORIAL : la plus neutre ; le moteur ne lit pas le nom libre). « Générer ma valise » ne lance qu'une préparation à la fois.

Limite constatée en rendu (seed de démo, Lisbonne 25–29/10, mariage le 25 au soir) : le look du mariage est la seule tenue de soirée de la valise, il revient donc les autres soirs. La composition (`composerValise`) minimise les pièces et ne garantit pas un look propre à chaque événement — à instruire si besoin.

## « Autre tenue » garde l'occasion pendant le séjour (22/10/2026)

Demandé : « que la conformité de tenue depuis laquelle on demande une autre tenue soit gardée ». Avant, « Autre tenue » passait au look suivant de la valise quelle que soit son occasion. Désormais (`lookSuivantConforme`, `valiseDuJour.ts`), seuls les looks qui servent l'occasion de la tenue affichée sont parcourus — un look sert toutes les occasions de ses situations — et l'occasion ne change pas. Sans autre look de cette occasion, le store tire une tenue de la même occasion dans les seules pièces de la valise.

Mesuré en rendu (séjour de démo, tenue du jour en Quotidien, six « Autre tenue ») : avant, 3 tirages sur 6 passaient en Soirée ; après, 0 sur 6.

## La capsule du séjour suit la chaleur du séjour (22/10/2026)

Demandé : « lorsque tu identifies que la température est élevée il faut que tu en tiennes compte et que tu pioches dans les bonnes capsules ». La valise se complétait avec la capsule de la tenue du jour, bâtie sur la météo d'aujourd'hui chez soi. `capsuleDuSejour` (`valise.ts`) bâtit une capsule par saison que les situations du séjour appellent — `saisonCapsuleDuJour`, la règle de la tenue du jour : la météo, bornée par le calendrier sous `CHALEUR_HORS_SAISON` (24°) — et les réunit sans doublon. Même correction, même règle, pour Planifier (capsule de la date) et pour la tenue d'un autre jour que l'accueil consulte (`capsuleDuJourConsulte`, store).

Mesuré (catalogue réel, 8 styles × femme/homme, même exécution) : à 26°, 29° en automne et 31° en hiver, la capsule utilisée contenait 192 pièces de froid (saison Automne / Hiver, manteaux, pulls) sur 616 ; avec la chaleur, 32 sur 592. À 12° en automne, rien ne change (192/616 des deux côtés). DÉMONTRÉ pour ces scénarios.

## Variété : des looks en plus, de nouvelles tenues pendant le séjour (22/10/2026)

**Composition — étape 4, « Varier »** (`composerValise`). Une occasion qui revient sur plusieurs jours reçoit des looks jusqu'à un look pour deux jours, chacun pour au plus `VARIETE_PIECES_MAX` (2) pièces nouvelles et dans la capacité. ARBITRAGE ÉDITORIAL. Mesuré (dressing de démo, vrai moteur, 15 valises par scénario, avant/après dans la même exécution par le levier `sansVariete`) : soirs portant un look déjà porté — plage 7 jours 21/45 → 16/45, séjour pro 4 jours 2/30 → 1/30, Lisbonne 5 jours 34/60 → 30/60 ; une pièce de plus en moyenne (0,3 à 3,4 selon le séjour). Limite démontrée sur Lisbonne : le dressing de démo n'offre que deux tenues du soir (robe chemise, avec ou sans blazer) ; aucune règle de composition ne peut en inventer une troisième.

**Tenue du jour pendant le séjour.** « Autre tenue » parcourt les looks de la valise de l'occasion affichée, puis, quand tous ont été montrés, compose de nouvelles tenues dans les seules pièces de la valise (40 essais au lieu de 12, une tenue jamais vue préférée à un look déjà montré), et ne revient aux looks qu'à défaut. Le look quitté est compté comme vu, y compris quand il venait du plan de la valise (`voirAutreProposition`). Mesuré en rendu (séjour de démo, dix « Autre tenue ») : avant, un look déjà vu revenait dès le 4e tirage ; après, 8 à 9 tenues différentes avant la première répétition, toutes en Quotidien, toutes avec des pièces de la valise.

## La lecture du nom d'un événement « Autre » (22/10/2026)

Demandé : « lance la lecture IA ». Le moteur ne lit pas de texte libre ; un événement « Autre » recevait toujours Quotidien. Désormais, quand un « Autre » a un nom, la fonction Edge `lire-evenement` (OpenAI, `store: false`, temperature 0, nom seul, quota de 60 lectures par compte et par jour, protection de `_shared/protection.ts`) le traduit en UNE occasion parmi sept (`OCCASIONS_EVENEMENT`, sans Voyage), gardée dans `EvenementValise.occasionLue`. Elle ne compose rien : c'est toujours le moteur qui compose, avec les pièces du dressing. Un doute, une réponse hors liste, le mode démo, un échec ou le quota : `null`, et l'événement garde Quotidien. Seul le type « Autre » est lu : un type explicite (Mariage, Dîner…) garde son occasion. La carte de l'événement dit la tenue prévue (« Tenue : Cérémonie ») ou « Capsela lit le nom… » pendant la lecture. Déclarée dans la politique de confidentialité (prestataire OpenAI). Déploiement : automatique au merge sur main ; aucune migration (le quota réutilise `consommer_edge_quota`, migration 0043).

## Parcours fluidifié (30/10/2026)

Brief « Fluidification du parcours de préparation de valise ». **Trois étapes au lieu de quatre** : ton séjour (destination, dates), ta valise (taille), « Qu'as-tu prévu pendant ton séjour ? » — activités en pastilles et, en dessous, « Et as-tu d'autres événements prévus ? ». Activités et événements sont **facultatifs** : sans activité, `programmeDesActivites` retombe sur le quotidien, comme avant. Clics minimum de l'étape 1 à la génération : 5 → 3.

- **Événements** : les types en pastilles ; le reste (jour, moment, nom) ne s'ouvre qu'une fois un type choisi et vient sous les yeux. Types ajoutés, renvoyant à des entrées du programme existantes : Visite → `visites`, Activité sportive → `sport`, Sortie en bateau → `excursion` (ARBITRAGE ÉDITORIAL). Moments : Matin, Journée, Soirée, Toute la journée — matin et toute la journée prennent le créneau de la journée ; toute la journée occupe aussi la soirée (`creneauDuMoment`, `planningValise.ts`). Valeurs ajoutées : les valises déjà gardées (« jour », « soir ») restent lues telles quelles.
- **« Événement spécial »** n'est plus proposé parmi les activités (une cérémonie s'ajoute comme événement daté) ; une valise qui l'a gardé le retrouve, coché.
- **Préparation** : trois traitements réels, cochés dans leur ordre (la météo et ton programme ; tes pièces et tes looks, dans la place de ta valise ; ta capsule si besoin). Avant : cinq lignes, dont deux cochées après coup et retardées par des pauses.
- **Textes** : « Ton séjour », « Préparer ma valise » et « Tu pourras toujours modifier ta valise ensuite. », « On prépare ta valise… », « On n'a pas pu préparer ta valise », « Ta valise est prête ! ».
- Le moteur et la composition ne changent pas : à programme et événements égaux, la valise est la même.

## L'écran « Ma valise » refondu (30/10/2026)

Brief « Refonte UX de l'écran Ma valise ». Aucune règle du moteur ni de la composition ne change : à séjour égal, les tenues sont les mêmes. Ce qui change, c'est la lecture de la valise.

- **Une pièce, une ligne** (`valiseVetements.ts`, testé) : les vêtements sont rangés par identifiant, jamais par nom ni par catégorie. Un pull porté dans trois tenues est UNE pièce, qui dit « 3 tenues ». Ils sont groupés par famille (Hauts, Bas, Robes & combinaisons…), chacune avec son nombre de pièces.
- **Deux statuts de provenance**, arbitrés par la propriétaire le 30/10/2026 : « Dans ton dressing » pour une pièce possédée, « À ajouter » pour une suggestion de la capsule (`suggestionIds`). Il n'y a pas de « Dans ta capsule ».
- **Les suggestions restent dans les tenues** (arbitrage « Garder les tenues » du même jour) : aucune tenue n'est modifiée. Elles ne sont plus comptées parmi les vêtements, ni montrées avec les pièces à emporter. Elles n'apparaissent que dans « À compléter », avec la tenue qui les demande (« Pour ta tenue Dîner du ven. 6 nov. », `creneauxDeLaPiece`) et l'ajout au dressing.
- **Quatre onglets** : Aperçu, Tenues, Vêtements, Indispensables (« Essentiels » sous 360 px de large).
  - L'Aperçu montre une galerie horizontale des tenues, les pièces à emporter et « À compléter ».
  - Vêtements et Indispensables ont chacun leur progression.
- **En-tête** : la synthèse « durée · tenues · vêtements · indispensables », puis la taille et le remplissage de la valise.
- **Retirer une pièce qui sert dans des tenues** passe par une feuille (`BottomSheet`). Elle nomme les créneaux concernés et propose « La remplacer », « La retirer quand même » ou « Annuler ». Une pièce qu'aucune tenue n'utilise se retire directement, comme avant.

## L'étape Activités en une seule sélection (30/10/2026)

Brief « Refonte UX de l'étape Activités ». L'étape 3 n'a plus deux sections (activités, puis événements datés avec jour, moment et nom) mais une seule sélection, « Qu'as-tu prévu à Marrakech ? » (`destinationAvecPreposition` : à, au, en, aux).

- **Des idées selon la destination**, servies par la fonction `lire-evenement`, qui lisait déjà le nom d'un événement (`_shared/ideesSejour.ts`). Même protection, même clé, plafond propre (`MAX_IDEES_SEJOUR_PER_USER_PER_DAY`, 30 par défaut). Seul le nom de la destination part chez OpenAI. Chaque idée porte une famille (filtres de l'écran) et l'une des activités que le moteur connaît. Une réponse est gardée sur l'appareil par destination. Sans réponse (mode démo, hors ligne, quota, destination vague) : `IDEES_GENERIQUES`, les activités d'avant sous forme d'idées.
- **Ses propres idées** : un champ, un geste, sans date, moment ni nom distinct. Un mariage s'ajoute comme une visite. La correspondance vers le moteur vient des mots (`activiteDuLibelle`), sinon de la lecture IA du libellé (`lireNomEvenement`). Un libellé qu'aucune activité ne décrit est gardé tel quel et ne change rien aux tenues.
- **« Ton programme »** rassemble les choix, chacun retirable. « Tout effacer » passe par une feuille de confirmation.
- **Le moteur ne change pas** : les choix (`ValiseGardee.choix`, dans `calcul`, aucune migration) se traduisent en `activites`, qui donnent le programme par `programmeDesActivites`, comme avant. Le libellé d'origine n'est jamais perdu. Plusieurs idées qui évoquent la même activité ne pèsent pas plus qu'une (les parts du séjour sont celles d'avant).
- **Reprise** : une valise d'avant retrouve ses activités sous le libellé de l'idée qui les dit. Ses événements datés restent avec leur jour, figurent au programme et se retirent de la même façon.

## Le road trip : plusieurs destinations, des dates par étape (30/10/2026)

Demandé : « donner la possibilité d'ajouter plusieurs destinations dans le cas d'un roadtrip ». Arbitré par la propriétaire le même jour : des dates **par étape** (`etapesSejour.ts`).

- **Étape 1 du parcours** : sous la destination et avant les dates (déplacé le 30/10/2026, demandé), « Ajouter une autre destination ». Chaque étape ajoutée a sa ville (le même choix de ville que la destination) et son jour d'arrivée, choisi parmi les jours du séjour. Le nombre de nuits de chaque étape s'affiche. Jusqu'à six étapes.
  - La première étape est la destination, au départ.
  - Une étape sans ville, ou dont le jour d'arrivée est déjà pris ou sorti du séjour, est signalée, et « Continuer » attend.
- **Chaque jour appartient à une seule ville** : la dernière étape arrivée, le jour du trajet compris. Sa météo est celle de cette ville (prévision et climatologie de l'étape, sur ses seuls jours). Pendant le séjour, la tenue du jour et la prévision du résultat suivent l'étape du jour (`destinationDuJour`).
- **Le moteur ne change pas** : il reçoit, comme avant, une météo par jour.
- **Étape Activités** : le titre devient « Qu'as-tu prévu pendant ton road trip ? », et les idées couvrent toutes les villes.
- **Gardé** : `ValiseGardee.etapes` (dans `calcul`, aucune migration). `destination` dit l'itinéraire, « Lisbonne → Porto → Faro ». Une valise d'une seule destination n'a pas d'étapes et se lit comme avant. Modifier un road trip reprend ses étapes ; le recomposer refait la météo étape par étape.

### Compléments du 30/10/2026

- **Jours d'arrivée proposés** (`arriveesProposees`) : une étape ajoutée avant les dates reçoit un jour d'arrivée dès que les dates sont choisies. Les jours sont répartis sur le séjour, dans l'ordre d'ajout, sans en prendre un déjà pris. Un jour déjà choisi ne bouge pas.
- **Les villes du même pays d'abord** : quand la première destination est un pays, la recherche des étapes suivantes demande d'abord les villes de ce pays (géocodage « ville,code pays »), puis les autres, sans doublon (`villesDuPaysDabord`, `lieux.ts`). Le code pays est gardé avec la première étape (`EtapeSejour.pays`), pour la reprise.
