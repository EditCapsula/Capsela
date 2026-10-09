# Fiche d'une pièce — « en vitrine » (10/10/2026)

Maquette « Fiche d'une pièce », piste 1B retenue, appliquée à `PieceScreen.tsx` pour une pièce DU DRESSING. Une suggestion de la capsule (`activeSuggested`) garde l'ancienne mise en page.

- Photo en entier, jamais recadrée (`contain`), sur fond de carte ; retour, marque CAPSELA et menu « ⋯ » posés dessus.
- Feuille en recouvrement : surtitre (type) et statut de port (information, non modifiable), titre en deux temps (`titreEnDeuxTemps`), bandeau Couleur / Manches / Taille (ou Pointure) — les manches seulement pour une pièce qui en a, « À préciser » quand la donnée manque.
- « Quand la porter » : une phrase tirée des saisons et occasions ENREGISTRÉES (`phraseQuandPorter`), rien d'inventé.
- Détails en puces (marque, matière, coupe, modèle ou longueur) ; « Ajouter matière, coupe, taille » ouvre la modification quand ces champs s'appliquent et manquent (`champsManquants`).
- Actions fixées au-dessus de la navigation : « Voir les tenues associées » et « + » (ajouter à un look).
- Écarts avec la maquette : pas de pastille de nombre de looks sur le bouton (aucun décompte fiable à cet endroit) ; le statut de port n'ouvre pas de menu (la maquette n'en définit aucun qui existe dans l'app) ; le bloc « looks avec elle » de la piste A n'est pas repris (piste B retenue).
- Rendu non vu à l'écran dans cet environnement.
