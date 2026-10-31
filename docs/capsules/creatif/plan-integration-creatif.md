# Plan d'intégration — style Créatif femme et homme

Étape 1 de l'audit Créatif, 30/10/2026 : **proposition seulement**. Rien n'est exécuté avant ta validation explicite (« Ne passe pas à
l'étape 2 sans validation explicite »). Aucun SQL de ce document n'a été lancé. Les étiquettes suivent la règle d'audit d'AGENTS.md :
**DÉMONTRÉ**, **NON DÉMONTRÉ**, **ARBITRAGE ÉDITORIAL**.

Sources : `audit-rapprochement-creatif.md`, `audit-couverture-creatif.md`, `pieces-manquantes-creatif.xlsx` (même dossier).

## 1. Ce que l'audit établit

| Constat | Statut |
|---|---|
| Aucun article de `vestiaire_universel` ne porte « Créatif » dans `styles` | DÉMONTRÉ (export du 30/10/2026) |
| Équivalents exacts : 8 pièces de référence femme sur 151 (4 articles distincts), 33 homme sur 128 (28 articles distincts, dont 4 unisexes) | DÉMONTRÉ |
| Bases potentielles (le type existe, sans le trait créatif) : 119 femme, 75 homme | DÉMONTRÉ, à arbitrer pièce par pièce |
| Manquantes : 15 femme, 17 homme (dont les 4 sous-pulls, arbitrage du 30/10/2026 : un sous-pull n'est pas un pull col roulé fin) ; incompatibles (saison ou genre) : 9 femme, 3 homme | DÉMONTRÉ |
| La capsule de référence ne couvre pas seule toutes les occasions : 22/32 femme, 16/32 homme ; 28/32 et 23/32 avec les pièces transversales | DÉMONTRÉ (critère : haut + bas ou pièce unique, + chaussures) |
| Avec les seuls équivalents exacts, un profil Créatif femme n'aurait pas de style effectif | DÉMONTRÉ par le code, NON DÉMONTRÉ en exécution — cf. § 2 |

## 2. La contrainte du moteur qui décide de tout

`computeDefaultCapsule` (`src/lib/capsule.ts`) filtre le catalogue par style du profil, puis :

```ts
let curated = styles.length ? base.filter((it) => isSportEssential(it) || styles.some((st) => styleFit(it, st))) : base;
if (curated.length < 18) curated = base;
```

Sous 18 articles du style (après les filtres genre, saison, température), la capsule **ignore le style** et repart de tout le catalogue.
Pour Créatif, articles distincts disponibles par saison (même genre ; les unisexes s'y ajoutent) :

| Genre | Saison | Exacts seuls | Exacts + bases potentielles validées |
|---|---|---|---|
| Femme | Printemps · Été · Automne · Hiver | 1 · 2 · 2 · 1 | 32 · 28 · 30 · 25 |
| Homme | Printemps · Été · Automne · Hiver | 7 · 4 · 11 · 11 | 24 · 23 · 26 · 25 |

Conséquence : étiqueter les seuls équivalents exacts ne suffit pas. Un style Créatif utile exige soit la validation d'une grande part des
bases potentielles, soit la création des variantes créatives, soit les deux. Le seuil de 18 reste tel quel (ne pas modifier les règles de
scoring sans justification) : c'est le catalogue qui doit le franchir. L'effet réel sur les capsules et les tenues est **NON DÉMONTRÉ**
tant que l'audit d'exécution (§ 6) ne l'a pas mesuré.

`styleFit` lit `styleTags` quand l'article en a (tous les articles du catalogue) ; la table de motifs `STYLE_FIT` ne sert qu'aux pièces
sans étiquettes, c'est-à-dire celles du dressing. Il faut donc une entrée `Créatif` dans `STYLE_FIT` pour que les pièces réelles
d'un profil Créatif soient reconnues.

## 3. Décisions à prendre avant l'étape 2

1. **Identifiant du style — ARBITRAGE ÉDITORIAL.** Un commentaire de `profile.ts` (20/08/2026) dit « jamais un 9e id » ; ta demande d'un
   9e style femme le contredit. Proposition : un id `creatif` commun aux deux genres, libellé « Créatif » (femme) et « Créatif /
   Artistique » (homme, libellé déjà employé par la référence homme). **Arbitré le 30/10/2026** : l'entrée homme `romantique` (masquée,
   libellée « Créatif / Artistique ») n'est PAS touchée — ni libellé, ni relecture en `creatif`. Constat sur l'export : 5 articles homme
   portent « Romantique », toujours parmi d'autres styles (#504, #511, #517, #521, #972), aucun en propre ; le style étant masqué côté
   homme et écarté à la lecture d'un profil (`stylesDuGenre`), ces étiquettes sont sans effet. Aucune contrainte en base
   ne s'y oppose : `profiles.styles` est un `text[]` sans CHECK (migration 0001), `vestiaire_universel.styles` aussi (migration 0017).
2. **Libellé catalogue** : « Créatif », ajouté à la colonne `styles` (texte séparé par des virgules), jamais en remplacement.
3. **Bases potentielles — ARBITRAGE ÉDITORIAL, pièce par pièce.** Étiqueter « Créatif » une base unie (un « Pull col V » pour un « Pull
   jacquard graphique ») dilue le style ; créer la variante l'enrichit mais coûte une fiche et une image. La feuille « Potentielles à
   arbitrer » du classeur a une colonne « Décision », vide, à remplir ligne par ligne. Une décision prise sur une pièce ne vaut pas pour une autre
   (règle d'audit, points 6 et 7).
4. **Occasion « Vacances »** (7 pièces femme, Été) : absente de la taxonomie. La rattacher à « Voyage », ou retirer l'étiquette.
5. **Trous de la référence** (`audit-couverture-creatif.md`, dernière section) : surtout des chaussures (Travail été, Cérémonie automne
   femme ; Soirée homme) et des bas homme (Soirée, Cérémonie). À combler dans la référence avant d'en tirer les fiches.
6. **Pièces unisexes** : #486 lunettes, #580 ceinture tressée, #756 sac crossbody, #926 écharpe oversize — les étiqueter Créatif pour
   l'homme les fait aussi entrer dans les capsules Créatif femme. À accepter ou à exclure.

## 4. Données — à montrer puis à lancer à la main (jamais par moi)

Toutes les écritures sont des AJOUTS : aucun article supprimé, aucun identifiant remplacé, aucune image touchée, aucune autre colonne
modifiée, aucun autre style retiré. Réversibles par l'opération inverse.

**4.1 Équivalents exacts** (après décision 6 sur les unisexes) :

```sql
-- Ajoute « Créatif » aux styles des équivalents exacts, sans rien retirer. Idempotent : un article déjà étiqueté n'est pas touché.
update vestiaire_universel
set styles = case when coalesce(styles, '') = '' then 'Créatif' else styles || ', Créatif' end
where id in (
  710, 817, 973, 1063,                                                                    -- femme
  504, 505, 506, 512, 521, 565, 574, 577, 609, 675, 709, 750, 752, 807, 813, 836, 846,    -- homme
  851, 852, 901, 905, 910, 911, 957,
  486, 580, 756, 926                                                                      -- unisexes (décision 6)
)
and coalesce(styles, '') not like '%Créatif%';
```

**4.2 Pièces transversales** (chaussures d'intérieur #481 et #520, baskets de sport #971 et #972) : même requête, mêmes garanties. Sans
elles, Sport et Cocooning n'ont pas de chaussures Créatif (R-B13 : seules les chaussures d'intérieur sont admises en Cocooning).

**4.3 Bases potentielles validées** : même requête sur la liste arrêtée à la décision 3.

**4.4 Pièces à créer** (manquantes, incompatibles, variantes choisies) : des `insert` de nouvelles lignes, avec de nouveaux identifiants,
renseignées depuis la référence (genre, catégorie, saisons, couleur dominante, matière, manches, occasions, `styles` = « Créatif » et
les styles secondaires de la référence). Les visuels passent par la chaîne existante (`generate-catalog-image`), en `image_status`
« missing » jusqu'à génération. Les colonnes que la référence ne renseigne pas (`hex`, `niveau_formalite`, `meteo_*`) sont signalées,
pas devinées : à fixer à la main ou par la règle existante de l'import du catalogue.

## 5. Application — code, après validation

- `profile.ts` : `creatif` dans `STYLE_IDS`, `STYLE_ID_TO_CATALOG_LABEL` (`Créatif`), `STYLE_CONFIG` femme et homme (libellé, phrase,
  visuel), `VISUELS_ETAPE_STYLE_FEMME`, `EXPOSED_STYLE_IDS` (femme : 9 ; homme : les 6 actuels + `creatif`) ; `romantique` homme inchangé
  (décision 1).
- Visuels : déjà préparés à partir du visuel fourni (femme à gauche, homme à droite), recadrés en 900 × 1200 WebP, comme les autres
  flat lays de l'étape Style.
- `capsule.ts` : une entrée `Créatif` dans `STYLE_FIT`, pour les pièces du dressing (motifs à tirer des traits de la référence :
  graphique, imprimé, color-block, asymétrique, sculptural…). Aucune règle de scoring modifiée.
- `suggestionsAutresStyles.ts` (`STYLE_DU_LIBELLE`) et les écrans qui listent les styles : vérifiés pour le 9e style.
- Tests : identifiants, libellés par genre, `romantique` homme inchangé, `STYLE_FIT` Créatif.

## 6. Mesure avant mise en production (règle d'audit)

Un audit `scripts/creatif.audit.ts` (hors `npm test`), qui lit l'export CSV plutôt que Supabase, mesure dans **la même exécution, sur le
même pool** :

1. baseline : profils femme et homme sans Créatif ;
2. profil Créatif avec les seuls équivalents exacts (4.1 + 4.2, simulés en mémoire) ;
3. profil Créatif avec exacts + bases validées (4.3) ;
4. profil Créatif avec les pièces à créer (4.4, simulées).

Pour chacun, 4 saisons × 8 occasions : seuil de 18 franchi ou non, part de pièces Créatif dans la capsule, tenue complète obtenue par
`generateOutfitWithFallback`, nombre de replis de formalité. Aucune écriture en production avant ce résultat ; toute mesure qui contredit
une conclusion de ce document la rouvre (point 8).

## 7. Préservé

Aucune capsule d'un autre style n'est modifiée : l'ajout d'un libellé à `styles` n'en retire aucun, et le filtre de style d'un profil
Minimaliste, Bohème… ne lit pas « Créatif ». Les huit styles existants, leurs visuels et leurs règles restent tels quels.

## 8. Étape 2 — préparée le 30/10/2026 (rien n'est lancé en production)

Validé par la propriétaire : l'identifiant `creatif`, commun aux deux genres ; « dans les fichiers Excel tu as toutes les pièces » — les
pièces de référence sans équivalent exact sont CRÉÉES depuis l'Excel ; « sous-pull et pull col roulé fin ne sont pas pareils ».

**Application (code, livré)** : `creatif` dans `STYLE_IDS` (libellé « Créatif » femme, « Créatif / Artistique » homme, libellé catalogue
« Créatif »), visuels fournis (`/images/styles/creatif.webp`, `/images/styles/homme/creatif.webp`), proposé aux deux genres ; le style
`romantique` masqué de l'homme n'est pas touché (arbitré le 30/10/2026) ; entrée `Créatif` dans `STYLE_FIT` pour les pièces du
dressing. Tests ajoutés.

**Données (SQL montré, à lancer à la main, dans l'ordre)** — `sql/` :

| Fichier | Contenu | Défaut |
|---|---|---|
| `01-etiqueter-existants.sql` | ajoute « Créatif » à 28 équivalents exacts (1.a) et aux 4 pièces transversales (1.b) | 1.c (4 unisexes) en commentaire, décision en attente |
| `02-creer-pieces.sql` | crée 201 articles hors sport (2.a), tirés des références sans équivalent exact, une pièce présente à plusieurs saisons = un article | 2.b (17 pièces de sport) en commentaire, cf. mesure ci-dessous |
| `02-revue-pieces-a-creer.xlsx` | les mêmes articles, une ligne chacun, pour relecture | — |
| `03-annuler.sql` | retour arrière de 01 et 02 | — |

Points de 02 à valider avant de lancer : couleurs côté femme **proposées** (la colonne de la référence porte la palette de la saison, pas
la couleur de la pièce : ses couleurs connues de l'app sont réparties, 115 lignes marquées « couleur proposée ») ; 11 pièces sans couleur
connue de l'app (listées en fin de fichier) ; `niveau_formalite` proposé par une règle écrite sur les occasions ; 3 ensembles homme non
créés (l'app n'a pas de catégorie « ensemble ») ; occasion « Vacances » écartée. Les visuels se génèrent au premier affichage, par la
chaîne existante (`requestCatalogImage` → `generate-catalog-image`).

**Mesure (`scripts/creatif.audit.ts`, une exécution, même pool, export du 30/10/2026)** — profil Créatif, 4 saisons, 8 occasions,
20 tirages par occasion :

| État du catalogue | Style Créatif | Part Créatif de la capsule | Tenues complètes | Autres styles modifiés (femme / homme) |
|---|---|---|---|---|
| L0 — actuel | ignoré (seuil de 18 non atteint) | 0 % | 100 % | — |
| L1 — + 01 | ignoré, sauf homme automne et hiver | 5 à 14 % (74–76 % homme aut./hiv.) | 100 % | 0 / 32 · 0 / 24 |
| L2 — + 01 + 02 complet (2.a et 2.b) | actif | 85 à 90 % | 100 % | **32 / 32 · 24 / 24** |
| L2s — + 01 + 02.a (sans sport) | actif | 84 à 89 % | 100 %, toutes occasions | **0 / 32 · 0 / 24** |

**DÉMONTRÉ** (sur cet export) : 02.a rend le style effectif dans les deux genres et aux quatre saisons sans toucher aux capsules des
autres styles ; les pièces de sport créées les modifient toutes, parce que le bloc Sport d'une capsule n'est jamais filtré par style
(capsule.ts, arbitrage du 24/08/2026). En L2s, les tenues Sport restent complètes, avec environ 20 à 50 % de pièces Créatif selon les tirages (sport commun du
catalogue étiqueté en 1.b). **NON DÉMONTRÉ** : le rendu des visuels générés pour les nouvelles pièces, et le comportement sur le
catalogue de production s'il a changé depuis l'export.

**Appliqué en production le 31/10/2026** par la propriétaire : `01-etiqueter-existants.sql` (blocs 1.a et 1.b), puis
`02-creer-pieces.sql` (bloc 2.0, recalage du compteur d'identifiants à 1090, et bloc 2.a). Contrôle : 201 pièces créées
(`styles = 'Créatif'`), 32 étiquetées (`styles like '%, Créatif'`). Restent en commentaire, non appliqués : 1.c (4 unisexes) et 2.b
(17 pièces de sport). Ne pas relancer 02 : il recréerait les 201 pièces en double.
