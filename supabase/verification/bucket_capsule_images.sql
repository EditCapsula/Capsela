-- BUCKET `capsule-images` — INSPECTION EN LECTURE SEULE (01/10/2026).
--
-- Ce bucket public existe dans ton projet mais n'apparaît dans AUCUN fichier du
-- dépôt : ni migration, ni code de l'app, ni script, ni workflow, ni document.
-- (Les visuels du catalogue vont dans `catalog-images`, les photos de dressing
-- dans `dressing-photos`, celles des avis dans `avis-styliste-photos`.) Il a
-- donc été créé à la main. Public, ce qu'il contient se lit sans connexion.
--
-- Ce script ne modifie rien. Un seul résultat (section, element, detail).
-- Envoie-le-moi : on décide ensuite de le garder ou de le supprimer.

select section, element, detail
from (
  select '1 réglage' as section, id::text as element,
         'public=' || public || ' · taille max=' || coalesce(file_size_limit::text, 'aucune')
         || ' · types=' || coalesce(array_to_string(allowed_mime_types, ','), 'tous')
         || ' · créé le ' || created_at::date as detail
  from storage.buckets where id = 'capsule-images'

  union all
  select '2 contenu', 'fichiers',
         count(*)::text || ' fichier(s) · '
         || coalesce(pg_size_pretty(sum((metadata->>'size')::bigint)), '0 octet')
         || ' · du ' || coalesce(min(created_at)::date::text, '—') || ' au ' || coalesce(max(created_at)::date::text, '—')
  from storage.objects where bucket_id = 'capsule-images'

  union all
  (select '3 aperçu', name, coalesce(metadata->>'mimetype', '?') || ' · ' || coalesce(pg_size_pretty((metadata->>'size')::bigint), '?')
   from storage.objects where bucket_id = 'capsule-images'
   order by created_at desc limit 15)

  union all
  select '4 politique', policyname::text, cmd::text || ' sur storage.objects'
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual, '') ilike '%capsule-images%' or coalesce(with_check, '') ilike '%capsule-images%')

  -- Une ligne de la base pointe-t-elle vers ce bucket ? Si oui, le supprimer
  -- casserait un affichage. Recherche dans les tables qui portent des URL d'images.
  union all
  select '5 référencé par', t.nom, t.n::text || ' ligne(s)'
  from (
    select 'vestiaire_universel' as nom, count(*) as n from public.vestiaire_universel v where to_jsonb(v)::text ilike '%capsule-images%'
    union all select 'visual_assets', count(*) from public.visual_assets v where to_jsonb(v)::text ilike '%capsule-images%'
    union all select 'tendances_mode', count(*) from public.tendances_mode v where to_jsonb(v)::text ilike '%capsule-images%'
    union all select 'profiles', count(*) from public.profiles v where to_jsonb(v)::text ilike '%capsule-images%'
    union all select 'dressing_items', count(*) from public.dressing_items v where to_jsonb(v)::text ilike '%capsule-images%'
    union all select 'saved_looks', count(*) from public.saved_looks v where to_jsonb(v)::text ilike '%capsule-images%'
  ) t
) r
order by section, element;
