# Capsela — Avis de styliste : documentation produit & technique

Sep 25, 2026 · @Angela

Ce document est la source de vérité de la fonctionnalité Premium « Avis de styliste ». Il documente ce qui a été défini, sans inventer de règle manquante.

## Légende des statuts

Chaque règle porte l'un des quatre statuts suivants. Aucune hypothèse ne doit être implémentée comme une décision sans validation.

| Statut | Signification | Ce que le développeur doit faire |
| --- | --- | --- |
| **\[DÉCIDÉ\]** | Décision produit prise et explicite | Implémenter tel quel |
| **\[RECOMMANDÉ\]** | Bonne pratique proposée, cohérente avec les décisions | Implémenter sauf contre-indication, signaler tout écart |
| **\[À ARBITRER\]** | Décision non prise | Ne pas trancher seul, remonter au Product Owner |
| **\[HYPOTHÈSE TECHNIQUE\]** | Choix technique proposé, à confirmer pendant l'implémentation | Valider la faisabilité, documenter le choix final |

Périmètre : MVP. Tout ce qui dépasse les 10 points du périmètre MVP est classé V2 (section 24).

## 1. Présentation de la fonctionnalité

« Avis de styliste » est un conseil stylistique personnalisé sur une tenue photographiée, réservé aux abonnés Premium.

| Élément | Définition | Statut |
| --- | --- | --- |
| Nom | Avis de styliste | \[DÉCIDÉ\] |
| Positionnement | Conseil stylistique personnalisé. Jamais présenté comme un « outil d'analyse IA » | \[DÉCIDÉ\] |
| Promesse | « Montre-moi ta tenue, je te donne mon avis. » | \[DÉCIDÉ\] |
| Objectif utilisateur | Savoir si sa tenue fonctionne et obtenir des pistes concrètes pour l'ajuster ou la décliner | \[DÉCIDÉ\] |
| Objectif produit | Apporter une fonctionnalité à forte valeur perçue qui justifie l'abonnement Premium | \[RECOMMANDÉ\] — formulation déduite du statut exclusivement Premium, KPI associé \[À ARBITRER\] |
| Cible | Utilisateurs Capsela abonnés Premium | \[DÉCIDÉ\] |
| Statut | Exclusivement Premium. Free : Premium Gate puis Paywall. Pas de publicité récompensée | \[DÉCIDÉ\] |

Capacités couvertes par la fonctionnalité :

1. Prendre une photo d'une tenue.
2. Importer une photo.
3. Faire analyser la tenue.
4. Recevoir un avis stylistique personnalisé.
5. Obtenir des conseils concrets.
6. Découvrir éventuellement des pièces pertinentes de son dressing.
7. Explorer des variantes de style (hors MVP, voir section 13).
8. Enregistrer le résultat dans son Journal.

## 2. Proposition de valeur

La fonctionnalité transforme un doute (« est-ce que ça va ? ») en un avis structuré et actionnable, ancré dans le dressing de l'utilisateur.

|  | AVANT | APRÈS |
| --- | --- | --- |
| Question | L'utilisateur se demande si sa tenue fonctionne | Capsela lui donne un avis global clair |
| Confiance | Il n'a pas de regard extérieur disponible | Il sait ce qui fonctionne déjà dans son look |
| Action | Il ne sait pas quoi changer | Il reçoit un conseil principal et des pistes à tester |
| Dressing | Il ne pense pas aux pièces qu'il possède déjà | Capsela peut lui suggérer des pièces de son propre dressing |
| Mémoire | Le conseil est oublié | Il peut enregistrer le résultat dans son Journal |

### Différence avec une analyse d'image ou un chatbot

- **Une analyse d'image décrit.** Avis de styliste conseille : il qualifie ce qui fonctionne et propose des ajustements.
- **Un chatbot exige de savoir quoi demander.** Avis de styliste livre un format fixe et lisible (avis, points forts, conseil, suggestions), sans conversation à mener.
- **Un outil générique ignore le contexte.** Avis de styliste peut s'appuyer sur le profil stylistique et le dressing de l'utilisateur (voir sections 9 et 12).
- **Un outil générique n'a pas de ligne éditoriale.** Avis de styliste applique une charte stricte : bienveillance, aucun jugement sur le corps, aucune note (voir section 7).

## 3. Parcours utilisateur complet

Le parcours va de l'entrée Premium jusqu'à l'enregistrement ou une nouvelle analyse ; l'analyse n'est jamais lancée sans validation explicite de la photo.

```text
[Point d'entrée : À ARBITRER]
        |
   Contrôle Premium (serveur)
        |---- Free --> Premium Gate --> « Découvrir Premium » --> Paywall
        |                          \-> « Plus tard » --> sortie (destination À ARBITRER)
        |
     Premium
        |
  Écran « Avis de styliste »
        |---- Prendre une photo ----\
        |---- Importer une photo ---+--> Prévisualisation (photo sélectionnée)
                                             |-- Remplacer --> retour sélection
                                             |-- Supprimer --> retour écran initial
                                             |
                                    « Analyser ma tenue »
                                             |
                                          Analyse (loading)
                                             |-- échec --> Écran erreur --> Réessayer / Changer de photo
                                             |
                                          Résultat
                                             |- Ce qui fonctionne
                                             |- Mon conseil
                                             |- À tester
                                             |- Avec ton dressing (si pièces pertinentes)
                                             |- Variantes (V2)
                                             |
                          « Enregistrer dans mon journal »  /  « Nouvelle analyse »
```

### Détail des étapes

| # | Étape | Objectif | Action utilisateur | Résultat attendu | États possibles | CTA | Navigation suivante |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Entrée Premium | Contrôler l'accès | Ouvre la fonctionnalité | Premium : accès direct. Free : Premium Gate | Free, Premium | — | Étape 2 ou Premium Gate |
| 2 | Avis de styliste | Expliquer la promesse, proposer une source photo | Choisit photo ou import | Ouverture caméra ou galerie | Initial | Prendre une photo / Importer une photo | Étape 3 |
| 3 | Prendre / Importer une photo | Obtenir une image de la tenue | Prend ou choisit une photo | Photo transmise à la prévisualisation | En cours de sélection, annulée, invalide, permission refusée | — | Étape 4 ou retour étape 2 |
| 4 | Prévisualisation | Valider la photo avant envoi | Vérifie, remplace ou valide | Photo prête à l'analyse | Sélectionnée, invalide | Analyser ma tenue / Changer de photo | Étape 5 |
| 5 | Analyse | Faire patienter pendant l'analyse | Attend | Réponse structurée reçue | En cours, réussie, échouée, timeout, erreur réseau | Annuler \[À ARBITRER\] | Étape 6 ou écran Erreur |
| 6 | Résultat — avis global | Donner le verdict bienveillant | Lit | `overallAssessment` affiché | Disponible | — | Sections 7 à 10 |
| 7 | Ce qui fonctionne | Valoriser les points forts | Lit | `strengths` affichés | Disponible | — | Suite du résultat |
| 8 | Mon conseil | Donner l'ajustement prioritaire | Lit | `mainAdvice` affiché | Disponible | — | Suite du résultat |
| 9 | À tester | Proposer des pistes complémentaires | Lit | `suggestions` affichées | Disponible | — | Suite du résultat |
| 10 | Avec ton dressing | Relier le conseil à ses propres pièces | Consulte, clique sur une pièce | Pièces existantes affichées | Pièces trouvées, aucune pièce | Clic sur une pièce (destination À ARBITRER) | Suite du résultat |
| 11 | Variantes | Explorer d'autres directions de style | Choisit Plus chic / Plus décontracté / Plus coloré | Variante affichée | V2 | — | Hors MVP |
| 12 | Actions finales | Conserver ou recommencer | Enregistre ou relance | Entrée Journal créée, ou retour étape 2 | Enregistrement en cours, réussi, échoué | Enregistrer dans mon journal / Nouvelle analyse | Journal ou étape 2 |

**\[À ARBITRER\]** : le point d'entrée exact dans l'app, et si les étapes 6 à 10 sont des écrans distincts ou des sections d'un seul écran Résultat scrollable.

## 4. Matrice des états

Chaque état ci-dessous doit avoir un rendu et un comportement explicites dans l'implémentation.

| État | Utilisateur | Action | Résultat |
| --- | --- | --- | --- |
| Free | Free | Ouvre Avis de styliste | Premium Gate. Aucune analyse possible |
| Premium | Premium | Ouvre Avis de styliste | Accès direct à l'écran initial |
| Aucun abonnement | Sans abonnement | Ouvre Avis de styliste | Premium Gate (même traitement que Free). Distinction Free / sans abonnement / non connecté : \[À ARBITRER\] |
| Abonnement Premium expiré | Ex-Premium | Ouvre ou utilise la fonctionnalité | Traité comme Free (contrôle serveur) \[RECOMMANDÉ\] |
| Écran initial | Premium | Arrive sur la fonctionnalité | Promesse + CTA Prendre une photo / Importer une photo |
| Photo en cours de sélection | Premium | Caméra ou galerie ouverte | Retour à l'écran initial si annulation |
| Permission caméra / galerie refusée | Premium | Refuse l'autorisation | Message explicatif + alternative (import si caméra refusée) \[RECOMMANDÉ\] |
| Photo sélectionnée | Premium | Choisit une photo | Prévisualisation + CTA Analyser ma tenue / Changer de photo |
| Photo invalide | Premium | Choisit un fichier non conforme | Message d'erreur, CTA Changer de photo. Analyse non déclenchée |
| Analyse en cours | Premium | Lance l'analyse | État loading, CTA désactivé, pas de double envoi |
| Analyse réussie | Premium | — | Passage au Résultat |
| Analyse échouée (photo inexploitable) | Premium | — | Écran Erreur, CTA Changer de photo |
| Analyse échouée (technique) | Premium | — | Écran Erreur, CTA Réessayer |
| Erreur réseau | Premium | Lance ou attend l'analyse | Message réseau, CTA Réessayer, photo conservée côté client |
| Résultat disponible | Premium | Consulte | Avis global, Ce qui fonctionne, Mon conseil, À tester, Avec ton dressing si applicable |
| Nouvelle analyse | Premium | Clique Nouvelle analyse | Retour à l'écran initial. Sort du résultat non enregistré : avertissement \[À ARBITRER\] |
| Enregistrement Journal en cours | Premium | Clique Enregistrer dans mon journal | CTA désactivé pendant l'écriture |
| Enregistrement Journal réussi | Premium | — | Confirmation, CTA remplacé par un état « Enregistré » \[RECOMMANDÉ\] |
| Enregistrement Journal échoué | Premium | — | Message d'erreur, CTA Réessayer, résultat conservé à l'écran |

## 5. Règles Premium

La fonctionnalité est exclusivement Premium, sans aucune alternative par publicité récompensée.

| Profil | Comportement | Statut |
| --- | --- | --- |
| FREE | Accès bloqué → Premium Gate → Paywall | \[DÉCIDÉ\] |
| PREMIUM | Accès direct | \[DÉCIDÉ\] |
| Tous | Pas de publicité récompensée pour débloquer une analyse | \[DÉCIDÉ\] |

### Règles d'application

- Le contrôle Premium est fait **côté serveur** avant tout appel au modèle. Le masquage côté client ne suffit pas. \[RECOMMANDÉ\]
- Un appel direct à l'endpoint d'analyse par un compte Free renvoie un refus (ex. HTTP 403) sans appel au modèle. \[RECOMMANDÉ\]
- Quota d'analyses par utilisateur Premium (par jour ou par mois) : \[À ARBITRER\]

### Premium Gate \[DÉCIDÉ\]

| Élément | Contenu |
| --- | --- |
| Titre | « Et si on regardait ta tenue ? » |
| Texte | « Envoie une photo de ton look et laisse Capsela te donner un avis personnalisé sur ce qui fonctionne et ce que tu pourrais ajuster. » |
| CTA principal | « Découvrir Premium » → Paywall |
| CTA secondaire | « Plus tard » → fermeture du Gate |

**\[À ARBITRER\]** : visuel du Premium Gate, forme (plein écran ou bottom sheet), destination exacte de « Plus tard », et retour dans la fonctionnalité après une souscription réussie depuis le Paywall.

## 6. Écrans et spécifications UX

Treize écrans ou états d'écran sont à couvrir ; les libellés non cités dans le brief d'origine sont à valider éditorialement.

| # | Écran | Objectif | Contenu et composants | Données affichées | CTA principal | CTA secondaire | États | Navigation | Règles UX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Avis de styliste | Poser la promesse, lancer le parcours | Titre, promesse, illustration \[À ARBITRER\], deux boutons | Aucune donnée utilisateur | Prendre une photo | Importer une photo | Initial | → 2 ou 3 | Parler de conseil, jamais d'« analyse IA » |
| 2 | Prendre une photo | Capturer la tenue | Caméra native ou composant caméra \[HYPOTHÈSE TECHNIQUE\] | — | Déclencher | Annuler | Ouverte, permission refusée | → 4 ou → 1 | Conseil de cadrage (tenue entière, bonne lumière) \[RECOMMANDÉ\] |
| 3 | Importer une photo | Choisir une image existante | Sélecteur galerie / fichiers natif | — | Choisir | Annuler | Ouvert, permission refusée, fichier invalide | → 4 ou → 1 | Une seule photo par analyse (multi-looks = V2) |
| 4 | Photo sélectionnée | Valider avant envoi | Aperçu de la photo, boutons | Photo locale | Analyser ma tenue | Changer de photo ; suppression \[RECOMMANDÉ\] | Sélectionnée, invalide | → 5 | L'analyse ne part que sur ce CTA |
| 5 | Analyse | Faire patienter | Indicateur de chargement, message d'attente \[libellé À ARBITRER\] | Aperçu photo \[RECOMMANDÉ\] | — | Annuler \[À ARBITRER\] | En cours, timeout | → 6 ou → 13 | Pas de double envoi ; ton humain dans l'attente |
| 6 | Résultat | Donner l'avis global | Photo + avis global en tête | `overallAssessment` | — | — | Disponible | → 7 à 12 | L'avis global est toujours visible en premier |
| 7 | Ce qui fonctionne | Valoriser | Liste des points forts | `strengths` | — | — | Disponible | Suite | Toujours affiché avant le conseil |
| 8 | Mon conseil | Donner l'ajustement clé | Bloc mis en avant | `mainAdvice` | — | — | Disponible | Suite | Un seul conseil principal |
| 9 | À tester | Proposer des pistes | Liste de suggestions | `suggestions` | — | — | Disponible | Suite | Formulations au conditionnel |
| 10 | Avec ton dressing | Relier au dressing | Cartes d'articles (visuel, nom) | Articles du dressing correspondants | Clic sur un article \[destination À ARBITRER\] | — | Articles trouvés, aucun article | Suite | Section masquée ou message neutre si aucun article \[À ARBITRER\] |
| 11 | Variantes | Explorer d'autres styles | Sélecteur Plus chic / Plus décontracté / Plus coloré | Variante | Choix d'une variante | — | V2 | — | Hors MVP, secondaire par rapport à l'avis |
| 12 | Actions finales | Conserver ou recommencer | Deux boutons en bas de résultat | — | Enregistrer dans mon journal | Nouvelle analyse | Enregistrement en cours, réussi, échoué | → Journal ou → 1 | Confirmation visible après enregistrement |
| 13 | Erreur | Expliquer et proposer une sortie | Message, bouton(s) | Message selon le cas (section 15) | Réessayer ou Changer de photo selon le cas | Retour | Selon le cas | → 4 ou → 1 | Jamais de message technique brut |

**\[À ARBITRER\]** : écrans 6 à 10 en écran unique scrollable ou en écrans séparés ; charte visuelle définitive via le Brief design.

## 7. Contenu éditorial

Le conseil parle comme une styliste bienveillante qui tutoie : il valorise d'abord, suggère ensuite, ne juge jamais. \[DÉCIDÉ\]

### Qualités attendues

| Qualité | Traduction concrète |
| --- | --- |
| Bienveillant | Commence par ce qui fonctionne |
| Expert | Utilise un vocabulaire de mode précis (proportions, matières, couleurs, accessoires) |
| Concret | Chaque conseil est une action réalisable |
| Personnalisé | Parle de cette tenue-là, pas de règles générales |
| Positif | Formule les ajustements comme des opportunités |
| Accessible | Pas de jargon non expliqué |

### Interdits \[DÉCIDÉ\]

- Jugement sur le corps et body shaming.
- Vocabulaire culpabilisant.
- Notation de type « X/10 ».
- Diagnostic physique.
- Caractéristique sensible déduite de l'image.
- Formulation humiliante.
- Affirmation catégorique lorsque l'analyse est incertaine.

### Formulations

| À privilégier | À proscrire |
| --- | --- |
| « Tu pourrais essayer… » | « Cette tenue ne te va pas. » |
| « Pour donner davantage de relief… » | Toute formule qui vise la silhouette ou le physique |
| « Une autre option serait… » | Toute note ou score |

### Application technique

- Les règles ci-dessus sont inscrites dans les instructions système envoyées au modèle. \[RECOMMANDÉ\]
- Un contrôle de sortie côté serveur (ex. détection de notes « /10 ») avant affichage. \[HYPOTHÈSE TECHNIQUE\] — niveau de contrôle \[À ARBITRER\]
- Libellés d'interface non cités dans ce document (titres de sections, message d'attente) : \[À ARBITRER\]

## 8. Structure du résultat IA

Le résultat est un objet JSON à quatre champs décidés ; les champs liés au dressing et à la lisibilité de la photo restent à arbitrer.

### Structure cible \[DÉCIDÉ\]

```json
{
  "overallAssessment": "Ta tenue est harmonieuse : les tons neutres créent une allure douce et cohérente.",
  "strengths": [
    "Le camel et le crème se répondent très bien.",
    "La coupe droite du pantalon donne une ligne nette à l'ensemble.",
    "Les matières naturelles donnent un rendu soigné."
  ],
  "mainAdvice": "Pour donner davantage de relief, tu pourrais marquer la taille avec une ceinture structurée.",
  "suggestions": [
    "Tu pourrais essayer des mocassins pour une touche plus habillée.",
    "Une autre option serait d'ajouter un bijou doré discret.",
    "Un sac à la teinte plus soutenue créerait un point focal."
  ]
}
```

Les textes ci-dessus sont des exemples illustratifs, pas des contenus à coder en dur.

### Description des champs

| Champ | Type | Obligatoire | Nombre d'éléments | Objectif UX | Écran |
| --- | --- | --- | --- | --- | --- |
| `overallAssessment` | string | Oui | 1 | Verdict global bienveillant, lu en premier | Résultat |
| `strengths` | string\[\] | Oui | Max 3 selon l'exemple ; minimum \[À ARBITRER\] | Rassurer et valoriser | Ce qui fonctionne |
| `mainAdvice` | string | Oui | 1 | Ajustement prioritaire unique | Mon conseil |
| `suggestions` | string\[\] | Oui | Max 3 selon l'exemple ; minimum \[À ARBITRER\] | Pistes complémentaires | À tester |

Longueur maximale de chaque texte : \[À ARBITRER\]. Un maximum est recommandé pour garantir la lisibilité mobile. \[RECOMMANDÉ\]

### Champs complémentaires \[HYPOTHÈSE TECHNIQUE — À ARBITRER\]

Ces champs ne font pas partie de la structure décidée. Ils sont proposés parce que deux besoins décidés (erreur « photo inexploitable », section « Avec ton dressing ») nécessitent une information que la structure actuelle ne porte pas.

```json
{
  "isAnalyzable": true,
  "unanalyzableReason": null,
  "dressingNeeds": [
    { "category": "ceinture", "attributes": ["structurée"], "relatedTo": "mainAdvice" }
  ],
  "dressingItemIds": ["uuid-article-1", "uuid-article-2"]
}
```

| Champ | Besoin couvert | Statut |
| --- | --- | --- |
| `isAnalyzable` (boolean) | Distinguer une photo inexploitable d'une erreur technique | \[HYPOTHÈSE TECHNIQUE\] |
| `unanalyzableReason` (enum : `blurry`, `too_dark`, `no_garment`, `other`) | Afficher le bon message d'erreur (section 15) | \[HYPOTHÈSE TECHNIQUE\] |
| `dressingNeeds` | Option A : le modèle décrit les pièces utiles, le serveur cherche dans le dressing | \[À ARBITRER\] |
| `dressingItemIds` | Option B : le modèle reçoit une liste d'articles et renvoie les identifiants pertinents | \[À ARBITRER\] |

Une seule des options A et B doit être retenue (voir section 12). Dans l'option B, le serveur doit vérifier que chaque identifiant renvoyé existe bien dans le dressing de l'utilisateur.

## 9. Personnalisation

Seules les données stylistiques utiles au conseil sont transmises au modèle ; rien n'est déduit de l'image sur la personne elle-même.

### Données transmissibles

| Donnée | Utilité | Statut |
| --- | --- | --- |
| Style sélectionné par l'utilisateur | Orienter le conseil vers son univers | \[À ARBITRER\] — dépend des données existantes du profil |
| Préférences stylistiques | Idem | \[À ARBITRER\] |
| Occasion | Adapter le conseil au contexte | \[À ARBITRER\] — aucune saisie d'occasion n'est prévue dans le parcours MVP ; conseils selon occasion = V2 |
| Contexte de la tenue (saisie libre) | Préciser l'intention | \[À ARBITRER\] — non prévu dans le parcours MVP |
| Articles du dressing | Alimenter « Avec ton dressing » | \[À ARBITRER\] — dépend de l'option retenue en section 12 |

Si des articles du dressing sont transmis, seuls les attributs vestimentaires utiles sont envoyés (identifiant, catégorie, couleur, matière, nom). \[RECOMMANDÉ\]

### Données à ne jamais transmettre ni déduire \[DÉCIDÉ\]

- Identité : nom, email, identifiant de compte (remplacé par un identifiant technique si nécessaire). \[RECOMMANDÉ\]
- Données médicales ou état de santé.
- Caractéristiques sensibles déduites de l'image.
- Informations personnelles non nécessaires au conseil.
- Jugements sur le corps : l'image sert uniquement à lire les vêtements, couleurs, matières, coupes et accessoires.

La sortie du modèle ne doit pas stocker ni exposer d'attribut déduit sur la personne photographiée. \[RECOMMANDÉ\]

## 10. Intelligence artificielle

L'analyse passe par un endpoint serveur Capsela qui appelle l'OpenAI Responses API ; le client ne parle jamais directement à OpenAI.

```text
CLIENT (app Capsela)
   | photo
   v
Compression / redimensionnement (client)
   |
   v
Endpoint serveur Capsela  -- contrôle auth + Premium + validation fichier
   |
   v
OpenAI Responses API  (secret API côté serveur uniquement)
   |
   v
Analyse image -> réponse structurée (JSON)
   |
   v
Serveur Capsela  -- validation du schéma, matching dressing
   |
   v
Interface utilisateur
```

| Élément | Spécification | Statut |
| --- | --- | --- |
| API | OpenAI Responses API | \[DÉCIDÉ\] |
| Emplacement du secret | Serveur uniquement | \[DÉCIDÉ\] |
| Modèle initial | `gpt-5.4-mini`, configurable sans modification de code | Modèle : envisagé, non définitif. Configurabilité : \[RECOMMANDÉ\] |
| Rôle du modèle | Lire la tenue (vêtements, couleurs, matières, accessoires) et produire un conseil selon la charte de la section 7 | \[DÉCIDÉ\] |
| Entrée | Image compressée + instructions système (ton, interdits, format) + contexte utilisateur autorisé (section 9) | \[HYPOTHÈSE TECHNIQUE\] |
| Sortie | JSON conforme à la section 8 | \[DÉCIDÉ\] |
| Forçage du format | Sortie structurée par schéma JSON côté API | \[HYPOTHÈSE TECHNIQUE\] |
| Validation | Validation du JSON côté serveur avant envoi au client | \[RECOMMANDÉ\] |
| Température, max tokens, niveau de détail image | À calibrer en tests | \[HYPOTHÈSE TECHNIQUE\] |
| Langue de sortie | Français, tutoiement | \[RECOMMANDÉ\] — cohérent avec les exemples de ton |

### Gestion des erreurs et fallback

| Cas | Comportement | Statut |
| --- | --- | --- |
| Réponse non conforme au schéma | Rejet serveur, une nouvelle tentative automatique maximum, puis erreur utilisateur | \[HYPOTHÈSE TECHNIQUE\] — nombre de retries \[À ARBITRER\] |
| Champ obligatoire manquant | Traité comme réponse invalide, aucun résultat partiel affiché | \[À ARBITRER\] — affichage partiel possible ou non |
| Erreur API ou timeout | Erreur utilisateur avec Réessayer | \[RECOMMANDÉ\] |
| Modèle de repli | Aucun défini | \[À ARBITRER\] |

### Limites connues

- Le modèle peut se tromper sur une couleur, une matière ou une pièce partiellement visible : d'où l'interdiction d'affirmations catégoriques.
- La qualité dépend fortement de la photo (lumière, cadrage, netteté).
- Le respect de la charte éditoriale n'est jamais garanti à 100 % par les seules instructions : il doit être testé en recette (section 20).

## 11. Gestion des images

Objectif décidé : ne pas conserver inutilement les photos personnelles ; la plupart des seuils techniques restent à fixer.

| Étape | Comportement | Statut |
| --- | --- | --- |
| Prise de photo | Caméra de l'appareil depuis l'écran 2 | \[DÉCIDÉ\] |
| Import | Galerie / fichiers depuis l'écran 3 | \[DÉCIDÉ\] |
| Formats acceptés | JPEG, PNG, HEIC, WebP proposés | \[À ARBITRER\] |
| Taille maximale du fichier source | Non définie | \[À ARBITRER\] |
| Compression | Avant upload, côté client | \[DÉCIDÉ\] (principe) ; qualité cible \[À ARBITRER\] |
| Redimensionnement | Avant upload, côté client ; dimension max du plus grand côté | \[DÉCIDÉ\] (principe) ; valeur \[À ARBITRER\] |
| Conversion HEIC → JPEG | Avant upload si HEIC accepté | \[HYPOTHÈSE TECHNIQUE\] |
| Suppression des métadonnées EXIF (dont géolocalisation) | Avant upload | \[RECOMMANDÉ\] |
| Aperçu | Affichage local avant validation | \[DÉCIDÉ\] |
| Remplacement | « Changer de photo » depuis l'aperçu | \[DÉCIDÉ\] |
| Suppression avant analyse | Retrait de la photo locale, retour à l'écran initial | \[RECOMMANDÉ\] |
| Envoi | Uniquement après « Analyser ma tenue » | \[DÉCIDÉ\] |
| Mode de transmission | Image envoyée au serveur puis transmise au modèle (base64 ou URL signée temporaire) | \[HYPOTHÈSE TECHNIQUE\] |
| Validation serveur | Type MIME réel, taille, dimensions | \[RECOMMANDÉ\] |
| Conservation après analyse (hors Journal) | Pas de conservation serveur après réponse | \[À ARBITRER\] — recommandé pour respecter l'objectif décidé |
| Conservation si enregistrée dans le Journal | Stockage durable lié à l'entrée Journal | \[À ARBITRER\] (section 14) |
| Rétention côté OpenAI | Politique de rétention du fournisseur à vérifier | \[À ARBITRER\] — validation RGPD (section 18) |

## 12. Matching avec le dressing

« Avec ton dressing » recommande uniquement des pièces réellement présentes dans le dressing de l'utilisateur ; la logique technique de sélection n'est pas encore définie. \[DÉCIDÉ sur le principe, À ARBITRER sur la méthode\]

### Exemple de référence

Avis : « Une ceinture structurée apporterait davantage de relief. »

Si ces articles existent dans le dressing, Capsela affiche : Ceinture cuir chocolat, Blazer camel, Mocassins marron.

### Sélection des articles — options à arbitrer

| Option | Principe | Avantages | Risques |
| --- | --- | --- | --- |
| A — Besoins puis recherche | Le modèle renvoie des besoins (`dressingNeeds` : catégorie, attributs). Le serveur cherche les articles correspondants dans le dressing | Pas d'envoi du dressing au modèle, coût stable, aucun identifiant inventé | Correspondance moins fine (dépend de la qualité des attributs des articles) |
| B — Dressing envoyé au modèle | Le serveur envoie une liste réduite d'articles, le modèle renvoie `dressingItemIds` | Correspondance plus contextuelle | Coût en tokens proportionnel au dressing, identifiants à re-vérifier |

### Catégories pertinentes

Les catégories exactes dépendent du référentiel d'articles existant dans Capsela. \[À ARBITRER — lecture du référentiel avant spécification\]. Les exemples du brief couvrent : accessoires (ceinture), pièces de dessus (blazer), chaussures (mocassins).

### Règles anti-incohérence

- Un article affiché existe dans le dressing de l'utilisateur au moment de l'affichage. \[DÉCIDÉ\]
- Chaque article affiché est relié à un conseil précis (`mainAdvice` ou une `suggestion`). \[RECOMMANDÉ\]
- Pas de pièce déjà portée sur la photo proposée comme ajout. \[RECOMMANDÉ\] — méthode de détection \[À ARBITRER\]
- Articles désactivés ou archivés exclus. \[RECOMMANDÉ\] — selon les statuts existants du dressing
- Nombre maximal d'articles affichés : \[À ARBITRER\]

### Absence de pièce pertinente

Aucun article ne doit être forcé. Choix entre masquer la section ou afficher un message neutre : \[À ARBITRER\]. Une suggestion d'achat en remplacement relève de la V2 (recommandations shopping).

### Dressing vide

Comportement si l'utilisateur n'a aucun article : \[À ARBITRER\].

## 13. Variantes stylistiques

Les variantes sont secondaires : l'avis principal reste toujours prioritaire. Elles figurent dans le parcours cible mais pas dans les 10 points du périmètre MVP ; elles sont donc classées V2 jusqu'à arbitrage contraire. \[À ARBITRER\]

| Variante | Intention |
| --- | --- |
| Plus chic | Décliner la tenue vers un registre plus habillé |
| Plus décontracté | Décliner la tenue vers un registre plus casual |
| Plus coloré | Introduire davantage de couleur |

### Points non définis \[À ARBITRER\]

- Format d'une variante (texte seul, pièces du dressing, ou les deux).
- Génération : dans la même réponse que l'avis ou via un second appel à la demande. Le second appel évite un coût pour les utilisateurs qui ne consultent pas les variantes. \[HYPOTHÈSE TECHNIQUE\]
- Enregistrement des variantes consultées dans le Journal.

## 14. Journal

L'action « Enregistrer dans mon journal » crée une entrée Journal à partir du résultat affiché. \[DÉCIDÉ\]

| Donnée | Enregistrée | Statut |
| --- | --- | --- |
| Date de l'analyse | Oui | \[RECOMMANDÉ\] |
| Avis (`overallAssessment`, `strengths`, `mainAdvice`, `suggestions`) | Oui | \[RECOMMANDÉ\] |
| Articles du dressing suggérés (identifiants) | Oui | \[RECOMMANDÉ\] |
| Photo | Non défini | \[À ARBITRER\] — politique de conservation des photos non définie |
| Variantes | Non défini | \[À ARBITRER\] — dépend du statut V2 des variantes |

### Règles

- L'enregistrement est une action volontaire : aucun résultat n'est enregistré automatiquement. \[RECOMMANDÉ\]
- Un même résultat ne peut pas être enregistré deux fois (CTA désactivé après succès). \[RECOMMANDÉ\]
- Suppression d'une entrée Journal : doit entraîner la suppression de la photo associée si elle est stockée. \[RECOMMANDÉ\]
- Structure de l'entrée Journal existante et réutilisabilité : \[À ARBITRER — lecture du modèle Journal existant avant implémentation\]
- Affichage de l'entrée dans le Journal (vignette, extrait) : \[À ARBITRER\]

## 15. Gestion des erreurs

Chaque erreur affiche un message humain et une sortie claire ; seuls deux messages sont déjà validés, les autres sont des propositions. \[Messages non cités dans le brief : À ARBITRER\]

| Cas | Comportement technique | Message utilisateur | Retry |
| --- | --- | --- | --- |
| Photo trop floue | Modèle signale photo non exploitable (`unanalyzableReason: blurry`) | « Je n'arrive pas à lire suffisamment ta tenue. Essaie avec une photo plus nette et plus lumineuse. » \[DÉCIDÉ\] | Changer de photo |
| Photo inexploitable (sombre, cadrage) | Idem, raison `too_dark` ou `other` | Même message \[DÉCIDÉ\] | Changer de photo |
| Aucun vêtement identifiable | Raison `no_garment` | Proposition : « Je ne vois pas de tenue sur cette photo. Essaie avec une photo où ton look est bien visible. » | Changer de photo |
| Fichier invalide (format, taille) | Refus client puis serveur, pas d'appel modèle | Proposition : « Ce fichier ne peut pas être utilisé. Choisis une autre photo. » | Changer de photo |
| Erreur API | Erreur fournisseur journalisée côté serveur | « Impossible d'analyser ta tenue pour le moment. Réessaie dans quelques instants. » \[DÉCIDÉ\] | Réessayer |
| Timeout | Appel interrompu après le délai maximal \[valeur À ARBITRER\] | Même message \[DÉCIDÉ\] | Réessayer |
| Erreur réseau (client) | Requête non aboutie, photo conservée localement | Proposition : « Connexion interrompue. Vérifie ton réseau et réessaie. » | Réessayer |
| Réponse IA invalide (JSON non conforme) | Rejet serveur, retry automatique \[nombre À ARBITRER\] | « Impossible d'analyser ta tenue pour le moment… » \[DÉCIDÉ\] | Réessayer |
| Réponse IA incomplète | Idem réponse invalide ; affichage partiel \[À ARBITRER\] | Idem | Réessayer |
| Contenu non conforme à la charte (note, jugement corporel) | Rejet serveur si détecté \[HYPOTHÈSE TECHNIQUE\] | Idem | Réessayer |
| Problème de stockage (Journal) | Échec d'écriture, résultat conservé à l'écran | Proposition : « L'enregistrement n'a pas abouti. Réessaie. » | Réessayer l'enregistrement |
| Utilisateur quitte pendant l'analyse | Comportement non défini | Aucun | \[À ARBITRER\] : annuler la requête ou conserver le résultat pour un retour |
| Accès non Premium à l'endpoint | Refus serveur, pas d'appel modèle | Premium Gate | Non |
| Quota atteint (si quota défini) | Refus serveur | \[À ARBITRER\] | \[À ARBITRER\] |

**Règle générale \[RECOMMANDÉ\]** : une erreur technique n'est jamais décomptée d'un éventuel quota, et aucun message technique brut n'est affiché.

## 16. Analytics

Douze événements couvrent l'entonnoir complet ; l'outil analytics n'est pas encore choisi (Plausible et PostHog envisagés). \[À ARBITRER\]

| Event name | Déclencheur | Propriétés utiles |
| --- | --- | --- |
| `stylist_advice_opened` | Ouverture de la fonctionnalité | `is_premium`, `entry_point` |
| `stylist_advice_premium_gate_viewed` | Affichage du Premium Gate | `entry_point` |
| `stylist_advice_premium_gate_cta_clicked` | Clic Découvrir Premium / Plus tard | `cta` (`discover_premium`, `later`) |
| `stylist_advice_photo_selected` | Photo validée en aperçu | `source` (`camera`, `import`), `replaced_count` |
| `stylist_advice_analysis_started` | Clic Analyser ma tenue | `analysis_id` |
| `stylist_advice_analysis_completed` | Résultat valide reçu | `analysis_id`, `duration_ms`, `model`, `dressing_items_count` |
| `stylist_advice_analysis_failed` | Échec de l'analyse | `analysis_id`, `error_type` (`unanalyzable`, `api`, `timeout`, `network`, `invalid_response`), `duration_ms` |
| `stylist_advice_result_viewed` | Affichage du résultat | `analysis_id`, `has_dressing_suggestions` |
| `stylist_advice_dressing_suggestion_clicked` | Clic sur un article suggéré | `analysis_id`, `item_category`, `position` |
| `stylist_advice_variant_selected` | Choix d'une variante (V2) | `analysis_id`, `variant` |
| `stylist_advice_saved` | Enregistrement Journal réussi | `analysis_id` |
| `stylist_advice_retry` | Clic Réessayer ou Changer de photo après erreur | `analysis_id`, `error_type`, `retry_action` |

Les deux événements Premium Gate sont ajoutés à la liste du brief pour mesurer la conversion Free → Premium. \[RECOMMANDÉ\]

**Données exclues \[principe DÉCIDÉ, liste RECOMMANDÉE\]** : aucune photo, aucun texte de conseil, aucun nom d'article, aucune donnée personnelle ou sensible dans les propriétés. `analysis_id` est un identifiant technique non signifiant. \[RECOMMANDÉ\]

## 17. Performance

La photo est allégée avant envoi, l'attente est toujours visible, et aucune requête n'est envoyée en double ; les seuils chiffrés restent à fixer.

| Attente | Règle | Statut |
| --- | --- | --- |
| Compression avant upload | Obligatoire, côté client | \[DÉCIDÉ\] ; paramètres \[À ARBITRER\] |
| Temps d'attente acceptable | Cible non définie | \[À ARBITRER\] — à mesurer sur `duration_ms` |
| État loading | Affiché dès le clic, jusqu'au résultat ou à l'erreur | \[DÉCIDÉ\] |
| Timeout | Délai maximal côté serveur, inférieur à la limite d'exécution de la fonction serveur | \[HYPOTHÈSE TECHNIQUE\] ; valeur \[À ARBITRER\] |
| Retry | Manuel pour l'utilisateur ; automatique limité côté serveur pour réponse invalide | \[RECOMMANDÉ\] |
| Anti double envoi | CTA désactivé pendant l'analyse | \[RECOMMANDÉ\] |
| Requêtes inutiles | Pas d'appel si non Premium, fichier invalide ou photo inchangée déjà analysée \[À ARBITRER pour ce dernier cas\] | \[RECOMMANDÉ\] |
| Limitation de débit | Rate limiting par utilisateur côté serveur | \[RECOMMANDÉ\] ; seuil \[À ARBITRER\] |

## 18. Sécurité & confidentialité

Le secret OpenAI et le contrôle Premium vivent côté serveur ; la conformité RGPD du traitement des photos n'est pas encore validée.

| Principe | Mise en œuvre | Statut |
| --- | --- | --- |
| Clé OpenAI côté serveur uniquement | Jamais dans le bundle client ni dans une variable publique (`NEXT_PUBLIC_*`) | \[DÉCIDÉ\] |
| Contrôle d'accès Premium côté serveur | Vérifié à chaque appel de l'endpoint | \[DÉCIDÉ\] |
| Authentification | Endpoint accessible aux seuls utilisateurs authentifiés | \[RECOMMANDÉ\] |
| Validation des fichiers | Type MIME réel, extension, dimensions | \[DÉCIDÉ\] (principe) |
| Limitation de taille | Limite client et serveur | \[DÉCIDÉ\] (principe) ; valeur \[À ARBITRER\] |
| Photos temporaires | Suppression après analyse si non enregistrées | \[À ARBITRER\] |
| Stockage des photos Journal | Bucket privé, accès restreint au propriétaire (politiques d'accès Supabase) | \[HYPOTHÈSE TECHNIQUE\] |
| Journalisation | Aucune photo ni texte de conseil dans les logs applicatifs et de monitoring | \[RECOMMANDÉ\] |
| Métadonnées image | Suppression EXIF avant envoi | \[RECOMMANDÉ\] |

### Points nécessitant une validation juridique / RGPD

Aucune des règles ci-dessous n'est présentée comme juridiquement établie.

- Base légale du traitement de la photo et information de l'utilisateur (mention au moment de l'envoi).
- Transfert de l'image à un sous-traitant situé hors UE (OpenAI) et garanties associées.
- Rétention des données côté OpenAI et options de non-rétention disponibles.
- Photos pouvant contenir un visage ou des tiers : qualification de la donnée.
- Durée de conservation des photos enregistrées dans le Journal et suppression à la fermeture du compte.
- Mise à jour de la politique de confidentialité et du registre des traitements.
- Utilisateurs mineurs : âge minimum d'accès à la fonctionnalité.

## 19. Coût

Le coût par analyse se recalcule à partir des tokens réellement consommés et de la grille tarifaire en vigueur ; aucune estimation de ce document n'est un coût définitif.

### Variables

| Variable | Définition | Source de mesure |
| --- | --- | --- |
| M | Modèle utilisé | Configuration serveur |
| T\_img | Tokens consommés par l'image (dépend de la résolution et du niveau de détail) | Champ `usage` de la réponse API |
| T\_in | Tokens d'entrée texte (instructions, contexte, dressing éventuel) | Champ `usage` |
| T\_out | Tokens de sortie | Champ `usage` |
| P\_in, P\_out | Prix par million de tokens d'entrée / de sortie pour M | Grille tarifaire OpenAI à la date du calcul |
| r | Taux moyen d'appels supplémentaires (retries) par analyse | Logs serveur |
| C\_sto | Coût de stockage mensuel par photo conservée | Tarif Supabase Storage, si photos conservées |
| N | Nombre d'utilisateurs Premium actifs | Base utilisateurs |
| A | Nombre moyen d'analyses par utilisateur Premium et par mois | Événement `stylist_advice_analysis_started` |
| s | Part des analyses enregistrées avec photo dans le Journal | Événement `stylist_advice_saved` |

### Formules

Coût modèle d'une analyse :

```latex
C_{analyse} = (1 + r) \times \frac{(T_{img} + T_{in}) \times P_{in} + T_{out} \times P_{out}}{10^{6}}
```

Coût mensuel de la fonctionnalité :

```latex
C_{mois} = N \times A \times \left( C_{analyse} + s \times C_{sto} \right)
```

Dans la seconde formule, le terme de stockage est simplifié : il ne compte que les photos ajoutées dans le mois, pas le stock cumulé. \[HYPOTHÈSE TECHNIQUE\]

### Suivi recommandé \[RECOMMANDÉ\]

- Journaliser côté serveur, par analyse : modèle, T\_img + T\_in, T\_out, nombre d'appels.
- Recalculer les formules à chaque changement de modèle ou de tarif.
- Budget cible par analyse et par utilisateur : \[À ARBITRER\]

## 20. Critères d'acceptation

La fonctionnalité est recettable quand tous les critères ci-dessous sont vérifiés ; les critères liés à un point à arbitrer sont à compléter après décision.

### Accès Premium

- [ ] Un utilisateur Free ne peut pas accéder à l'analyse.
- [ ] Un utilisateur Free voit le Premium Gate avec le titre, le texte et les CTA exacts de la section 5.
- [ ] « Découvrir Premium » ouvre le Paywall.
- [ ] Aucune publicité récompensée n'est proposée.
- [ ] Un utilisateur Premium accède directement à la fonctionnalité.
- [ ] Un appel direct à l'endpoint par un compte Free est refusé sans appel au modèle.

### Photo

- [ ] L'utilisateur peut prendre une photo.
- [ ] L'utilisateur peut importer une photo.
- [ ] La photo peut être remplacée.
- [ ] Un fichier invalide est refusé avec un message clair.
- [ ] La photo est compressée et redimensionnée avant upload.
- [ ] L'analyse est déclenchée uniquement après validation (« Analyser ma tenue »).

### Analyse et résultat

- [ ] La clé API n'est jamais exposée côté client (vérifié dans le bundle et les requêtes réseau).
- [ ] Un état loading est affiché pendant l'analyse et le double envoi est impossible.
- [ ] Le résultat respecte la structure attendue (section 8).
- [ ] L'avis global, Ce qui fonctionne, Mon conseil et À tester sont affichés.
- [ ] Le résultat ne contient aucun jugement sur le corps, aucune note « X/10 », aucun diagnostic physique (vérifié sur un jeu de photos de test varié).
- [ ] Le résultat n'affirme rien de façon catégorique sur un élément peu visible.
- [ ] Le vocabulaire affiché ne présente pas la fonctionnalité comme un « outil d'analyse IA ».

### Dressing

- [ ] Les recommandations du dressing correspondent réellement aux articles disponibles de l'utilisateur.
- [ ] Aucun article d'un autre utilisateur n'est jamais affiché.
- [ ] L'absence de pièce pertinente est gérée selon la règle arbitrée (section 12).

### Journal et fin de parcours

- [ ] L'utilisateur peut enregistrer le résultat dans son Journal.
- [ ] Un même résultat ne peut pas être enregistré deux fois.
- [ ] L'utilisateur peut lancer une nouvelle analyse.

### Erreurs

- [ ] Chaque cas de la section 15 affiche le message et l'action de retry prévus.
- [ ] Aucun message technique brut n'est affiché.
- [ ] Une réponse IA invalide ou incomplète n'est jamais affichée telle quelle.

### Analytics et données

- [ ] Les événements analytics de la section 16 sont déclenchés correctement.
- [ ] Aucune photo, aucun texte de conseil ni donnée personnelle n'apparaît dans les analytics ou les logs.
- [ ] Les photos non enregistrées sont traitées selon la règle de conservation arbitrée (section 11).

## 21. Dépendances techniques

La fonctionnalité s'appuie sur la stack existante de Capsela et sur quatre briques produit déjà présentes ou à confirmer.

| Dépendance | Rôle dans Avis de styliste | Statut |
| --- | --- | --- |
| Next.js (App Router) | Écrans et endpoint serveur d'analyse (route handler ou server action) | Stack existante ; forme de l'endpoint \[HYPOTHÈSE TECHNIQUE\] |
| TypeScript | Typage du schéma de résultat, partagé client / serveur | \[RECOMMANDÉ\] |
| Supabase (base `vestiaire_universel`) | Lecture du statut Premium, du dressing, écriture Journal | Stack existante |
| Supabase Storage | Stockage des photos enregistrées dans le Journal, si retenu | \[À ARBITRER\] (dépend de la section 14) |
| OpenAI API (Responses API) | Analyse de l'image et production du conseil | \[DÉCIDÉ\] |
| Authentification (Supabase Auth, à confirmer) | Identifier l'utilisateur appelant l'endpoint | \[À CONFIRMER\] |
| Système Premium | Source de vérité du statut d'abonnement, Premium Gate, Paywall | Existant à confirmer \[À CONFIRMER\] |
| Dressing | Référentiel des articles pour « Avec ton dressing » | Existant |
| Journal | Enregistrement du résultat | Existant à confirmer ; modèle de données à lire \[À CONFIRMER\] |
| Analytics | Suivi des événements de la section 16 | Outil non choisi (Plausible ou PostHog) \[À ARBITRER\] |
| Vercel | Hébergement ; la limite d'exécution des fonctions conditionne le timeout | Stack existante |
| Sentry | Suivi des erreurs serveur, sans photo ni conseil dans les événements | Prévu, non en place \[À CONFIRMER\] |
| Librairie de validation de schéma (ex. Zod) | Validation de la réponse du modèle | \[HYPOTHÈSE TECHNIQUE\] |

## 22. Variables d'environnement

Une seule variable est certaine : `OPENAI_API_KEY`, strictement serveur.

| Variable | Usage | Portée | Statut |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Authentification auprès d'OpenAI | Serveur uniquement, jamais préfixée `NEXT_PUBLIC_` | \[DÉCIDÉ\] |
| `STYLIST_ADVICE_MODEL` (nom indicatif) | Changer de modèle sans redéploiement de code | Serveur | \[À ARBITRER / À CONFIRMER\] |
| `STYLIST_ADVICE_TIMEOUT_MS` (nom indicatif) | Délai maximal de l'appel au modèle | Serveur | \[À ARBITRER / À CONFIRMER\] |
| Nom du bucket Supabase Storage | Stockage des photos Journal | Serveur | \[À ARBITRER / À CONFIRMER\] — seulement si photos conservées |

Les variables Supabase existantes sont réutilisées ; aucune nouvelle variable Supabase n'est requise a priori. \[À CONFIRMER\]

## 23. Architecture des données

Le MVP peut fonctionner sans nouvelle table si le résultat n'est persisté qu'au moment de l'enregistrement Journal ; tout ce qui suit est une proposition à valider, non une implémentation. \[HYPOTHÈSE TECHNIQUE\]

### Principe

- Une analyse non enregistrée n'a pas besoin d'être stockée en base : le résultat vit dans la réponse de l'endpoint et l'état client. \[RECOMMANDÉ\]
- La persistance intervient uniquement sur « Enregistrer dans mon journal ».
- Si le Journal existant accepte un type d'entrée et un contenu structuré, il est réutilisé plutôt que de créer une table dédiée. \[À CONFIRMER — lecture du schéma Journal\]

### Structure proposée du résultat enregistré

```json
{
  "type": "stylist_advice",
  "userId": "uuid",
  "createdAt": "2026-09-25T10:00:00Z",
  "photoPath": "À ARBITRER (null si photo non conservée)",
  "model": "gpt-5.4-mini",
  "result": {
    "overallAssessment": "...",
    "strengths": ["..."],
    "mainAdvice": "...",
    "suggestions": ["..."]
  },
  "dressingItemIds": ["uuid-article-1"]
}
```

### Relations

| Relation | Nature | Point d'attention |
| --- | --- | --- |
| Résultat → Journal | Une entrée Journal par résultat enregistré | Réutiliser la structure Journal existante si possible |
| Résultat → Dressing | Liste d'identifiants d'articles | Si un article est supprimé du dressing, l'entrée Journal reste lisible (article masqué ou mention neutre) \[À ARBITRER\] |
| Résultat → Photo | Chemin vers un objet Storage privé | Dépend de la politique de conservation \[À ARBITRER\] |
| Résultat → Utilisateur | Propriétaire unique, accès restreint par politiques de sécurité au niveau ligne | \[RECOMMANDÉ\] |

### Données de suivi technique (hors Journal)

Pour le suivi du coût et des erreurs, un journal d'usage par analyse (utilisateur, date, modèle, tokens, statut, durée) est utile, sans photo ni texte de conseil. Il sert aussi à appliquer un éventuel quota. Stockage dans une table dédiée ou dans l'outil analytics : \[À ARBITRER\]

## 24. Backlog / évolutions futures (V2)

Aucun des éléments ci-dessous n'est nécessaire au MVP ; ils ne doivent pas être développés dans le périmètre actuel.

| Évolution | Description | Origine |
| --- | --- | --- |
| Variantes stylistiques | Plus chic / Plus décontracté / Plus coloré | Parcours cible, hors liste MVP (section 13) |
| Comparaison avant / après | Comparer une tenue avant et après application du conseil | Brief |
| Historique des conseils | Vue dédiée aux avis passés au-delà du Journal | Brief |
| Évolution du style | Suivre l'évolution des tenues dans le temps | Brief |
| Conseils selon occasion | Saisie d'une occasion avant l'analyse | Brief |
| Analyse de plusieurs looks | Plusieurs photos ou comparaison de tenues | Brief |
| Recommandations shopping | Suggestions d'achat quand aucune pièce du dressing ne convient | Brief |
| Apprentissage par retours utilisateur | Améliorer les recommandations selon les retours (utile / pas utile) | Brief |

## DÉCISIONS PRODUIT

1. Nom : « Avis de styliste » ; positionnement : conseil stylistique personnalisé, jamais « outil d'analyse IA ».
2. Promesse : « Montre-moi ta tenue, je te donne mon avis. »
3. Fonctionnalité exclusivement Premium : Free → Premium Gate → Paywall ; Premium → accès direct.
4. Aucune publicité récompensée.
5. Premium Gate : titre, texte, CTA « Découvrir Premium » et secondaire « Plus tard » figés (section 5).
6. Sources photo : prise de photo et import.
7. L'analyse n'est déclenchée qu'après validation via « Analyser ma tenue ».
8. Structure du résultat : `overallAssessment`, `strengths`, `mainAdvice`, `suggestions`.
9. Sections de résultat : avis global, Ce qui fonctionne, Mon conseil, À tester, Avec ton dressing.
10. « Avec ton dressing » ne propose que des pièces réellement présentes dans le dressing.
11. Variantes (Plus chic, Plus décontracté, Plus coloré) secondaires par rapport à l'avis principal.
12. Action « Enregistrer dans mon journal » et action « Nouvelle analyse ».
13. Ton de voix : bienveillant, expert, concret, personnalisé, positif, accessible ; interdits listés en section 7.
14. Aucune déduction de données médicales, de santé ou de caractéristiques sensibles depuis l'image ; aucun jugement sur le corps.
15. OpenAI Responses API via un endpoint serveur ; secret API exclusivement côté serveur.
16. Contrôle Premium côté serveur.
17. Compression et redimensionnement avant upload.
18. Objectif de ne pas conserver inutilement les photos personnelles.
19. Deux messages d'erreur validés (photo illisible, analyse impossible).
20. Périmètre MVP en 10 points ; tout le reste est V2.

## POINTS À ARBITRER

| # | Sujet | Question | Section |
| --- | --- | --- | --- |
| 1 | Variantes | Dans le MVP ou en V2 ? (présentes dans le parcours, absentes de la liste MVP) | 13 |
| 2 | Conservation des photos | Suppression après analyse ? Conservation si enregistrée au Journal ? Durée ? | 11, 14 |
| 3 | Méthode de matching dressing | Option A (besoins puis recherche) ou B (dressing envoyé au modèle) | 12 |
| 4 | Absence de pièce ou dressing vide | Masquer la section ou message neutre | 12 |
| 5 | Nombre d'articles dressing affichés | Maximum | 12 |
| 6 | Nombre et longueur des éléments | Minimum de `strengths` / `suggestions`, longueur maximale des textes | 8 |
| 7 | Affichage partiel | Résultat incomplet : affiché partiellement ou rejeté | 10, 15 |
| 8 | Quota Premium | Nombre d'analyses par jour ou par mois ; comportement une fois atteint | 5, 15 |
| 9 | Profils d'accès | Distinction Free / sans abonnement / non connecté | 4 |
| 10 | Premium Gate | Forme, visuel, destination de « Plus tard », retour après souscription | 5 |
| 11 | Point d'entrée | Où se trouve la fonctionnalité dans l'app | 3 |
| 12 | Découpage des écrans | Résultat en écran unique scrollable ou écrans séparés | 3, 6 |
| 13 | Personnalisation | Données de profil transmises (style, préférences) | 9 |
| 14 | Formats et tailles | Formats acceptés, taille max, dimension et qualité de compression | 11 |
| 15 | Timeout et retries | Valeurs | 10, 15, 17 |
| 16 | Sortie pendant l'analyse | Annuler ou conserver le résultat | 15 |
| 17 | Clic sur un article suggéré | Destination | 3, 6 |
| 18 | Nouvelle analyse sans enregistrement | Avertissement ou non | 4 |
| 19 | Données Journal | Photo et variantes enregistrées ou non ; affichage de l'entrée | 14 |
| 20 | Modèle de repli | Existe-t-il un fallback | 10 |
| 21 | Outil analytics | Plausible ou PostHog | 16 |
| 22 | Budget | Coût cible par analyse et par utilisateur | 19 |
| 23 | Libellés | Titres de sections, message d'attente, messages d'erreur non validés | 6, 7, 15 |
| 24 | Juridique / RGPD | Tous les points listés en section 18 | 18 |
| 25 | KPI produit | Indicateur de succès de la fonctionnalité | 1 |

## HYPOTHÈSES TECHNIQUES

1. Modèle `gpt-5.4-mini`, configurable par variable d'environnement.
2. Sortie structurée forcée par schéma JSON côté API et validée côté serveur (ex. Zod).
3. Champs `isAnalyzable` et `unanalyzableReason` pour distinguer photo inexploitable et erreur technique.
4. Champs `dressingNeeds` ou `dressingItemIds` selon l'option de matching retenue.
5. Endpoint Next.js (route handler ou server action).
6. Image transmise au modèle en base64 ou via URL signée temporaire.
7. Conversion HEIC → JPEG et suppression EXIF côté client.
8. Timeout serveur inférieur à la limite d'exécution Vercel.
9. Une nouvelle tentative automatique maximum sur réponse invalide.
10. Contrôle automatique de sortie (ex. détection de notes) avant affichage.
11. Variantes générées par un appel séparé, à la demande (si incluses).
12. Pas de persistance d'une analyse avant enregistrement Journal ; réutilisation du modèle Journal existant.
13. Photos Journal dans un bucket Supabase privé avec politiques d'accès par propriétaire.
14. Journal d'usage technique par analyse pour le coût et un éventuel quota.

## MVP VS V2

| MVP — à développer maintenant | V2 — peut attendre |
| --- | --- |
| Prendre / importer une photo | Variantes stylistiques (sauf arbitrage contraire) |
| Analyser la tenue | Comparaison avant / après |
| Avis global | Historique des conseils |
| Ce qui fonctionne | Évolution du style |
| Conseil principal | Conseils selon occasion |
| Suggestions (À tester) | Analyse de plusieurs looks |
| Pièces du dressing (éventuellement) | Recommandations shopping |
| Enregistrer dans le Journal | Apprentissage par retours utilisateur |
| Gestion des erreurs |  |
| Réservation Premium (Gate + Paywall) |  |

## CHECKLIST CLAUDE CODE

### Avant de coder

- [ ] Lire le code existant : système Premium, Paywall, dressing, Journal, auth. Ne rien recréer qui existe déjà.
- [ ] Vérifier que chaque point « À ARBITRER » touché par la tâche a été tranché. Sinon, s'arrêter et demander.
- [ ] Ne jamais transformer une hypothèse technique en décision sans la signaler.

### Accès

- [ ] Contrôle Premium côté serveur sur l'endpoint d'analyse.
- [ ] Premium Gate avec les libellés exacts ; « Découvrir Premium » → Paywall.
- [ ] Aucune publicité récompensée.

### Photo

- [ ] Prise de photo et import.
- [ ] Aperçu, remplacement, suppression.
- [ ] Compression et redimensionnement avant upload.
- [ ] Validation client et serveur (type, taille).
- [ ] Envoi uniquement sur « Analyser ma tenue ».

### Analyse

- [ ] Endpoint serveur ; `OPENAI_API_KEY` jamais exposée côté client.
- [ ] Instructions système intégrant ton, interdits et format.
- [ ] Contexte utilisateur limité aux données autorisées (section 9).
- [ ] Validation du JSON avant envoi au client.
- [ ] Timeout et retry implémentés.
- [ ] Loading visible, double envoi impossible.

### Résultat

- [ ] Avis global, Ce qui fonctionne, Mon conseil, À tester.
- [ ] Avec ton dressing : uniquement des articles existants de l'utilisateur ; cas « aucune pièce » géré.
- [ ] Enregistrer dans mon journal (anti-doublon, gestion d'échec).
- [ ] Nouvelle analyse.

### Erreurs

- [ ] Tous les cas de la section 15, avec les messages validés.
- [ ] Aucun message technique brut.

### Données, analytics, sécurité

- [ ] Événements de la section 16, sans donnée personnelle ni photo ni texte de conseil.
- [ ] Aucune photo ni conseil dans les logs et Sentry.
- [ ] Photos non enregistrées traitées selon la règle arbitrée.
- [ ] Tokens et modèle journalisés par analyse pour le suivi du coût.

### Recette

- [ ] Tous les critères de la section 20 vérifiés.
- [ ] Tests de ton sur un jeu de photos varié : aucune note, aucun jugement corporel, aucune affirmation catégorique.
- [ ] Aucun élément V2 développé.
