# Créer un look — parcours en étapes (15/10/2026)

Brief « Optimisation du parcours de création de look ». Évolution de `CreateLookScreen.tsx`, pas une refonte : les règles de sélection (R-B5, jamais deux pièces de base, filtres Sport/Cocooning, remplacement dans une même catégorie), le score et le minimum de deux pièces sont inchangés.

## Parcours
1. **Contexte** — trois sections en tuiles à icône (`TuileIcone` de `PlanifierUI`, celles des étapes de Planifier), sans aucune image :
   - **1. Occasion** (facultative) : les huit occasions (`OCCASIONS`, libellés courts `occasionShortLabel`, glyphes `GlypheOccasion`), sélectionnables directement ; un second appui retire l'occasion. Elle n'est plus dans une feuille.
   - **2. Saison** : Printemps, Été, Automne, Hiver (`CapsuleSeason`, pictogrammes ajoutés au jeu de `PlanifierUI`). Par défaut, la saison calendaire du jour (`currentSeasonKey`, la règle de la capsule).
   - **3. Intention de style** (facultative) : les humeurs de Planifier (`humeursProposees`, `humeur.ts`), mêmes icônes.
   - « Commencer mon look ».
2. **Pièces** — l'écran d'avant, plus : le contexte rappelé en une ligne avec « Modifier » (le brouillon est gardé : il vit dans le store) ; « Aperçu » (feuille, `FlatLayCapsela` des pièces choisies) ; toucher une vignette du look ouvre sa catégorie pour la **remplacer** ; la croix la retire.
3. **Confirmation** — seulement après l'écriture réelle : `saveLook` est maintenant asynchrone et rend `ok` / `erreur` / `refuse`. Avant, l'écran revenait au Dressing avant la réponse de la base et un échec perdait le brouillon. Échec : message, brouillon intact, bouton à nouveau disponible. Succès : « Ton look est enregistré », la planche, « Voir mes looks », « Créer un autre look », « Revenir au dressing ».

## Ce que la saison et l'intention changent (moteur existant, aucune règle nouvelle)
- **Saison** : la météo représentative de la saison (`representativeWeatherFor`, comme « Comment porter ») remplace la météo du jour dans `computeLookScore` et `evaluateBlocking`. Le conseil R-B1 nomme la saison choisie (« pas vraiment de saison pour l'hiver ») au lieu de « aujourd'hui ».
- **Rangement des pièces** (jamais un filtre) : d'abord les pièces de la saison (`estDeSaison`), puis, à saison égale, celles qui répondent à l'intention (`affiniteHumeur`).

## Limites
- Saison et intention **ne sont pas enregistrées** avec le look : `saved_looks` n'a pas de colonne pour elles (aucune migration, demandé). L'occasion l'est, comme avant.
- Le moteur n'a pas de « suggestion de pièce complémentaire » pour un look manuel : les conseils restent ceux du score (`proactives`, liens « Voir les… »).
- Planification : non proposée depuis la confirmation (Planifier part d'une date et compose sa tenue ; il ne reprend pas un look enregistré).
- L'échec d'enregistrement n'a pas pu être provoqué en démo (pas de base) : chemin relu, non vu à l'écran.

## Vérifié (rendu réel, mode démo)
Contexte (Soirée, Hiver, Élégante), trois pièces de catégories différentes, remplacement de la jupe depuis sa vignette, aperçu, retour au contexte (Automne) puis aux pièces sans perte, enregistrement, confirmation, « Mes looks » contient le look. 320, 390 et 1 280 px sans débordement.
