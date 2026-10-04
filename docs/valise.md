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
| 1 / 4 — Où pars-tu ? | Ville (autocomplétion de Planifier), « Tes lieux planifiés » (villes de tes tenues planifiées), dates départ / retour, « 9 jours · 8 nuits ». Séjour de 21 jours au plus. Si la prévision couvre le départ : « Berlin · 17° – 18° prévus » et un conseil (section 5) |
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

| Taille | Libellé | Capacité |
| --- | --- | --- |
| S | Cabine souple | 8 pièces |
| M | Cabine | 12 pièces |
| L | Grande valise | 18 pièces |
| XL | Très grande valise | 24 pièces |

Chaussures, sacs et accessoires compris ; ne dépend que de la taille. Capacités : **ARBITRAGE ÉDITORIAL** du 27/09/2026. Libellés L et XL : brief de refonte (« Soute moyenne » / « Grande soute » se lisaient mal). [DÉCIDÉ]

La capacité est un plafond, pas un objectif : le résultat met en avant « pièces → looks » et ne dit la capacité qu'en second (« Valise M · jusqu'à 12 pièces »). [DÉCIDÉ]

**Révisé le 04/10/2026** (demandé : « on est partie sur un nombre de pièces par type de valise », après une valise « prête » à 1 pièce sur 18) : la capacité reste le plafond, et devient aussi une CIBLE pour dire « prête ». Une valise n'est « prête » qu'avec au moins un look par occasion demandée ET `cibleDePieces` atteinte — 70 % de la capacité arrondi au supérieur (S 6, M 9, L 13, XL 17) —, sans dépasser le plafond. Sinon, « Ta valise à compléter », et l'écran dit combien de pièces manquent. Le compteur se lit « 1 / 18 pièces ». **Le 70 % est une proposition, à confirmer : ARBITRAGE ÉDITORIAL.** Le moteur ne change pas : il continue de composer avec le moins de pièces possible ; c'est la présentation qui ne dit plus « prête » avant la cible.

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

## 9. Accès

Règle `PREPARER_VALISE` dans `REGLES_ACCES` (`src/lib/autorisations.ts`, copie serveur pour le test miroir) : fonctionnalité **Premium**, en **`ACCES_LIBRE`** pendant la phase de test, comme l'Avis de styliste. Au lancement : `PREMIUM_REQUIRED` des deux côtés ; aucune fonction serveur à redéployer. [DÉCIDÉ]

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
