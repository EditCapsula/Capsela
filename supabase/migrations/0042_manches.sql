-- La longueur des manches d'une pièce (01/10/2026, demandé : « Il faudrait
-- ajouter la notion de manches longues »).
--
-- Trois valeurs : 'sans' (sans manches, bretelles), 'courtes', 'longues'.
-- Elle sert à ne forcer la veste par temps frais que sur un haut qui laisse
-- les bras nus, à retenir un haut à manches longues parmi les pièces clés
-- d'une capsule d'automne-hiver, et à préférer ces hauts quand il fait frais.
--
-- UNE COLONNE NULLABLE SUR CHAQUE TABLE, AUCUNE VALEUR PAR DÉFAUT : les lignes
-- existantes ne sont pas réécrites, et sans valeur le moteur se comporte comme
-- avant. L'app n'écrit la colonne de `dressing_items` que lorsque l'utilisatrice
-- choisit une longueur, et son échec est signalé à l'écran : tant que cette
-- migration n'est pas exécutée, rien d'autre ne casse.
--
-- `vestiaire_universel` : le catalogue est lu par l'app, jamais écrit. La
-- colonne attend d'être renseignée pièce par pièce — rien n'est déduit d'un
-- nom ou d'un sous-type.
--
-- Pas de nouvelle politique RLS : « Users can update own dressing items »
-- (0021) couvre déjà cette colonne comme les autres.

alter table public.dressing_items add column if not exists manches text;
alter table public.dressing_items drop constraint if exists dressing_items_manches_check;
alter table public.dressing_items add constraint dressing_items_manches_check
  check (manches is null or manches in ('sans', 'courtes', 'longues'));

alter table public.vestiaire_universel add column if not exists manches text;
alter table public.vestiaire_universel drop constraint if exists vestiaire_universel_manches_check;
alter table public.vestiaire_universel add constraint vestiaire_universel_manches_check
  check (manches is null or manches in ('sans', 'courtes', 'longues'));
