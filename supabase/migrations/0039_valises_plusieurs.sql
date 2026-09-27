-- Plusieurs valises par compte (docs/valise.md, 27/09/2026).
--
-- 0038 limitait à une valise par compte (unique user_id) : l'écran n'en
-- montrait qu'une. Les valises remontent désormais dans « Mes
-- planifications » de Planifier, à venir puis passées : « Nouvelle valise »
-- en ajoute une au lieu de remplacer la précédente.
--
-- Le nom de la contrainte est celui que PostgreSQL donne à un
-- `unique (user_id)` déclaré dans le create table : valises_user_id_key.
-- `if exists` rend la migration relançable.

alter table public.valises drop constraint if exists valises_user_id_key;

create index if not exists valises_user_depart_idx
  on public.valises (user_id, depart);
