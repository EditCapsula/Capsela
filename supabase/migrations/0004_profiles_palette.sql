-- Palette personnelle (remplace l'ancien champ favorite_colors, recette 12/08/2026).
-- Additif et idempotent — sûr à rejouer sur la table profiles existante.

alter table public.profiles add column if not exists palette_base text;
alter table public.profiles add column if not exists palette_neutres text[] not null default '{}';
alter table public.profiles add column if not exists palette_accents text[] not null default '{}';
alter table public.profiles add column if not exists palette_affinite text;
alter table public.profiles
  drop constraint if exists profiles_palette_affinite_check;
alter table public.profiles
  add constraint profiles_palette_affinite_check
  check (palette_affinite is null or palette_affinite in ('Tons chauds', 'Tons froids', 'Les deux', 'Je ne sais pas'));

alter table public.profiles add column if not exists palette_intensite text;
alter table public.profiles
  drop constraint if exists profiles_palette_intensite_check;
alter table public.profiles
  add constraint profiles_palette_intensite_check
  check (palette_intensite is null or palette_intensite in ('Douces et discrètes', 'Profondes et intenses', 'Lumineuses', 'Un mélange'));

-- L'app n'écrit plus dans favorite_colors — conservée pour l'instant plutôt que
-- supprimée (des lignes existantes peuvent encore la référencer), à retirer
-- dans une migration ultérieure une fois la bascule confirmée en production.
