# Colorimétrie — questionnaire et moteur de tenues

Arbitrages de la propriétaire, 30/09/2026 :

- quatre saisons ;
- le questionnaire seul — « pas d'analyse photo pour le moment » ;
- un effet réel sur les tenues : « on doit tenir compte de la colorimétrie
  dans les recommandations de tenues ».

## Le parcours (refonte UX/UI du 30/09/2026)

Brief « Refonte UX/UI du parcours colorimétrie » : plus court, plus éditorial,
orienté conseil. La logique (`saisonDuQuestionnaire`, `SAISONS`, le moteur)
n'a pas changé ; seuls le questionnaire et les écrans ont évolué.

1. **Présentation** : titre, sous-titre, trois repères (environ 1 minute,
   sans photo, résultat personnalisé), « Commencer », « Passer pour
   l'instant ».
2. **Quatre questions** (`QUESTIONS_COLORIMETRIE`) : métal, blanc près du
   visage, couleur de cheveux d'origine, couleur des yeux. Une réponse se
   choisit, puis « Continuer » (« Voir mon résultat » à la dernière). La
   progression « 1 / 4 » remplace le fil de l'onboarding pendant les
   questions : un seul compteur à l'écran. Le retour de l'en-tête remonte
   d'une question (`colorimetrieParcours.ts`).
3. **Analyse** : 1,7 s (0,9 s en mouvement réduit). Le calcul est instantané ;
   l'écran relit les éléments réellement croisés, puis passe la main.
4. **Résultat** : la saison en titre, sa phrase, le nuancier (signature,
   neutres, à porter avec modération), le visuel éditorial quand il
   correspond à la saison, « Pourquoi cette palette ? » (une ligne par
   réponse, relue depuis `colorimetrie.reponses`), et « Ta palette est un
   repère, pas une règle ».
5. **Et maintenant ?** : trois bénéfices, chacun vrai dans le moteur ;
   « Continuer mon profil », « Modifier ma colorimétrie » (reprend le
   questionnaire avec les réponses données).
6. **Pas de saison nette** : jamais un échec. L'écran dit ce que cela
   signifie ; « Continuer » garde les préférences de couleurs seules,
   « Refaire le questionnaire » repart de zéro.

**Aucune question ne porte sur la peau** (vérifié par les tests). Chaque
réponse ajoute des points sur deux axes, la chaleur et la profondeur. Une
chaleur nulle (« Je ne sais pas », « Les deux ») ne tranche pas.

La question « Quelles couleurs te valent le plus de compliments ? » a été
retirée, parce que le brief la juge trop subjective. Sur toutes les
combinaisons de réponses, dans la même exécution, la répartition bouge à
peine : « pas de saison nette » passe de 17,2 % à 18,8 %, et chaque saison
reste à moins de 1,5 point (**DÉMONTRÉ**, sur l'énumération des réponses,
pas sur des profils réels).

Les réponses sont enregistrées dans `profiles.colorimetrie`, un jsonb, sous
`reponses`. Aucune migration n'est nécessaire, car la contrainte de 0034 ne
porte que sur `statut`. Un profil plus ancien n'a pas ces réponses : son
résultat s'affiche sans « Pourquoi cette palette ? ».

### Les visuels

Le ZIP fourni (`Capsela_Onboarding_Visuals.zip`) contient des découpes de la
maquette, avec du texte d'interface et des boutons radio : il a servi de
référence. Les visuels affichés sont ceux fournis ensuite en haute
définition, le 30/09/2026, recadrés et compressés dans
`public/onboarding/colorimetrie/` (WebP, environ 580 Ko au total). La
maquette complète n'est pas affichée.

- **Un visuel de résultat par saison** (fournis le 30/09/2026) : tissus
  drapés aux couleurs de la saison, relus un par un. Aucun ne montre les
  teintes « avec modération » de sa saison. Toutes les vignettes de réponse
  viennent désormais de sources HD (288 px servis pour 44 px affichés).
- « Je ne sais pas » reçoit un lin beige uni, neutre : il ne suggère
  aucune réponse.

Chaque saison (`SAISONS`) porte des couleurs signature, des neutres et des
couleurs « avec modération », toutes prises dans `PAL_COULEURS`.

**ARBITRAGE ÉDITORIAL** : les points de chaque réponse, les phrases de
« Pourquoi cette palette ? » (vérifiées par les tests contre les points :
« chaude » vient d'une chaleur positive, etc.) et les couleurs de chaque
saison, à revoir sur des profils réels.

## L'effet sur les tenues (`src/lib/colorimetrieMoteur.ts`)

Le principe des saisons : une couleur agit surtout **près du visage**. Hauts,
pulls, robes, combinaisons, vestes, manteaux, foulards et écharpes y sont ;
bas, chaussures, sacs et ceintures n'y sont pas.

1. Près du visage, une couleur « avec modération » est évitée quand une autre
   pièce convient. Elle n'est jamais retirée des tenues : elle reste possible
   en bas, en chaussures, en sac, et près du visage faute d'alternative.
2. Près du visage, ses couleurs préférées et celles de sa saison (signature
   et neutres) sont préférées, au même titre les unes que les autres.
3. Les bijoux suivent le métal de la saison : doré pour Printemps et Automne,
   argenté pour Été et Hiver.
4. R-S18 : +10 au score d'une tenue dont une pièce du visage est de sa saison
   et aucune « avec modération ». C'est un bonus seulement : aucune pénalité,
   donc aucun bandeau.

Loin du visage, la préférence de palette d'origine (R-S10) s'applique seule,
à l'identique. Aucune de ces règles n'écarte une catégorie ni ne vide un
tirage.

Toute la génération en tient compte : tenue du jour, exploration de style,
Planifier, valise, idées du Dressing vide, « Comment porter cette pièce ? »
et « Jamais portées ». Pour les idées autour d'une pièce, la teinte de cette
pièce est tenue pour accordée, sinon une pièce « avec modération » ne
sortirait jamais de ses propres idées.

### Deux palettes, une correspondance

Les pièces du dressing prennent leurs couleurs dans `PALETTE` (27 teintes,
`data.ts`), la colorimétrie dans `PAL_COULEURS` (21 teintes). Seules neuf
ont le même hex. La couleur la plus proche en RGB se trompe (Chocolat →
Bordeaux, Corail → Camel, Bleu ciel → Beige), donc la correspondance est
écrite à la main (`TEINTE_DU_DRESSING`). Vert sauge n'a pas d'équivalent
honnête : la colorimétrie ne dit rien de ces pièces, ni des pièces sans
couleur renseignée.

## Mesure (`scripts/colorimetrie-moteur.audit.ts`)

Trois bras dans la même exécution, avec la même graine pour chaque tirage :

- « avant », sans colorimétrie ;
- « union », la règle retenue ;
- « palier », une première version où « préférée ET de la saison » passait
  avant tout, conservée comme levier `strategie`.

La mesure couvre 4 saisons × 2 préférences (aucune ; Noir + Marine + Camel)
× 10 occasions × 40 tirages.

**Périmètre** : le scénario A a tourné sur le catalogue de repli
(`catalog.ts`, sans styles), car Supabase n'est pas joignable depuis
l'environnement de développement. Le scénario B porte sur un dressing
synthétique de 36 pièces. Rien ne s'extrapole d'un scénario à l'autre, ni
au catalogue réel.

### Pièce « avec modération » près du visage

Part des tenues qui en contiennent une :

| Scénario | Saison | Sans préf. avant → après | Noir+Marine+Camel avant → après |
|---|---|---|---|
| A capsule | Printemps | 14,4 → 3,8 % | 23,7 → 3,8 % |
| A capsule | Été | 26,3 → 16,1 % | 34,4 → 16,4 % |
| A capsule | Automne | 22,4 → 7,0 % | 26,9 → 6,9 % |
| A capsule | Hiver | 16,4 → 15,1 % | 15,5 → 15,1 % |
| B dressing | Printemps | 57,1 → 0,0 % | 66,3 → 0,0 % |
| B dressing | Été | 51,5 → 0,0 % | 66,0 → 0,0 % |
| B dressing | Automne | 64,3 → 32,4 % | 72,3 → 32,6 % |
| B dressing | Hiver | 23,1 → 0,0 % | 34,0 → 0,0 % |

### Conclusions

- **DÉMONTRÉ** (dans ces deux scénarios) :
  - la part de tenues avec une couleur « avec modération » près du visage
    baisse dans toutes les cellules ;
  - la pièce principale (haut ou robe) est plus souvent de la saison, par
    exemple de 33 % à 100 % en Automne sans préférence (B) ;
  - aucune tenue n'est perdue (même nombre de tirages sans tenue dans les
    deux bras) ;
  - les couleurs « avec modération » restent aussi présentes loin du
    visage : elles sont déplacées, pas retirées ;
  - une couleur préférée reste dans 97 à 100 % des tenues.
- **Coût DÉMONTRÉ** : moins de tenues distinctes.
  - B sans préférence : 1 012 → 704 à 812 (−20 à −30 %).
  - B avec préférence : 855 → 573 à 677.
  - La version « palier » tombait à 257 à 581, d'où le choix de l'union.
- **Résidus expliqués par les données** : quand le pool n'offre aucune autre
  pièce du visage, la règle laisse la pièce « avec modération ». Exemples :
  en B Automne, un foulard rose poudré et une écharpe noire, tous deux
  « avec modération » ; en A Hiver, une capsule dont le manteau est camel.
- **NON DÉMONTRÉ** : l'effet sur le catalogue réel (623 pièces), à mesurer
  avec cet audit une fois Supabase joignable ; la justesse du questionnaire
  lui-même.
- **ARBITRAGE ÉDITORIAL** :
  - la zone du visage ;
  - l'union plutôt que les paliers ;
  - le métal des bijoux ;
  - la correspondance des teintes.

## Un défaut voisin, relevé et non corrigé ici

R-S10 (préférence de palette) compare les hex **exacts**. Or 12 des 21
couleurs de `PAL_COULEURS` n'ont pas le même hex dans la palette du dressing
(Terracotta, Moutarde, Kaki, Corail, Chocolat, Sable, Gris, Rose poudré,
Vert bouteille) ou n'y existent pas (Rouge, Bleu, Beige). Une préférence
« Terracotta » ne reconnaît donc aucun terracotta du dressing.
`teinteDe` corrigerait cela. C'est un levier distinct, à mesurer séparément
(règle d'audit, point 3).

## L'analyse photo, retirée

Une analyse par photo a été codée puis retirée le 30/09/2026, avant tout
déploiement : fonction Edge, consentement, sortie limitée à une saison. Elle
reste dans l'historique git (commit `96b8f4f`). La rétablir demanderait une
revue juridique : une photo de visage peut révéler une donnée sensible (RGPD,
article 9). Il faudrait aussi rouvrir la règle de CLAUDE.md sur la couleur de
peau.
