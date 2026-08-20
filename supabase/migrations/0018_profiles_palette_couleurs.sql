-- Fusion des 3 champs de palette personnelle (Tâche 8, arbitrages du
-- 20/08/2026) : palette_base + palette_neutres + palette_accents en un seul
-- champ multi-valeurs. Aucune logique — scoring (R-S10) ou capsule — ne les
-- distinguait déjà : paletteHexes() les fusionnait dès la lecture. Trois
-- champs et trois écrans d'onboarding pour une seule donnée.
--
-- palette_affinite / palette_intensite ne sont PAS concernés par cette
-- migration : leur portée (filtre de repli dans computeDefaultCapsule sur
-- les pièces dont la couleur n'est pas explicitement choisie) est confirmée
-- conforme à la spec.
--
-- Application non lancée, aucune donnée réelle : pas de migration de
-- données, on supprime les anciennes colonnes et on recrée directement.
alter table public.profiles drop column if exists palette_base;
alter table public.profiles drop column if exists palette_neutres;
alter table public.profiles drop column if exists palette_accents;
alter table public.profiles add column if not exists palette_couleurs text[] not null default '{}';
