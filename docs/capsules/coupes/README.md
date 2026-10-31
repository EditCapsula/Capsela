# Lot 5 — compléter la colonne `coupe` du catalogue

31/10/2026. **Rien n'est écrit en base.** Proposition à valider pièce par pièce (AGENTS.md, points 6 et 7).

- `coupes-catalogue-a-valider.xlsx` : les 500 vêtements sans coupe (343 de l'export du 31/10, 157 pièces Créatif créées), dont
  95 avec une proposition (34 Ajusté, 61 Ample) et son motif. Généré par `outils/proposer.py` (Python `-I`, arguments : export
  CSV, `docs/capsules/creatif/sql/revue.json`, fichier de sortie).
- Règle : une proposition seulement quand le TYPE de vêtement tranche (cigarette, crayon, fourreau, body, legging… → Ajusté ;
  wide leg, relaxed, cargo, jogging, surchemise, manches ballon, cape, trapèze… → Ample). Flare et coupes « normales » : vide
  (aucun bonus, aucune pénalité). Les pièces dont le nom dit déjà la coupe (lu par `coupeOf`) sont exclues.
- Mesures (`scripts/coupes-catalogue.audit.ts`, `scripts/preferences-silhouette.audit.ts` avec `COUPES_ENRICHIES`) : coupe
  connue 50 % → 62,5 % ; sans préférence, capsules inchangées sauf poire 3/36 et triangle inversé 16/36 (la direction
  morphologique lit la coupe), tenues complètes 100 % partout ; haut et bas tous deux amples ou ajustés (compté sur les
  étiquettes) ≈ 0 % → 1 à 2 %.
- Suite : relecture du fichier par la propriétaire, export récent de `vestiaire_universel` (identifiants des pièces Créatif),
  puis SQL montré avant exécution — ne remplit que les coupes vides, avec sa requête d'annulation.
