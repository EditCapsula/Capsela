-- Ajoute "invalid" aux statuts possibles (recette 18/08/2026 — correctif
-- mapping catégorie/visuel incorrect) : une image générée qui ne correspond
-- pas à l'article (ex. veste affichée pour un pantalon) doit pouvoir être
-- marquée invalide sans jamais être réutilisée par la cascade de
-- déduplication (qui ne considère déjà que image_status = 'ready').

alter table public.vestiaire_universel drop constraint if exists vestiaire_universel_image_status_check;
alter table public.vestiaire_universel add constraint vestiaire_universel_image_status_check
  check (image_status in ('missing', 'generating', 'ready', 'error', 'invalid'));

alter table public.visual_assets drop constraint if exists visual_assets_image_status_check;
alter table public.visual_assets add constraint visual_assets_image_status_check
  check (image_status in ('missing', 'generating', 'ready', 'error', 'invalid'));
