-- Les quatre saisons d'une pièce du dressing (27/09/2026, demandé : « Je veux
-- 4 saisons »).
--
-- L'écran « Ajouter une pièce » propose désormais Printemps, Été, Automne et
-- Hiver, cochables séparément. La colonne `season` (trois valeurs : 'Printemps
-- / Été', 'Automne / Hiver', 'Toutes saisons') N'EST PAS TOUCHÉE : l'app
-- continue de l'écrire, déduite des saisons choisies, et le moteur de tenues
-- ne lit qu'elle. Cette colonne-ci garde le détail.
--
-- UNE COLONNE NULLABLE, AUCUNE VALEUR PAR DÉFAUT : les lignes existantes ne
-- sont pas réécrites. Sans valeur, l'app retombe sur `season` (« Automne /
-- Hiver » s'affiche « Automne · Hiver »).
--
-- La contrainte porte uniquement sur la nouvelle colonne : chaque valeur doit
-- être l'une des quatre saisons.
--
-- Pas de nouvelle politique RLS : « Users can update own dressing items »
-- (0021) couvre déjà cette colonne comme les autres.

alter table public.dressing_items
  add column if not exists saisons text[];

alter table public.dressing_items drop constraint if exists dressing_items_saisons_check;
alter table public.dressing_items add constraint dressing_items_saisons_check
  check (saisons is null or saisons <@ array['Printemps', 'Été', 'Automne', 'Hiver']::text[]);
