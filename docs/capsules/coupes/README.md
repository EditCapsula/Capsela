# Lot 5 — compléter la colonne `coupe` du catalogue

31/10/2026. **Rien n'est écrit en base.** SQL prêt, à exécuter à la main après validation (CLAUDE.md).

- Source : export `vestiaire_universel` du 31/10/2026 après-midi (845 articles, Créatif compris, identifiants réels).
- `coupes-catalogue-a-valider.xlsx` : les 500 vêtements sans coupe, dont **76 propositions (27 Ajusté, 49 Ample)** avec leur motif.
  Généré par `outils/proposer.py` ; SQL généré depuis ce fichier par `outils/sql.py` (colonne « validation » : vide ou Oui = la
  proposition, Non = rien, Serré / Ajusté / Ample = cette valeur).
- Règle (ARBITRAGE ÉDITORIAL, à valider) : une proposition seulement quand le TYPE de vêtement tranche — cigarette, crayon, fourreau,
  body, legging, brassière, bustier, bandeau, col roulé fin / sous-pull → Ajusté ; wide leg, palazzo, relaxed, cargo, jogging,
  sweat à capuche, surchemise, manches ballon / bouffantes, cape, kimono / poncho, trapèze / ligne A → Ample. Laissés vides :
  flare, coupes « normales » (aucun bonus, aucune pénalité). Retirées à la relecture : « wide » seul (Jean droit Straight/Wide),
  « maille fine » (polos), « déstructuré » (non doublé, pas ample), « doudoune / shearling » (un type, pas une coupe).
- `sql/01-completer-coupes.sql` ne remplit que les coupes VIDES de pièces non gelées ; `sql/02-annuler.sql` remet à vide les
  seules coupes que 01 a écrites.

## Mesures (même exécution, même pool : export du 31/10 sans / avec les 76 coupes)

- Coupe connue : 50 % → 60 % des vêtements (ajustées 25 → 52, amples 93 → 142).
- Avec une coupe préférée (production lot 4) — gain de la part de la coupe dans la capsule : femme ajustées +0,7 → +2,5 pts,
  amples +3,4 → +5,4 pts ; homme amples +2,0 → +5,5 pts. Autres coupes inchangées. DÉMONTRÉ.
- Sans préférence : capsules identiques (femme sans silhouette, poire, sablier, homme : 0 modifiée) sauf triangle inversé 13/36
  (pièces orientées par la silhouette 7,0 → 10,0 : la direction lit la coupe). Tenues complètes 100 % partout. DÉMONTRÉ.
- Haut et bas tous deux amples ou ajustés, compté sur les ÉTIQUETTES : ≈ 0,1 % → 0,5 à 2,3 %. Ces pièces étaient déjà amples ou
  ajustées sans le dire ; une dégradation réelle des tenues est NON DÉMONTRÉE.
- La coupe entre aussi dans le texte de génération des visuels : les images existantes ne changent pas ; une image régénérée plus
  tard en tiendra compte.
