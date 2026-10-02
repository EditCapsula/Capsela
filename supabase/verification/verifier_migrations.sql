-- VÉRIFICATION DES MIGRATIONS — LECTURE SEULE (01/10/2026).
--
-- À coller dans l'éditeur SQL de Supabase (SQL Editor) et à exécuter : rien
-- n'est écrit, aucune migration n'est appliquée. Les migrations de
-- supabase/migrations/ sont exécutées À LA MAIN : ce script dit lesquelles ont
-- laissé leur trace en base, d'après ce que chacune crée (tables, colonnes,
-- fonctions, buckets, politiques RLS, contraintes, index).
--
-- Généré à partir des fichiers 0001 à 0046. Une migration « complète » a
-- manquants = 0. Une migration qui ne crée rien de testable (0002, 0003 pour
-- ses seules données…) peut ne pas apparaître.
--
-- LIMITES, À LIRE : il détecte la PRÉSENCE d'objets, pas leur contenu — une
-- contrainte rendue à jour par une migration plus récente (profiles_gender_check,
-- 0019) apparaît présente même si seule une version ancienne a été exécutée. Les
-- politiques supprimées par une migration plus récente ne sont pas testées, ni les
-- colonnes qu'une migration plus récente retire (palette_base, palette_neutres,
-- palette_accents, retirées par 0018).
--
-- 0002 n'est pas testée : la table `pieces` est un schéma obsolète jamais branché
-- au code (cf. l'en-tête de 0021) ; son absence en base est sans effet.
--
-- Vérifié en rejouant 0001 à 0046 dans l'ordre sur un PostgreSQL 16 neuf (avec de
-- simples bouchons pour auth et storage) : toutes les lignes sortent « complète ».
-- Ce rejeu a révélé que 0033 échouait à cause d'un type de retour de fonction
-- modifié ; corrigé (drop function if exists).

-- UN SEUL RÉSULTAT (l'éditeur SQL n'affiche que la dernière requête) : quatre
-- sections, triées. Section 1 : une ligne par migration. Section 2 : tables
-- publiques sans RLS (attendu : aucune). Section 3 : buckets de stockage
-- (attendu : dressing-photos et avis-styliste-photos privés, catalog-images
-- public). Section 4 : le catalogue, dont les liens « Acheter » (à signaler
-- comme liens commerciaux s'il y en a — docs/legal/README.md, écart 3).
with attendu(migration, type, objet, parent) as (
  values
    ('0001', 'fonction', 'handle_new_user', ''),
    ('0001', 'fonction', 'set_updated_at', ''),
    ('0001', 'politique', 'Users can insert own profile', ''),
    ('0001', 'politique', 'Users can read own profile', ''),
    ('0001', 'politique', 'Users can update own profile', ''),
    ('0001', 'table', 'profiles', ''),
    ('0003', 'colonne', 'couleur_dominante', 'vestiaire_universel'),
    ('0003', 'colonne', 'genre', 'vestiaire_universel'),
    ('0003', 'colonne', 'hex', 'vestiaire_universel'),
    ('0003', 'colonne', 'matiere', 'vestiaire_universel'),
    ('0003', 'colonne', 'name', 'vestiaire_universel'),
    ('0003', 'colonne', 'niveau_formalite', 'vestiaire_universel'),
    ('0003', 'colonne', 'role_piece', 'vestiaire_universel'),
    ('0003', 'colonne', 'sous_type', 'vestiaire_universel'),
    ('0003', 'table', 'vestiaire_universel', ''),
    ('0004', 'colonne', 'palette_affinite', 'profiles'),
    ('0004', 'colonne', 'palette_intensite', 'profiles'),
    ('0005', 'colonne', 'intensite', 'vestiaire_universel'),
    ('0005', 'colonne', 'tons', 'vestiaire_universel'),
    ('0006', 'colonne', 'couleur_secondaire', 'vestiaire_universel'),
    ('0006', 'colonne', 'coupe', 'vestiaire_universel'),
    ('0006', 'colonne', 'lien_affiliation', 'vestiaire_universel'),
    ('0006', 'colonne', 'metal_dominant', 'vestiaire_universel'),
    ('0006', 'colonne', 'role_couleur_palette', 'vestiaire_universel'),
    ('0006', 'colonne', 'statement', 'vestiaire_universel'),
    ('0007', 'colonne', 'necessite_soleil', 'vestiaire_universel'),
    ('0008', 'contrainte', 'profiles_taille_haut_check', ''),
    ('0009', 'colonne', 'affiliate_image_url', 'vestiaire_universel'),
    ('0009', 'colonne', 'image_generated_at', 'vestiaire_universel'),
    ('0009', 'colonne', 'image_prompt', 'vestiaire_universel'),
    ('0009', 'colonne', 'image_source', 'vestiaire_universel'),
    ('0009', 'colonne', 'image_status', 'vestiaire_universel'),
    ('0009', 'colonne', 'image_version', 'vestiaire_universel'),
    ('0010', 'bucket', 'catalog-images', ''),
    ('0011', 'colonne', 'visual_asset_id', 'vestiaire_universel'),
    ('0011', 'table', 'image_generation_logs', ''),
    ('0011', 'table', 'visual_assets', ''),
    ('0012', 'contrainte', 'vestiaire_universel_image_status_check', ''),
    ('0012', 'contrainte', 'visual_assets_image_status_check', ''),
    ('0013', 'contrainte', 'vestiaire_universel_genre_check', ''),
    ('0014', 'colonne', 'details_mode', 'vestiaire_universel'),
    ('0014', 'colonne', 'niveau_tendance', 'vestiaire_universel'),
    ('0014', 'colonne', 'prompt_image_override', 'vestiaire_universel'),
    ('0014', 'colonne', 'silhouette_mode', 'vestiaire_universel'),
    ('0014', 'table', 'tendances_mode', ''),
    ('0015', 'colonne', 'niveau_tendance', 'visual_assets'),
    ('0016', 'colonne', 'oversize', 'visual_assets'),
    ('0017', 'colonne', 'occasions', 'vestiaire_universel'),
    ('0018', 'colonne', 'palette_couleurs', 'profiles'),
    ('0019', 'contrainte', 'profiles_gender_check', ''),
    ('0020', 'colonne', 'frozen', 'vestiaire_universel'),
    ('0021', 'politique', 'Users can delete own dressing items', ''),
    ('0021', 'politique', 'Users can insert own dressing items', ''),
    ('0021', 'politique', 'Users can read own dressing items', ''),
    ('0021', 'politique', 'Users can update own dressing items', ''),
    ('0021', 'table', 'dressing_items', ''),
    ('0022', 'politique', 'Users can delete own outfit history', ''),
    ('0022', 'politique', 'Users can insert own outfit history', ''),
    ('0022', 'politique', 'Users can read own outfit history', ''),
    ('0022', 'politique', 'Users can update own outfit history', ''),
    ('0022', 'table', 'outfit_history', ''),
    ('0023', 'bucket', 'dressing-photos', ''),
    ('0024', 'contrainte', 'dressing_items_accessoire_type_check', ''),
    ('0024', 'contrainte', 'dressing_items_sac_type_check', ''),
    ('0025', 'politique', 'Users can delete own saved looks', ''),
    ('0025', 'politique', 'Users can insert own saved looks', ''),
    ('0025', 'politique', 'Users can read own saved looks', ''),
    ('0025', 'table', 'saved_looks', ''),
    ('0026', 'politique', 'Users can update own saved looks', ''),
    ('0027', 'politique_absente', 'Anyone can read image_generation_logs', ''),
    ('0028', 'politique_absente', 'Dressing photos are publicly readable', ''),
    ('0029', 'fonction', 'touch_outfit_feedback', ''),
    ('0029', 'index', 'outfit_feedback_user_jour_idx', ''),
    ('0029', 'table', 'outfit_feedback', ''),
    ('0030', 'index', 'planned_outfits_user_jour_idx', ''),
    ('0030', 'politique', 'Users can delete own planned outfits', ''),
    ('0030', 'politique', 'Users can insert own planned outfits', ''),
    ('0030', 'politique', 'Users can read own planned outfits', ''),
    ('0030', 'politique', 'Users can update own planned outfits', ''),
    ('0030', 'table', 'planned_outfits', ''),
    ('0031', 'politique', 'Users can read own premium access', ''),
    ('0031', 'table', 'premium_access', ''),
    ('0032', 'fonction', 'consommer_generation', ''),
    ('0032', 'table', 'generation_quota', ''),
    ('0033', 'colonne', 'bonus', 'generation_quota'),
    ('0033', 'fonction', 'accorder_bonus_generation', ''),
    ('0033', 'fonction', 'consommer_generation', ''),
    ('0034', 'colonne', 'colorimetrie', 'profiles'),
    ('0035', 'colonne', 'revente', 'dressing_items'),
    ('0036', 'bucket', 'avis-styliste-photos', ''),
    ('0036', 'table', 'avis_styliste', ''),
    ('0037', 'colonne', 'pieces_reconnues', 'avis_styliste'),
    ('0038', 'politique', 'Users can delete own valise', ''),
    ('0038', 'politique', 'Users can insert own valise', ''),
    ('0038', 'politique', 'Users can read own valise', ''),
    ('0038', 'politique', 'Users can update own valise', ''),
    ('0038', 'table', 'valises', ''),
    ('0039', 'contrainte_absente', 'valises_user_id_key', ''),
    ('0039', 'index', 'valises_user_depart_idx', ''),
    ('0040', 'colonne', 'saisons', 'dressing_items'),
    ('0040', 'contrainte', 'dressing_items_saisons_check', ''),
    ('0041', 'bucket_prive', 'dressing-photos', ''),
    ('0041', 'politique_absente', 'Dressing photos are publicly readable', ''),
    ('0042', 'colonne', 'manches', 'dressing_items'),
    ('0042', 'colonne', 'manches', 'vestiaire_universel'),
    ('0042', 'contrainte', 'dressing_items_manches_check', ''),
    ('0042', 'contrainte', 'vestiaire_universel_manches_check', ''),
    ('0043', 'table', 'edge_usage', ''),
    ('0043', 'fonction', 'consommer_edge_quota', ''),
    ('0043', 'index', 'edge_usage_jour_idx', ''),
    ('0046', 'table', 'edge_usage_mensuel', ''),
    ('0046', 'fonction', 'consommer_quota_mensuel', ''),
    ('0046', 'fonction', 'rendre_quota_mensuel', '')
),
resultat as (
  select
    migration, type, objet, parent,
    case type
      when 'table' then exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = objet)
      when 'colonne' then exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = parent and column_name = objet)
      when 'fonction' then exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = objet)
      when 'bucket' then exists (select 1 from storage.buckets where id = objet)
      when 'bucket_prive' then exists (select 1 from storage.buckets where id = objet and public = false)
      when 'politique' then exists (select 1 from pg_policies where policyname = objet)
      when 'politique_absente' then not exists (select 1 from pg_policies where policyname = objet)
      when 'contrainte' then exists (select 1 from pg_constraint where conname = objet)
      when 'contrainte_absente' then not exists (select 1 from pg_constraint where conname = objet)
      when 'index' then exists (select 1 from pg_indexes where schemaname = 'public' and indexname = objet)
    end as present
  from attendu
)
select section, element, detail
from (
  select
    '1 migration' as section,
    migration as element,
    case
      when count(*) filter (where not present) = 0 then 'complète (' || count(*) || '/' || count(*) || ')'
      else 'INCOMPLÈTE : ' || count(*) filter (where present) || '/' || count(*) || ' — manque : '
        || string_agg(type || ' ' || objet, ' · ' order by type, objet) filter (where not present)
    end as detail
  from resultat
  group by migration

  union all
  select '2 table sans RLS', tablename::text, 'RLS désactivée'
  from pg_tables
  where schemaname = 'public' and rowsecurity = false

  union all
  select '3 bucket', id::text, case when public then 'public' else 'privé' end
  from storage.buckets

  union all
  select '4 catalogue', 'pièces', count(*)::text from public.vestiaire_universel
  union all
  select '4 catalogue', 'pièces gelées (frozen)', count(*) filter (where frozen)::text from public.vestiaire_universel
  union all
  select '4 catalogue', 'avec lien d''affiliation', count(*) filter (where lien_affiliation is not null and lien_affiliation <> '')::text from public.vestiaire_universel
  union all
  -- to_jsonb : la colonne `manches` n'existe qu'après la migration 0042.
  select '4 catalogue', 'avec manches renseignées', count(*) filter (where to_jsonb(v)->>'manches' is not null)::text from public.vestiaire_universel v
) t
order by section, element;
