# Évolution de l'onboarding — diagnostic (phase 1) et proposition (phase 2)

31/10/2026. Brief « Évolution de l'onboarding Capsela – Personnalisation stylistique et recommandation centrale ».
Aucune ligne de code modifiée. Rien n'est appliqué avant validation : ni écran, ni migration, ni pondération.

Étiquettes (AGENTS.md) : **DÉMONTRÉ** (mesuré ou lu dans le code), **NON DÉMONTRÉ**, **ARBITRAGE ÉDITORIAL**.

---

## Phase 1 — Audit

### 1.1 Le parcours actuel

| # | Écran actuel | Fichier / clé | Correspondance avec le brief |
|---|---|---|---|
| 1 | Bienvenue (carrousel + compte) | `OnboardingScreen.tsx` | 1. Bienvenue — inchangé |
| 2 | Prénom | `ProfileSetupScreen` · `prenom` | absent du brief (à placer, cf. Q7) |
| 3 | Genre | `genre` | 2. Genre et tailles (fusion) |
| 4 | Tailles | `taille` | 2. Genre et tailles (fusion) |
| 5 | Style (1–2, Créatif inclus) | `style` | 3. Mon style — **déjà livré** |
| 6 | Silhouette | `morpho` | 4. Ma morphologie |
| — | — | — | 5. Mise en valeur — **nouveau** |
| — | — | — | 6. Coupes préférées — **nouveau** |
| 7 | Couleurs préférées | `pal_couleurs` | 7. Couleurs préférées |
| 8 | Intensité | `pal_intensite` | absent du brief (cf. Q7) |
| 9 | Colorimétrie : présentation + 4 questions + analyse | `colorimetrie` | 8. Colorimétrie sur un écran |
| 10 | Résultat palette | `colorimetrie_resultat` | 9. Palette |
| 11 | « Et maintenant ? » | `colorimetrie_suite` | absent du brief (cf. Q7) |
| 12 | Récapitulatif (lecture seule) | `pal_recap` | 10. Profil Capsela, éditable par section |
| 13 | Dressing (ajout d'une pièce) | `actions.openAdd()` | 11. Dressing |

Mécanismes à préserver (DÉMONTRÉ, `ProfileSetupScreen.tsx`) :
- l'édition ciblée : ouvrir une étape depuis le profil ne déroule que cette étape. Exception : le groupe palette, de `pal_couleurs` à `pal_recap`, se parcourt en entier ;
- le retour en édition ramène à l'écran d'appel ;
- la mise en page en deux zones (style, couleurs, colorimétrie) ;
- le fil d'Ariane `SECTIONS`.

### 1.2 Composants concernés

- `ProfileSetupScreen.tsx` : `ALL_STEPS`, `canContinue`, `PALETTE_GROUP`, `SECTIONS`, `recapRows`. C'est là que vivent tous les écrans du parcours.
- `ProfileScreen.tsx` : les lignes éditables (`ouvrirChamp`), la complétude et la prochaine action.
- `profile.ts` : `Profile`, `champsProfilStyle`, `completudeProfil`, `prochaineActionProfil`.
- `colorimetrie.ts` : `QUESTIONS_COLORIMETRIE` (l. 330), `saisonDuQuestionnaire` (l. 413), `colorimetrieUtilisable` (l. 60).
- `colorimetrieMoteur.ts` : l'effet de la colorimétrie près du visage (harmonie et modération) et le métal des bijoux.
- `capsule.ts` : `valeurDirection` et `MORPHOLOGIES_AVEC_DIRECTION`, le seul effet de la morphologie.
- `logic.ts` : `computeLookScore` (R-S1 à R-S18) et `generateOutfitWithFallback`.
- `auth.tsx` : la lecture et l'écriture de la ligne `profiles`.

### 1.3 Le modèle de données (DÉMONTRÉ)

`profiles` (RLS depuis 0001 : lecture, insertion et mise à jour par le seul propriétaire) :
- `styles`, `morphology`, `palette_couleurs`, `palette_intensite` ;
- `palette_affinite` : legacy, lue, plus écrite ;
- `colorimetrie` jsonb, avec `statut` contraint (0034). Il porte `reponses`, `signature`, `neutres`, `moderation`, la saison et une `confiance` facultative ;
- `prefs` jsonb : notifications, météo, jours travaillés. Ce ne sont pas des préférences de style.

| Donnée du brief | Existe ? |
|---|---|
| styles | oui (`styles`, 9 femme / 7 homme) |
| mise en valeur | **non** |
| coupes préférées | **non** |
| cheveux, yeux | oui, en indices dans `colorimetrie.reponses` |
| carnation | **non**, et interdite aujourd'hui (§ 1.6) |
| saison | oui (`colorimetrie`) |
| fiabilité | partiellement : `colorimetrie.confiance` est facultative ; le questionnaire ne la pose pas |

« Audacieux » n'est pas une valeur de style dans le code : c'est une humeur de soirée (`humeur.ts`, Planifier). Je ne peux pas vérifier la base depuis le conteneur. Requête de contrôle, en lecture seule :

```sql
select count(*) from public.profiles where styles::text ilike '%audacieux%';
```

### 1.4 Les règles de recommandation existantes (DÉMONTRÉ)

- **Morphologie.**
  - Elle n'agit qu'à la sélection de la capsule, par `valeurDirection`, et seulement pour `f_poire` et `f_triangle_inverse`.
  - L'axe est lu sur `effetMorphologique` (épaules et hanches).
  - `morphoFit` n'est plus consulté (`rang3: "neutre"`), et R-S9 a été retiré du score le 29/08/2026.
  - **Aucun terme morphologique dans `computeLookScore`** : il n'y a pas de double comptage aujourd'hui.
- **Couleurs.**
  - R-S10 : palette personnelle +10.
  - R-S18 : accord du visage +10, uniquement si `colorimetrieUtilisable`.
  - Bijoux : métal de la saison.
  - Colorimétrie absente ou inutilisable : `colorimetrieMoteur` rend `null`, donc aucun effet et aucune pénalité.
- **Styles.**
  - `styleFit` lit `styleTags`, sinon la regex `STYLE_FIT`.
  - La curation retombe sur la base sous 18 pièces.
  - Créatif est en production (catalogue, visuels, sport C2).
- **Contraintes réelles** (météo, occasion, occasions déclarées des pièces, disponibilité) : ce sont des filtres du moteur, placés avant tout score.

### 1.5 Les assets réutilisables

- **Colorimétrie** (`public/onboarding/colorimetrie/`) :
  - 4 visuels de cheveux et 4 visuels d'yeux, à réutiliser tels quels ;
  - 3 visuels de métal, 3 de blanc, `neutre-lin` et 4 palettes.
- **Styles** : `images/styles/*.webp` (femme) et `images/styles/homme/*.webp` (900×1200).
- **Mise en valeur** (8 visuels) et **coupes** (6 visuels à plat) : **aucun visuel n'existe**. Ils sont à produire (prompts à fournir), ou bien l'écran sort d'abord en cartes typographiques.

### 1.6 Les risques et les écarts — à arbitrer

1. **La carnation contredit une règle du projet.**
   - CLAUDE.md : « Aucune logique fondée sur la couleur de peau ».
   - Un test la verrouille : `colorimetrieSaisons.test.ts:158`, regex `/peau|teint|carnation/`.
   - `docs/colorimetrie.md` signale le RGPD, art. 9 : une teinte de peau peut révéler une origine ethnique, ce qui en fait une donnée sensible.
   - Aucune ligne ne peut s'écrire sans une décision explicite de ta part, et idéalement un avis juridique.
2. **Retirer les questions Bijoux et Blanc casse la saison (DÉMONTRÉ par la règle `saisonDuQuestionnaire`).**
   - La saison dépend du signe de la chaleur ; une chaleur nulle donne « indécis ».
   - Avec les cheveux et les yeux seuls, **5 combinaisons sur 16 sont indécises**, dont les 4 plus courantes : châtain ou brun avec des yeux marron ou très foncés. Les réponses « Je ne sais pas » n'y sont pas comptées.
   - Ce sont précisément les questions Bijoux et Blanc qui départagent ces profils.
   - La carnation, avec des options de clair à foncé, ne mesure que la profondeur : **elle ne résoudrait pas la chaleur**.
3. **Les options de cheveux et d'yeux du brief diffèrent de l'existant**, alors que le brief demande de réutiliser les visuels. Les visuels correspondent aux options actuelles : changer les options imposerait de nouveaux visuels et changerait les règles de saison.
4. **Le catalogue ne porte presque pas de coupe (DÉMONTRÉ, export du 31/10).**
   - 542 pièces sur 627 (86 %) n'ont pas de `coupe` ; le reste se répartit en 70 Ample, 13 Ajusté et 2 Serré.
   - `morphologies` et `details_mode` sont vides à 100 %.
   - Brancher des coupes préférées sur le moteur, sans enrichir le catalogue, produirait un effet quasi nul (NON DÉMONTRÉ tant que ce n'est pas mesuré).
   - La « mise en valeur » n'a aucun attribut de pièce sur lequel s'appuyer, hormis les axes épaules et hanches de `effetMorphologique`.
5. **« Fluides » et « Structurées » n'existent pas dans le type `Coupe`** (Serré, Ajusté ou Ample). Les déduire de la matière (viscose, soie : fluide ; laine, tweed, tailleur : structuré) est un ARBITRAGE ÉDITORIAL à instruire.
6. **Complétude du profil.** Si les nouveaux champs comptent dans `completudeProfil`, les profils existants perdent des points sans rien avoir changé.
7. **Le parcours compte 13 écrans, le brief 11.** Prénom, Intensité et « Et maintenant ? » n'y figurent pas.

---

## Phase 2 — Proposition

### 2.1 Le parcours cible

| # | Écran | Construction |
|---|---|---|
| 1 | Bienvenue | inchangé |
| 2 | Genre et tailles | fusion de `genre` et `taille` sur un écran ; le prénom reste un écran court avant (Q7) |
| 3 | Mon style | inchangé (déjà conforme) |
| 4 | Ma morphologie | inchangé ; facultative comme aujourd'hui |
| 5 | Mise en valeur | nouvelle étape `mise_en_valeur`, facultative, multi-sélection ; « Aucune préférence particulière » exclusive |
| 6 | Coupes préférées | nouvelle étape `coupes`, multi-sélection ; « Cela dépend du vêtement » exclusive |
| 7 | Couleurs préférées | `pal_couleurs`, avec l'intensité intégrée au même écran (Q7) |
| 8 | Votre colorimétrie | un écran, des blocs (cf. 2.2), CTA unique « Analyser ma palette » |
| 9 | Palette | `colorimetrie_resultat` ; « Et maintenant ? » fusionné dedans (Q7) |
| 10 | Profil Capsela | `pal_recap` devient éditable : chaque ligne rouvre son étape en édition ciblée (mécanique existante) |
| 11 | Dressing | inchangé |

Dans **Mon profil**, deux lignes s'ajoutent : « Mise en valeur » et « Coupes préférées ». Elles ne comptent pas dans la complétude (recommandation : ce sont des préférences facultatives, et « aucune » est une réponse valide).

### 2.2 La colorimétrie sur un écran (recommandation)

- Bloc 1, cheveux, et bloc 2, yeux : les visuels et les options actuels, à l'identique.
- Bloc 3 « Pour affiner » : les questions Bijoux et Blanc, conservées et présentées en vignettes compactes. Sans elles, les profils bruns aux yeux marron restent sans saison (§ 1.6-2).
- « Je ne sais pas » sur chaque bloc. Le CTA est actif dès qu'un bloc est rempli ; l'écran « indécis » existant reste le repli.
- Les règles de saison, le contrôle `colorimetrieUtilisable`, les effets près du visage et sur les bijoux, et l'absence de pénalité restent inchangés.
- **Carnation**, deux options :
  - **A (recommandée)** : ne pas la collecter. Elle ne départage pas la chaleur et ouvre un risque RGPD.
  - **B** : la collecter, facultative, avec un consentement explicite, effaçable, et un effet limité à la profondeur (±1 au plus, jamais seule décisive). Il faudrait alors rouvrir la règle de CLAUDE.md et son test, et obtenir un avis juridique. ARBITRAGE.

### 2.3 Les données

Une seule colonne jsonb nullable, sur le modèle de `colorimetrie` (0034) :

```sql
-- 0054_profiles_preferences_silhouette.sql (NON APPLIQUÉ — à valider)
alter table public.profiles
  add column if not exists preferences_silhouette jsonb;   -- null = jamais renseigné
-- forme : {"version":1,"miseEnValeur":["taille","jambes"]|[],"coupes":["fluides"]|["depend"]}
-- [] = « aucune préférence » déclarée ; null = question jamais posée : la différence est conservée.

-- Retour arrière :
-- alter table public.profiles drop column if exists preferences_silhouette;
```

- RLS : les politiques existantes de `profiles` couvrent la colonne. Rien à ajouter.
- Anciens profils : `null`, donc aucun effet et aucun écran forcé.
- Écriture isolée de la sauvegarde du profil, comme le veut la règle de CLAUDE.md : avant la migration, le reste du profil s'enregistre et l'échec de ce seul champ est signalé à l'écran.
- Cheveux, yeux, saison et fiabilité restent dans `colorimetrie`. La carnation n'irait dans `colorimetrie.reponses` que si l'option B est retenue.

### 2.4 Le branchement moteur et les pondérations (à valider, puis à mesurer)

Le principe : tout se passe à la **sélection de la capsule**, là où agit déjà la morphologie, et rien dans `computeLookScore`. Le score ne porte aucun terme morphologique ; y ajouter les préférences créerait le double comptage que le brief veut éviter.

| Levier | Proposition | Si l'information manque |
|---|---|---|
| Coupes préférées | bonus de sélection pour une pièce dont la coupe connue est préférée ; jamais d'exclusion | coupe de la pièce inconnue, ou « Cela dépend » : 0 |
| Mise en valeur des épaules ou des hanches | **neutralise** `valeurDirection` sur l'axe concerné : la préférence explicite l'emporte sur le conseil morphologique | non renseignée : comportement actuel |
| Autres zones (jambes, décolleté, dos…) | aucun effet tant qu'aucun attribut de pièce ne les porte. Stockées, affichées dans le profil, sans phrase « sert à » | — |
| Styles et Créatif | inchangés : `styleTags`, couleurs, imprimés (`statement`) et accessoires passent déjà par le style | — |
| Contraintes réelles | inchangées, toujours avant | — |

Poids du bonus « coupe » : à fixer en dessous de `styleFit`, pour que le style garde la cohérence, et au niveau de `valeurDirection`. Je propose de mesurer trois valeurs candidates dans un audit (`SelectionStrategy.coupesPreferees`, absent par défaut), sur le même pool et dans la même exécution, avant de choisir. Aucune valeur n'est appliquée sans ton accord.

Préalable pour que le levier serve à quelque chose : enrichir la colonne `coupe` du catalogue (542 pièces), par un SQL relu, sans écraser les valeurs déjà présentes. C'est un lot distinct.

### 2.5 Les lots proposés

1. **Données et profil** : la migration (montrée avant), le champ dans `Profile`, la lecture et l'écriture isolées, les deux lignes dans Mon profil. Aucun effet moteur.
2. **Écrans** : Genre et tailles fusionnés, Mise en valeur, Coupes, Profil Capsela éditable. Cartes typographiques, puis visuels quand ils sont fournis.
3. **Colorimétrie** sur un écran (2.2), sans changement de règle de saison. Le test de non-régression des 16 combinaisons est à écrire.
4. **Moteur** : audit des leviers coupe et neutralisation, puis la pondération présentée, puis l'application.
5. **Catalogue** : l'enrichissement des coupes (SQL).

Les tests (phase 4) : les 13 cas du brief, rattachés aux lots ; plus le maintien du test « aucune question sur la peau » si l'option A est retenue.

---

## Questions à trancher

1. **Carnation** — **TRANCHÉ le 31/10/2026 par la propriétaire : option A.** La carnation n'est pas collectée ; la règle de CLAUDE.md et son test restent en vigueur.
2. **Bijoux et Blanc** : les garder sur l'écran unique en bloc « Pour affiner » (recommandé), ou accepter que les profils bruns aux yeux marron finissent sans saison ?
3. **Options de cheveux et d'yeux** : garder les options et visuels actuels (recommandé), ou adopter celles du brief, ce qui demande de nouveaux visuels et de nouvelles règles ?
4. **Fluides et Structurées** : les déduire de la matière (à instruire), ou les stocker sans effet moteur au départ ?
5. **Complétude** : les nouveaux champs restent-ils hors du pourcentage (recommandé) ?
6. **Visuels** : je fournis les prompts pour les 8 et 6 visuels ; l'écran sort-il d'abord en cartes typographiques ?
7. **Prénom, Intensité, « Et maintenant ? »** : prénom avant Genre et tailles, intensité dans Couleurs préférées, « Et maintenant ? » fusionné dans Palette — d'accord ?
