-- Remplace `colorimetrie` (colonne texte libre, jamais exploitée) par deux
-- colonnes alignées sur les étapes d'onboarding PALETTE déjà en place
-- (palette_affinite / palette_intensite sur profiles, migration 0004) — pour
-- que la capsule par défaut reflète le ton et l'intensité déclarés par
-- l'utilisatrice, pas seulement ses couleurs de palette exactes (recette
-- 12/08/2026, demande explicite : "il faudrait que la capsule reflète ces
-- informations"). Additif/idempotent pour les colonnes nouvelles.

alter table public.vestiaire_universel drop column if exists colorimetrie;

alter table public.vestiaire_universel add column if not exists tons text null;
alter table public.vestiaire_universel
  drop constraint if exists vestiaire_universel_tons_check;
alter table public.vestiaire_universel
  add constraint vestiaire_universel_tons_check
  check (tons is null or tons in ('chauds', 'froids', 'les_deux'));

alter table public.vestiaire_universel add column if not exists intensite text null;
alter table public.vestiaire_universel
  drop constraint if exists vestiaire_universel_intensite_check;
alter table public.vestiaire_universel
  add constraint vestiaire_universel_intensite_check
  check (intensite is null or intensite in ('douce', 'intense', 'lumineuse', 'melange'));
