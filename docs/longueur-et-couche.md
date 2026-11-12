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

## Les règles (12/11/2026)

- **Un kimono se porte sous un manteau**, à condition d'être porté sur une pièce principale (arbitré) : c'est déjà R-B9. La couche
  (structurée / fluide) ne crée donc aucune règle ; le kimono n'est l'exemple d'aucune des deux (il peut être l'un ou l'autre).
- **R-B25, la longueur des couches** (validé : « une veste portée sous un manteau ne doit pas être plus longue que lui »). La longueur
  se renseigne aussi pour les vestes. ACTIVE (levier de mesure `sansLongueurDesCouches`), seulement quand les deux longueurs sont connues :
  1. le moteur prend un autre manteau, assez long, parmi ceux que les règles admettent — la tenue garde sa veste ;
  2. à défaut, la veste qui dépasse quitte la tenue — sauf la veste qui compense la formalité de l'occasion (un blazer en travail ou en
     soirée) ;
  3. dans ce dernier cas (arbitré), « Pour l'extérieur » propose un manteau de la CAPSULE assez long (longueur connue) qui fonctionne avec
     la tenue ; sinon, par le froid seulement, il affiche « Pour finaliser ta tenue — Tu devrais porter un manteau plus long pour rester au
     chaud tout en conservant l'harmonie de ta silhouette. » (`separerCoucheExterieure`, `ConseilManteauPlusLong`).
- Mesure (`scripts/longueur-couches.audit.ts`, exécution n° 33, pire cas : vestes longues, manteaux courts) : vestes qui dépassent
  48,8 → 0 % en quotidien, 46,5 → 0 % en rendez-vous ; travail et soirée inchangés (la veste de formalité reste, le point 3 s'applique) ;
  0 tenue incomplète, aucune occasion relâchée de plus. DÉMONTRÉ sur ce scénario ; en usage réel, NON DÉMONTRÉ tant que les longueurs ne
  sont pas saisies.
- Le catalogue n'a pas de longueur : un manteau de la capsule n'est proposé comme « assez long » que si sa longueur est connue. Tant que
  `vestiaire_universel` n'a pas cette colonne, c'est le conseil qui s'affiche.
