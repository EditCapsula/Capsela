# Taxonomie des occasions (08/10/2026)

Neuf occasions, source unique `OCCASIONS` (`src/lib/data.ts`) — tous les écrans (Planifier, Tenue du jour, création de look, ajout d'une pièce, filtres du Journal) la lisent, aucune liste locale :

Quotidien / Décontracté · Travail / Bureau · Rendez-vous important · Rendez-vous amoureux · Soirée · Sport · Cocooning / Maison · Voyage / Déplacement · Événement / Cérémonie.

**Supprimée** : « Sortie festive » (clé `festive`). **Renommée** : « Sortie / Soirée » → « Soirée » (clé `soiree`, inchangée).

## Anciennes données

Rien n'est réécrit en base. Toute lecture passe par `normaliserOccasion(s)` (`src/lib/occasions.ts`) : `festive`, `sortie_festive` et `sortie_soiree` se lisent `soiree` (planifications, journal, looks enregistrés, étiquettes des pièces du dressing et du catalogue, occasions d'une valise). Une ancienne planification rouverte puis enregistrée est donc réécrite `soiree`. `occasion` n'a pas de CHECK en base (migration 0030) : aucune migration n'est nécessaire. Nettoyage facultatif, à lancer à la main :

```sql
update planned_outfits set occasion = 'soiree' where occasion in ('festive', 'sortie_festive', 'sortie_soiree');
update outfit_history  set occasion = 'soiree' where occasion in ('festive', 'sortie_festive', 'sortie_soiree');
update saved_looks     set occasion = 'soiree' where occasion in ('festive', 'sortie_festive', 'sortie_soiree');
```

Dans une valise enregistrée, la sous-occasion `soiree_festive` se lit comme « Soirée » (`elementProgramme`).

## Ce que l'occasion « festive » portait, et où c'est passé

Le niveau d'habillage n'est plus un choix de l'utilisatrice : c'est `soireeHabillee` (`occasions.ts`), déduit du contexte de la soirée dans Planifier — **Bar / Rooftop** pour le type de lieu, ou la préférence **Élégant(e)** / **Audacieux(se)**. ARBITRAGE ÉDITORIAL, non mesuré. Une soirée habillée reprend les règles de l'ancienne occasion, à tout palier de formalité :

| Règle | Avant (`festive`) | Maintenant |
|---|---|---|
| Formalité demandée | 4 (repli 4 → 3 → 1) | 4 si habillée, 3 sinon (`effectiveFormality`) |
| Chaussures (R-S16) | talons préférés | idem (`PREFS_SOIREE_HABILLEE`) |
| Pas de chemise / robe chemise (R-S17) | oui | oui, si habillée |
| Sandales à talons en automne | oui | oui, si habillée |

Sans contexte (tenue du jour, valise), la soirée reste polyvalente : formalité 3, comme l'ancienne « Sortie / Soirée ». Un événement particulier reste l'occasion « Événement / Cérémonie ». Le type de lieu n'entre dans le moteur que pour cette occasion.

## Points laissés tels quels

- « Soirée festive » reste un sous-contexte du Rendez-vous amoureux (`DateContext`, formalité 3) : ce n'est pas une occasion.
- Les audits `scripts/*.audit.ts` mesuraient les étiquettes `festive` du catalogue ; ils datent de l'ancienne taxonomie (le type est contourné par un cast).
- Libellé court du filtre du Journal pour « Rendez-vous amoureux » : toujours « Date ».
