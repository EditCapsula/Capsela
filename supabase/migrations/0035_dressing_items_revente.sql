-- Choix de revente sur une pièce du dressing (refonte du Journal, 25/09/2026).
--
-- Le Journal peut suggérer d'envisager de vendre une pièce qui n'a pas été
-- portée depuis deux saisons écoulées. L'utilisatrice répond :
--   'gardee'  → « Garder dans mon dressing » : on ne le lui repropose plus ;
--   'de_cote' → « Mettre de côté pour vendre » : la pièce RESTE dans son
--               dressing, simplement marquée ;
--   null      → aucun choix (valeur de toutes les lignes existantes).
--
-- UNE COLONNE NULLABLE, AUCUNE VALEUR PAR DÉFAUT : les lignes existantes ne
-- sont ni réécrites ni marquées. Rien n'est vendu, rien n'est supprimé.
--
-- La contrainte CHECK de la table (catégories, saisons, types) N'EST PAS
-- TOUCHÉE : celle-ci porte uniquement sur la nouvelle colonne.
--
-- Pas de nouvelle politique RLS : « Users can update own dressing items »
-- (0021) couvre déjà cette colonne comme les autres.

alter table public.dressing_items
  add column if not exists revente text;

alter table public.dressing_items drop constraint if exists dressing_items_revente_check;
alter table public.dressing_items add constraint dressing_items_revente_check
  check (revente is null or revente in ('gardee', 'de_cote'));
