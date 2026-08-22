-- Ajoute "Sac de sport" (sac_type) et "Gourde" (accessoire_type), tous deux
-- réservés à l'occasion Sport côté app (logic.ts : le sac n'est éligible en
-- Sport que s'il est de type "Sac de sport" ; la gourde n'est éligible qu'en
-- Sport, exclue de toutes les autres occasions).

alter table public.dressing_items
  drop constraint if exists dressing_items_sac_type_check;

alter table public.dressing_items
  add constraint dressing_items_sac_type_check
  check (sac_type is null or sac_type in (
    'Sac à main', 'Cabas', 'Bandoulière', 'Pochette', 'Sac à dos', 'Sac de sport'
  ));

alter table public.dressing_items
  drop constraint if exists dressing_items_accessoire_type_check;

alter table public.dressing_items
  add constraint dressing_items_accessoire_type_check
  check (accessoire_type is null or accessoire_type in (
    'Ceinture', 'Foulard', 'Écharpe', 'Chapeau', 'Casquette', 'Lunettes',
    'Collants', 'Chaussettes hautes', 'Gourde'
  ));
