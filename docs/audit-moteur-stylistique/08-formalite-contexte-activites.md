# 08 — Formalité, contexte et activités : audit avant évolution (11/11/2026)

Brief « Évolution du moteur de recommandations — formalité vestimentaire, cohérence contextuelle et activités de vacances », phase 1.
Audit **en lecture seule** du code au commit `9fe7c46` : aucune règle, aucune donnée modifiée. Complète les documents 01 à 07 (13/10/2026).

## 1. Le référentiel de formalité réel

| Valeur en base (`niveau_formalite`) | Nombre | Sens observé dans le code |
|---|---|---|
| `sport` | 0 | technique, activewear ; seule valeur admise en Sport (R-B11) |
| `decontracte` (`décontracté`) | 1 | casual, du t-shirt au jean ; plancher de Quotidien, Voyage, Cocooning |
| — | 2 | **inutilisé** : aucune valeur, aucun repli ne le produit |
| `business_casual` (`business casual`) | 3 | blazer, chemise, tailleur, mocassins ; plancher de Travail présentiel, Soirée, Date « soirée festive » |
| `habille` (`habillé`) | 4 | soie, paillettes, robe de cocktail ; plancher d'Événement, Soirée habillée, Date « restaurant » |

- Mapping : `FORMALITE_MAP`, `src/lib/vestiaire.ts`. Lecture : `formalityOf` (`src/lib/attributes.ts`) — la valeur déclarée prime ; sans
  elle (pièces du dressing), une heuristique par mots du nom : baskets / mots de sport → 0, soie + robe → 4, blazer / chemise /
  escarpins → 3, sinon 1.
- Aucune différence homme / femme dans l'échelle. Le genre filtre les pièces, pas la formalité.
- **Constat F1** : l'échelle a déjà un trou entre 1 et 3. C'est exactement là que vivent « casual chic » et « smart casual » : un blazer
  déstructuré, un jean brut et une chemise structurée sont aujourd'hui soit 1 soit 3, jamais entre les deux.
- **Constat F2** : la formalité des pièces du dressing est devinée par le nom ; une pièce réelle mal nommée est mal classée (déjà
  compensé par `declaredOccasionOk` : une occasion déclarée à l'ajout exempte du plancher, correctif du 23/08/2026).

## 2. Les occasions

- Huit occasions affichées (`OCCASIONS`, `src/lib/data.ts`), chacune avec un **seul** niveau : le plancher (`OCC_FORMALITY`).
- Les « 10 occasions » du document historique : `entretien` et `sortie_festive`, **fusionnées le 08/10/2026** et gardées en lecture seule
  (`ANCIENNES_VALEURS`, `src/lib/occasions.ts`) : `entretien` → Travail, sous-choix « Entretien » ; `sortie_festive` → Soirée, rendue
  « habillée » par le contexte (`soireeHabillee`). Plus `all`, valeur technique (« toutes occasions »).
- Sous-contextes : Travail (`WORK_MODES` : Présentiel 3, Télétravail 1, Entretien) ; Rendez-vous (`DATE_CONTEXTS` : Restaurant 4, Verre
  1, Cinéma / balade 1, Activité 1, Soirée festive 3). `effectiveFormality(occasion, workMode, dateContext, habillee)` en est la seule
  lecture.
- **Constat O1** : il n'existe **ni cible ni maximum** de formalité par occasion. Seul le minimum agit (R-B3) ; rien ne pénalise une
  tenue trop habillée, sauf le repli de formalité (`FORMALITY_FALLBACK_CHAIN` : 4 → 3 → 1, 3 → 1) qui ne fait que descendre.
- **Constat O2** : aucune notion de **dress code** dans les données ni dans l'interface. Un événement (Planifier, valise) a un type et un
  moment, jamais un code vestimentaire.

## 3. Les règles de formalité et de compensation

- **R-B3** (filtre dur, `hardCategoryFilter`, `logic.ts`) : un vêtement sous le plancher est exclu. Exemptions : le manteau
  (`manteauHorsPlancher`), une occasion déclarée sur la pièce, et **le haut de formalité ≥ 1** (il peut être compensé par une veste).
- **`compensatingVeste`** (`generateOutfit`) : quand aucun haut n'atteint le plancher, une veste qui l'atteint est tirée et le haut
  redevient libre (« t-shirt + blazer » au bureau). Jamais pour le bas.
- **R-B2** (contrôle après coup, `blockingHits`) : écart de formalité > 2 entre les vêtements (manteau exclu) → avertissement, non
  bloquant. Au tirage, `candidatsDeRemplacement` limite l'écart à la moyenne déjà choisie.
- **R-B6** : pas de baskets dès que l'occasion demande ≥ 3.
- **Constat C1** : la formalité d'une tenue n'est jamais calculée comme un tout. Chaque pièce passe un plancher ; l'écart est contrôlé ;
  mais « blazer structuré + jean + baskets » n'a pas de formalité perçue propre (ni rehaussement ni déclassement).
- **Constat C2** : le blazer au quotidien n'est retenu par aucune règle : un blazer (3) passe le plancher de Quotidien (1). Seule la
  valise l'écarte, depuis le 07/11/2026 (`poolDecontracte`, trajets et randonnées).

## 4. Les activités et la compatibilité fonctionnelle

- Les activités de la valise (`activitesSejour.ts`) se rattachent à une **sous-occasion Vacances** (`programmeValise.ts`), qui donne au
  moteur une occasion mère et une **contrainte** (`marche`, `chaleur`, `outdoor`) : un filtre sur le pool, pas une règle du moteur.
- Chaussures déjà traitées par contrainte : marche (baskets, bottines, bottes au froid, sandales plates au chaud, jamais de talons),
  chaleur (ni bottes, ni talons), randonnée (paire de randonnée seule), spa (chaussons, tongs ou pieds nus).
- **Constat A1** : les types de chaussures (`ShoeType`, 13 valeurs) ne distinguent pas running, trail, marche, chaussure bateau : les
  chaussures de randonnée elles-mêmes sont des « Baskets » pour le moteur. Une matrice PRIORITY / ACCEPTABLE / INCOMPATIBLE par activité
  n'a donc aujourd'hui que des types grossiers sur lesquels s'appuyer.
- **Constat A2** : le terrain d'une activité (urbain, nature facile, montagne) n'est connu nulle part. « Excursion » et « Randonnée &
  marche » sont deux sous-occasions ; une excursion facile et une randonnée en montagne ne se distinguent que par le libellé saisi.
- **Constat A3** : la valise compose par situation (sous-occasion × météo) avec le moteur unique ; une pièce sert plusieurs looks et
  n'est comptée qu'une fois ; les pièces fonctionnelles (paire de randonnée, maillot) sont ajoutées par activité et ne sont pas retirées
  par l'optimisation de volume.

## 5. Le catalogue

**NON MESURÉ** : la base n'est pas joignable depuis l'environnement de développement (réseau bloqué, anciennes clés d'API Supabase
désactivées le 28/08/2026). Les audits `scripts/*.audit.ts` exigent cette connexion. Requête à lancer pour la répartition :

```sql
select category, coalesce(niveau_formalite, '(vide)') as formalite, count(*)
  from vestiaire_universel where frozen = false
 group by 1, 2 order by 1, 2;
```

## 6. Risques de régression

- Toute cible, tout maximum ou toute pénalité de sur-formalité change le **score** (seuil « recommandé » à 80) et donc le classement de
  toutes les tenues de toutes les occasions : la règle d'audit (AGENTS.md) impose de mesurer avant / après sur le même pool, ce qui exige
  l'accès à la base (section 5).
- Introduire le niveau 2 change le plancher R-B3 de toute pièce reclassée, R-B2 (écarts) et R-B6 (seuil 3).
- Un dress code bloquant demande une saisie dans Planifier et la valise : un nouveau champ d'événement.

## 7. Architecture cible proposée (sans second moteur)

1. **Formalité perçue de la tenue** — une fonction pure, dans le moteur : la pièce principale (robe, combinaison, sinon le bas) fixe la
   base ; la veste rehausse d'au plus un cran ; les chaussures déclassent d'au plus un cran ; les accessoires n'y comptent pas.
2. **Cible et maximum par occasion** — à côté du plancher existant, dans la même table (`OCCASIONS` ou un référentiel voisin) ; un écart
   à la cible devient un terme du score, jamais un filtre ; le plancher (R-B3) reste dur.
3. **Compatibilité fonctionnelle** — une table par sous-occasion (PRIORITY / ACCEPTABLE / INCOMPATIBLE), lue par le filtre de contrainte
   existant (`filtrerParContrainte`) : la valise d'abord, la tenue du jour Sport ensuite.
4. **Dress code** — un attribut facultatif d'événement, contrainte dure quand il est posé.

## 8. Décisions métier à prendre avant toute implémentation

| # | Décision | Pourquoi elle bloque |
|---|---|---|
| D1 | Utiliser le niveau 2 (« casual chic / smart casual ») ? | Reclasser des pièces du catalogue (SQL à valider) ; change R-B2, R-B3, R-B6 |
| D2 | Cible et maximum de chaque occasion et sous-contexte | Valeurs éditoriales, aucune ne se déduit du code |
| D3 | Poids de la pénalité de sur-formalité dans le score | Change le classement de toutes les tenues : à mesurer |
| D4 | Où saisir un dress code (événement de Planifier, de la valise) ? | Nouveau champ, nouvel écran |
| D5 | Nouveaux types de chaussures (running, trail, bateau) au catalogue ? | Données et visuels à créer |
| D6 | Terrain des activités : demandé à la personne, lu par l'IA, ou inconnu par défaut ? | Le brief interdit d'inventer une exigence |
| D7 | Mesure : exécuter les audits dans un workflow GitHub (clé secrète Supabase), faute d'accès depuis ici ? | Condition de la règle d'audit |

## 9. La mesure (D7, 11/11/2026)

- Workflow **« Audits du moteur (lecture seule) »** (`.github/workflows/audits-moteur.yml`) : lancé à la main, il exécute les audits
  nommés (`scripts/<nom>.audit.ts`) sur le vrai catalogue, avec la clé secrète déjà en place (`SB_SECRET_KEY`), et garde leur sortie en
  artefact 30 jours. Vérifié avant : aucun audit n'écrit dans la base.
- Nouvel audit **`repartition-formalite`** (décision D1) : niveaux déclarés par catégorie, niveaux lus par le moteur, et les pièces
  ambiguës du brief (blazers, jeans, chemises, robes, baskets) par niveau. Il lit le catalogue par pages.
- **Risque relevé** : les audits existants lisent `vestiaire_universel` en une requête, sans pagination ; PostgREST plafonne une réponse à
  1 000 lignes par défaut et les identifiants dépassent 1 350. Si le plafond s'applique, ces audits n'ont vu qu'une partie du catalogue.
  À vérifier à la première exécution (le nombre de lignes lues est affiché par `repartition-formalite`).

## 10. Décisions et résultats (11/11/2026)

- **D1 — niveau 2 ouvert.** Migration 0061 lancée (la contrainte admet `casual_chic`). 126 pièces reclassées (liste de l'audit
  `niveau-2`, moins 11 pièces retirées par la propriétaire : jupes crayon, pantalons cigarette et à pinces, mules à talons, mocassins à
  petit talon ; `docs/capsules/formalite-niveau-2.sql`, sauvegarde `sauvegarde_formalite_niveau2`).
- **Planchers : variante B** (inchangés). Mesuré sur la base reclassée (exécution n° 3) : la sur-formalité au quotidien (tenues portant un
  vêtement de niveau 3 ou plus) passe de 67,7 % à 46,9 % chez les femmes, de 51,8 % à 48,7 % chez les hommes ; tenue trouvée 100 %.
  Coût : le palier 3 est un peu moins souvent atteint au bureau et en soirée (83 à 86 % au lieu de 89 à 92 %).
- **Repli par le casual chic appliqué** (`FORMALITY_FALLBACK_CHAIN` : 4 → 3 → 2 → 1, 3 → 2 → 1). Mesuré (exécution n° 4, variante D) :
  les tenues de bureau, de soirée et d'événement qui retombaient au décontracté passent de 14 à 17 % à 0 % chez les femmes, de 28,6 % à
  14,3 % chez les hommes. Le reste masculin tient au catalogue (peu de pièces casual chic homme dans certains styles), pas au moteur.
- **Les 52 pièces sans niveau classées** (ARBITRAGE ÉDITORIAL de la propriétaire, prompt `docs/capsules/prompt-formalite-52-pieces.md`,
  correction du 504 en casual chic : une grosse maille n'est pas décontractée par nature). decontracte 13, casual_chic 38,
  business_casual 1 (collants fins 496). SQL `docs/capsules/formalite-52-pieces.sql`, sauvegarde `sauvegarde_formalite_52` (52 lignes,
  toutes vides avant). Contrôle `verification-52-formalite` (exécution n° 8) : vert, aucun écart au classement validé. Classement
  PROVISOIRE, à relire : 486 (lunettes de soleil), 490 et 684 (bagues).
- **NON DÉMONTRÉ** : l'effet sur les apps mobiles construites avant le 11/11/2026, qui ne lisent pas `casual_chic` (elles devinent le
  niveau par le nom) ; il faudra un build.
