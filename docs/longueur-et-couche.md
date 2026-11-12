# Longueur et couche des pièces du dressing

12/11/2026. Retour d'une testeuse : « robe longue noire + kimono + manteau court ». Sur une pièce ajoutée à la main, le moteur ne connaît
que ce que dit son nom : il ne sait ni la longueur d'une robe ou d'un manteau, ni si une veste est structurée (blazer) ou fluide (kimono).
Choisi par la propriétaire : demander ces deux attributs à l'ajout de la pièce, et les lire sur la photo.

## Ce qui est en place

- **Deux attributs facultatifs** (`src/lib/forme.ts`) : la longueur (courte, midi, longue) d'une robe, d'une jupe, d'un manteau ; la
  couche (structurée, fluide) d'une veste. Jamais déduits d'un nom : sans valeur, la pièce est inconnue et le moteur la traite comme avant.
- **Colonnes `longueur` et `couche`** de `dressing_items`, migration `0062_longueur_couche.sql`, à exécuter à la main. Avant la migration,
  les deux champs ne sont pas proposés et rien ne casse (`formeDisponible`, écriture isolée `updateDressingItemForme`, jamais dans
  `itemToRow`).
- **Formulaire d'ajout** : « Longueur » et « Structure », après le motif, avec « Détecté par Capsela », « Modifié par toi », « Rétablir ».
  La fiche de la pièce les affiche quand ils sont renseignés.
- **Analyse de la photo** (`analyze-dressing-photo`) : les propose, seulement pour leurs catégories et dans leurs listes (attributs du
  VÊTEMENT, jamais de la personne). Les listes sont partagées avec `_shared/enumsPiece.ts`, un test le verrouille. La fonction Edge doit
  être redéployée pour que la photo les remplisse.

## Ce qui reste à arbitrer, puis à mesurer avant d'être branché

Aucune règle du moteur ne lit encore ces attributs. Propositions :

1. Une veste fluide ne se porte pas sous un manteau : par le froid, le manteau la remplace au lieu de s'y ajouter.
2. Les proportions robe / manteau : ce qui est exclu doit être dit précisément (une veste courte sur une robe longue est un accord courant).

Chaque règle passera par un levier inactif et une mesure avant / après dans la même exécution (règle d'audit, AGENTS.md).
