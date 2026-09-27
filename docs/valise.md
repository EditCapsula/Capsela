# Capsela — Préparer sa valise

Sep 27, 2026 · @Angela

Ce document décrit le lot 1 de « Préparer sa valise », développé le 27/09/2026 d'après la maquette « Capsela · Exploration · Préparer sa valise ». Il documente le comportement réel du code ; la section « Lot 2 » est signalée comme à venir.

Les statuts reprennent la légende de `docs/avis-de-styliste.md` : **[DÉCIDÉ]**, **[RECOMMANDÉ]**, **[À ARBITRER]**, **[HYPOTHÈSE TECHNIQUE]**. Les seuils choisis sans mesure sont marqués **ARBITRAGE ÉDITORIAL**, au sens de la règle d'audit (AGENTS.md).

## 1. Principe

« Une valise. Plus de looks. Moins de pièces. » Capsela choisit **les pièces de ton dressing** à emporter, puis le moteur de tenues existant (`generateOutfitWithFallback`) compose les looks avec ces seules pièces. Il n'y a pas de second moteur : un choix de pièces, puis le moteur unique. [DÉCIDÉ]

Tout ce qui s'affiche est compté, jamais estimé : « 8 pièces → 6 looks », ce sont 6 tenues réellement produites par le moteur avec ces 8 pièces. La formule combinatoire « N looks possibles » a été retirée de Capsule le 22/09/2026 (erreur de ×0,5 à ×1,7) et n'est pas réintroduite. [DÉCIDÉ]

## 2. Parcours (lot 1)

| Étape | Question | Ce qu'elle fait |
| --- | --- | --- |
| 1 / 4 | Où pars-tu ? + dates | Ville (autocomplétion de Planifier), départ et retour ; « 5 jours · 4 nuits ». Séjour de 21 jours au plus |
| 2 / 4 | Quel bagage prends-tu ? | Fixe la capacité (section 3) |
| 3 / 4 | Quel type de séjour ? | Présélectionne les occasions de l'étape 4, rien d'autre (section 4) |
| 4 / 4 · facultatif | Qu'est-ce qui est prévu ? | Occasions du séjour (plusieurs). « Passer cette étape » garde la présélection du séjour, sinon « Quotidien » |
| Chargement | Je prépare ta valise | Prévision du lieu, puis choix des pièces sur l'appareil |
| Résultat | Ta valise | Carte héros, jauge, onglets Pièces et Looks, « Retirer », « Modifier », « Nouvelle valise » |

Entrée : « Préparer une valise » sur l'Accueil (« Et si on préparait la suite ? »), selon la règle d'accès `PREPARER_VALISE` (section 7).

**Écarts assumés avec la maquette** — chaque élément ci-dessous serait faux à l'écran s'il était repris tel quel :

- Pas de « Comment voyages-tu ? » au lot 1 : la question ne sert qu'à la tenue de trajet (lot 2), et « On s'en sert pour ta tenue de trajet » serait faux. [DÉCIDÉ]
- Pas de « lieux favoris » : l'app n'en enregistre aucun. À la place, « Tes lieux planifiés » : les villes de tes tenues planifiées, des lieux réellement donnés. [DÉCIDÉ]
- Pas de noms de looks inventés (« Balade dans l'Alfama ») : un look porte le nom de son occasion. [DÉCIDÉ]
- Pas de durée de trajet (« Avion · 2 h 30 ») : aucune donnée. [DÉCIDÉ]
- « 4 pièces polyvalentes couvrent 9 situations » devient « N pièces reviennent dans 3 looks ou plus » : une définition affichée telle quelle. [DÉCIDÉ]
- Pas d'onglets Trajet ni Checklist au lot 1 : un onglet vide est une promesse, pas une fonction. [DÉCIDÉ]
- Le détail d'un look n'est pas ouvrable au lot 1 : l'écran de détail existant est construit autour d'une pièce pivot. [À ARBITRER : lot 2]

## 3. Capacité par bagage

| Taille | Libellé | Capacité |
| --- | --- | --- |
| S | Cabine souple | 8 pièces |
| M | Cabine | 12 pièces |
| L | Soute moyenne | 18 pièces |
| XL | Grande soute | 24 pièces |

Chaussures, sacs et accessoires compris ; ne dépend que de la taille, quel que soit le transport. **ARBITRAGE ÉDITORIAL** du 27/09/2026 (proposé, validé). [DÉCIDÉ]

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

Le type de séjour n'entre pas dans le moteur, qui ne connaît que des occasions. **ARBITRAGE ÉDITORIAL**, instruit type par type (liste « provisoire » de la maquette) : il ne s'étend pas à un type ajouté plus tard sans le même examen. [DÉCIDÉ]

## 5. Météo du séjour

- Prévision du lieu (`fetchPrevisionByCity`) pour chaque jour qu'elle couvre (4 jours), en « Toute la journée ».
- Au-delà, la règle de Planifier : **saison de la date, température d'aujourd'hui**, et l'écran le dit (« Pas encore de prévision pour ces dates… »).
- « 16° – 24° prévus sur place » n'apparaît que si tous les jours sont prévus ; « prévus sur 2 jours » si seulement une partie ; rien sinon. [DÉCIDÉ]

## 6. Choix des pièces (`src/lib/valise.ts`, testé)

1. **Situations** : une occasion sous une météo. Les jours de même météo (même saison, température à 3° près, même condition) ne font qu'une situation par occasion.
2. **Tirages** : 10 tenues du moteur par situation, dans le dressing entier. Deux tenues qui ne diffèrent que par un accessoire sont le même look.
3. **Couvrir** : tant qu'une situation n'a pas de look, la tenue qui en couvre une en ajoutant le moins de pièces. Jamais au-delà de la capacité ; une situation qui n'y tient pas reste sans look, et l'écran le dit.
4. **Alléger** : retirer toute pièce dont l'absence garde chaque situation couverte et ne coûte pas plus d'un look.
5. **Enrichir** : tant qu'il y a moins d'un look par jour, ajouter ce qui rapporte au moins un look par pièce ajoutée ; au-delà, seulement ce qui en rapporte au moins deux.
6. **Looks finaux** : nouveaux tirages du moteur sur les seules pièces choisies. Une pièce qui ne figure dans aucun look final est laissée au placard.

Seuils (un look par jour, deux looks par pièce, 3 looks pour « polyvalente ») : **ARBITRAGE ÉDITORIAL**, à revoir sur des dressings réels. [DÉCIDÉ]

Une tenue dont le moteur a dû élargir l'occasion est gardée et le dit (« Occasion élargie »), comme sur Tenue. [DÉCIDÉ]

**Retirer** une pièce recompte les looks avec les pièces restantes (même fonction, `looksDeLaValise`). Une pièce devenue sans look l'affiche (« Dans aucun look de la valise »). [DÉCIDÉ]

**Jauge** (4 états, aucune alerte rouge) : ≤ 50 % Valise légère, ≤ 85 % Optimisée, ≤ 100 % Presque pleine, au-delà Capacité dépassée (inatteignable au lot 1, où rien n'ajoute de pièce au-delà de la capacité). [DÉCIDÉ]

Uniquement le dressing réel : on n'emporte pas une pièce qu'on n'a pas. Dressing vide : l'écran le dit et propose d'ajouter une pièce. [DÉCIDÉ]

## 7. Accès

Règle `PREPARER_VALISE` dans `REGLES_ACCES` (`src/lib/autorisations.ts`, copie serveur pour le test miroir) :

- Fonctionnalité **Premium** (annoncée sur la page Premium, sans « Bientôt » depuis le 27/09/2026). [DÉCIDÉ]
- **Phase de test : `ACCES_LIBRE`**, comme l'Avis de styliste, pour que la propriétaire puisse l'essayer en production sans abonnement. Au lancement : repasser à `PREMIUM_REQUIRED` des deux côtés. Aucun appel serveur ne sert la valise, rien à redéployer. [DÉCIDÉ]
- Sous `PREMIUM_REQUIRED`, la règle commune du 25/09/2026 s'applique : Premium confirmé → parcours ; statut inconnu → vérification, puis page Premium s'il reste inconnu ; sinon page Premium avec « Ce que tu voulais faire : Préparer une valise ». [DÉCIDÉ]

## 8. Conservation

Lot 1 : la valise est gardée **sur l'appareil** (`localStorage`, clé `capsela.valise.<userId>`), rouverte telle quelle tant que la date de retour n'est pas passée. [HYPOTHÈSE TECHNIQUE]

## 9. Lot 2 (à venir)

- Onglet **Trajet** : « Comment voyages-tu ? », tenue de trajet, pièces portées sur soi **hors capacité** (cas B, validé), carte « bas de contention » reprise de Tenue. [DÉCIDÉ : cas B]
- Onglet **Checklist** (cocher ne change rien d'autre : ni Journal, ni historique de port).
- **Remplacer**, **Optimiser** (capacité dépassée), **Porter pendant le trajet**.
- **Enregistrement en base** : table `valises`, migration 0038 montrée avant. [À ARBITRER : schéma]

## 10. Fichiers

| Fichier | Contenu |
| --- | --- |
| `src/lib/valise.ts` | Bagages, séjours, situations, choix des pièces, looks, jauge |
| `src/lib/__tests__/valise.test.ts` | Tests (générateur de test et vrai moteur à aléa fixé) |
| `src/components/screens/ValiseScreen.tsx` | Parcours, chargement, résultat |
| `src/lib/autorisations.ts`, `supabase/functions/_shared/premium.ts` | Règle `PREPARER_VALISE` |
| `src/components/screens/HomeScreen.tsx` | Entrée « Préparer une valise » |
| `src/components/screens/PremiumScreen.tsx` | Avantage sans « Bientôt » |
