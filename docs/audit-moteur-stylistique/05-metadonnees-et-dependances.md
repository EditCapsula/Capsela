# 05 — Métadonnées et dépendances

Type `Item` : `src/lib/types.ts:134–`. « Défaut » = ce que fait le code quand la valeur est absente (`undefined`/`null`).

## Champs de la pièce lus par le moteur

| Champ | Source | Valeurs | Défaut si absent | Fonctions qui le lisent |
|---|---|---|---|---|
| `cat` | saisie / catalogue | 14 `CategoryKey` | — (requis) | tout le moteur ; catégories absentes de `CAT_GENDER` → masculin |
| `season` | saisie (déduite des `saisons`) / catalogue | `Printemps / Été`, `Automne / Hiver`, `Toutes saisons` | — | `estDeSaison` (277) |
| `saisons` | dressing (migration 0040) | 4 saisons | retombe sur `season` | `estDeSaison` ; **le commentaire du type dit « le moteur ne lit que `season` » : faux depuis le 27/09** (anomalie A9) |
| `niveauFormalite` | catalogue (`niveau_formalite`) | 0 / 1 / 3 / 4 | déduit du **nom** par `formalityOf` (`attributes.ts:386`) : sport (mots-clés) 0 ; soie/tailleur… en robe 4 ; tailleur/blazer/escarpin/chemise… 3 ; sinon 1 | R-B3, R-B2, R-B11, `isSportPiece`, capsule |
| `rolePiece` | catalogue / dressing | base, calque, piece_unique | déduit : types « jamais en calque » (t-shirt, débardeur, polo…) → base ; coupe ample → calque ; sinon base ; hors haut/pull → piece_unique | R-B8, R-B9, R-S11, R-S12, D-13, D-14 |
| `coupe` | dressing | Serré, Ajusté, Ample… | déduite du nom (`oversize|large|ample|évasé`, `ajusté|moulant|slim|cintré|côtelé`) sinon « regular » | R-B4, rôle de la pièce |
| `subtype` | dressing / catalogue (texte libre) | non normalisé | — | R-B10 (Chemise/Chemisier), mailles fermées, col roulé, R-S17 |
| `shoeType` | dressing (requis pour des chaussures) | 13 types (`types.ts:78–90`) | — | R-B6, R-B11, R-B13, R-B21, R-B22, R-S16 |
| `occasion` | dressing (déclarée) ; catalogue (`occasions`) | liste | pièce du dressing : suggérée par catégorie à l'ajout (`OCCASIONS_DEFAULT_BY_CAT`) ; vide = aucune restriction | D-02, exemption de R-B3 |
| `meteoMinTemp` / `meteoMaxTemp` | catalogue | °C | jamais filtré | D-01, R-B18, collants, capsule |
| `necessiteSoleil` | catalogue | booléen | lunettes reconnues par type/nom (`necessiteLeSoleil`) | R-B15 |
| `resistePluie` | catalogue | booléen | non préférée | R-B16 |
| `manches` | dressing (migration 0042) | courtes/longues… | « inconnue » : comportement d'avant | D-08, D-10 |
| `worn` | action « porter » (store) | jours depuis le dernier port ; `null` = jamais | `null` : ignoré | R-S15, `repetitionWeight`, R-B7 — **ne vieillit pas** (A6) |
| `styleTags` | catalogue | libellés de style | détection par regex du nom (`STYLE_FIT`) | `harmonize` (style), capsule |
| `morphologyTags` | catalogue | — | regex `MORPHO_FIT` | **plus lu en production** (A3) |
| `statement` | catalogue | booléen | déduit (mots du nom ; couleur non neutre ; design bijou) | R-S5, R-S7, sélection de capsule |
| `metalDominant` | catalogue | or / argent | regex « doré / argenté » | R-S4, bijoux de la colorimétrie |
| `matiere` | dressing | liste | nom → défaut par catégorie (chaussures, sac : Cuir ; bijou, accessoire : Synthétique ; manteau, veste, pull : Laine) → « Coton » | R-S8 |
| `hex` / `color` | saisie / catalogue | `PALETTE` 51 teintes | repli `FALLBACK_HEX` = couleur **inconnue** | R-S1, R-S2, R-S3, R-S6, R-S10, colorimétrie |
| `tonsCouleur` / `intensiteCouleur` | catalogue | chauds/froids/les_deux ; douce… | déduits du hex | capsule (`paletteFit`) |
| `estBasiqueCapsule` | catalogue | booléen | faux | capsule (`pickBestMarginal`) |
| `genre` | catalogue | femme/homme/unisexe | — | capsule (filtre si ≥ 16 restantes) |
| `createdAt` | dressing | timestamp | — | Journal (états de port), pas le moteur |

## Profil et contexte

| Donnée | Utilisée par | Défaut |
|---|---|---|
| `gender` | collants (femme seulement), capsule, accords | `null` : capsule « femme », pas de collants |
| `styles` (ids) | capsule (`styleFit`), pas la génération de tenue | sans style : pas de filtre |
| `morphology` | capsule (`f_poire`, `f_triangle_inverse` seulement) ; **paramètre de `computeLookScore` jamais lu** | `null` : aucun effet |
| `paletteCouleurs`, `paletteAffinite`, `paletteIntensite` | R-S10, `candidatsCouleur`, `paletteFit` (capsule) | vide : aucun effet |
| `colorimetrie` | `colorimetrieMoteur` : seulement si `statut = faite` ET au moins une `signature` | inactive |
| `prefs` (rythme, `geoConsent`…) | occasion par défaut, météo | — |
| `workMode` | formalité (Télétravail 1, sinon 3), maison, entretien | « Présentiel » |
| `dateContext` | formalité de l'occasion « date » (`DATE_CONTEXT_FORMALITY`) | « Verre » |
| Météo (`Weather`) | `temp`, `label` (pluie `isRainy`, soleil `isSunny`), `seasons`, `saisons` | — |

## Constantes qui conditionnent le comportement

`SEUIL_SOIREE_FRAICHE` 21 (`logic.ts:342`) · `SEUIL_CHAUSSURES_D_ETE` 15 (58) · short exclu ≤ 22 (881) · `MAX_ATTEMPTS_PER_TIER` 20 (1666) · `DIVERSITY_SCORE_TOLERANCE` 5 (2434) · `FENETRE_JOURS` 5, `CANDIDATS_DIVERSITE` 16, `MARGE_PERTINENCE` 12, `PENALITE_MAX` 100 (`diversite.ts`) · `REPRESENTATIVE_TEMP` Printemps 14, Été 24, Automne 12, Hiver 7 (`capsule.ts:101`) · `CHALEUR_HORS_SAISON` 24 (188) · bucket météo ≥ 20° = « Printemps / Été » (16) · `CAPSULE_MAX_PIECES` 40, quotas 7/6/3/5/3/4/2 (`capsule.ts` 383, 400).

## Dépendances

- **Base** : `vestiaire_universel` (catalogue, lecture), `dressing_items` (pièces réelles, `worn`), `profiles` (jsonb `colorimetrie`), tables d'historique et de plans. Les migrations sont exécutées à la main (CLAUDE.md) : une colonne non migrée (`saisons`, `manches`, `motif`) retombe sur le comportement d'avant.
- **Interface** : le moteur lit l'état du store (`state.items`, `history`, `tenuesPlanifiees`, `workMode`, `dateContext`) ; plusieurs écrans appliquent des règles autour de lui (R-B9 à l'enregistrement, quota « Autre idée »).
- **Aucune lecture** n'a été faite des politiques RLS ni des Edge Functions dans cet audit.
