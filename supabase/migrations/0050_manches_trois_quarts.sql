-- Manches 3/4 (09/10/2026, maquette « Ajouter une pièce V3 ») : une quatrième
-- valeur pour la longueur des manches d'une pièce, 'trois_quarts'.
--
-- Seule la contrainte change : la colonne existe depuis la migration 0042. Les
-- lignes existantes ne sont pas touchées. Tant que cette migration n'est pas
-- exécutée, l'app fonctionne : choisir « Manches 3/4 » échoue à l'enregistrement
-- de cette seule colonne, et l'échec est signalé à l'écran (jamais silencieux).

alter table public.dressing_items drop constraint if exists dressing_items_manches_check;
alter table public.dressing_items add constraint dressing_items_manches_check
  check (manches is null or manches in ('sans', 'courtes', 'trois_quarts', 'longues'));

alter table public.vestiaire_universel drop constraint if exists vestiaire_universel_manches_check;
alter table public.vestiaire_universel add constraint vestiaire_universel_manches_check
  check (manches is null or manches in ('sans', 'courtes', 'trois_quarts', 'longues'));
