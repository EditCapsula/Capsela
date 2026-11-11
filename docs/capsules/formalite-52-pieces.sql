-- CLASSEMENT DES 52 PIÈCES SANS NIVEAU DE FORMALITÉ (11/11/2026, suite de la décision D1).
-- Classement validé par la propriétaire (prompt docs/capsules/prompt-formalite-52-pieces.md, correction du 504 en casual_chic).
-- Répartition : decontracte 13, casual_chic 38, business_casual 1. 486, 490 et 684 : classement PROVISOIRE, à relire.
--
-- Ne touche que la colonne niveau_formalite des 52 id, et seulement si elle est encore vide : relançable sans effet.
-- À lancer à la main dans l'éditeur SQL de Supabase, bloc par bloc.

-- 1. SAUVEGARDE (déjà faite si tu as lancé le bloc précédent : « if not exists » ne la refait pas).
create table if not exists public.sauvegarde_formalite_52 as
select id, name, genre, niveau_formalite, now() as sauvegarde_le
  from public.vestiaire_universel
 where id in (451,454,455,474,476,479,480,482,483,485,486,487,488,489,490,496,497,498,503,504,526,528,684,704,813,820,823,833,844,851,852,853,858,862,863,872,882,896,913,925,926,943,955,969,987,1019,1033,1036,1043,1044,1054,1057);
alter table public.sauvegarde_formalite_52 enable row level security;

-- Contrôle : lignes = 52, sans_niveau = 52.
select count(*) as lignes,
       count(*) filter (where niveau_formalite is null or trim(niveau_formalite) = '') as sans_niveau
  from public.sauvegarde_formalite_52;

-- 2. MISE À JOUR.
with classement(id, niveau) as (values
  (451, 'decontracte'),
  (454, 'casual_chic'),
  (455, 'casual_chic'),
  (474, 'casual_chic'),
  (476, 'decontracte'),
  (479, 'casual_chic'),
  (480, 'casual_chic'),
  (482, 'decontracte'),
  (483, 'casual_chic'),
  (485, 'casual_chic'),
  (486, 'casual_chic'),
  (487, 'casual_chic'),
  (488, 'casual_chic'),
  (489, 'casual_chic'),
  (490, 'casual_chic'),
  (496, 'business_casual'),
  (497, 'casual_chic'),
  (498, 'decontracte'),
  (503, 'casual_chic'),
  (504, 'casual_chic'),
  (526, 'casual_chic'),
  (528, 'casual_chic'),
  (684, 'casual_chic'),
  (704, 'casual_chic'),
  (813, 'casual_chic'),
  (820, 'casual_chic'),
  (823, 'casual_chic'),
  (833, 'casual_chic'),
  (844, 'decontracte'),
  (851, 'decontracte'),
  (852, 'casual_chic'),
  (853, 'decontracte'),
  (858, 'casual_chic'),
  (862, 'casual_chic'),
  (863, 'casual_chic'),
  (872, 'casual_chic'),
  (882, 'casual_chic'),
  (896, 'casual_chic'),
  (913, 'casual_chic'),
  (925, 'decontracte'),
  (926, 'decontracte'),
  (943, 'casual_chic'),
  (955, 'decontracte'),
  (969, 'decontracte'),
  (987, 'decontracte'),
  (1019, 'casual_chic'),
  (1033, 'casual_chic'),
  (1036, 'casual_chic'),
  (1043, 'casual_chic'),
  (1044, 'casual_chic'),
  (1054, 'casual_chic'),
  (1057, 'decontracte')
)
update public.vestiaire_universel v
   set niveau_formalite = c.niveau
  from classement c
 where v.id = c.id
   and (v.niveau_formalite is null or trim(v.niveau_formalite) = '');

-- 3. CONTRÔLES.
-- 3a. Décompte des 52 : decontracte 13, casual_chic 38, business_casual 1.
select niveau_formalite, count(*)
  from public.vestiaire_universel
 where id in (select id from public.sauvegarde_formalite_52)
 group by niveau_formalite order by niveau_formalite;

-- 3b. Avant / après, pièce par pièce (52 lignes, avant vide).
select s.id, s.name, s.genre, s.niveau_formalite as avant, v.niveau_formalite as apres
  from public.sauvegarde_formalite_52 s
  join public.vestiaire_universel v on v.id = s.id
 order by s.id;

-- 3c. Plus aucune pièce active sans niveau (attendu : 0).
select count(*) as sans_niveau
  from public.vestiaire_universel
 where (frozen is distinct from true)
   and (niveau_formalite is null or trim(niveau_formalite) = '');

-- 3d. Répartition de tout le catalogue (à comparer : seules les 52 ont bougé, aucune autre valeur n'est apparue).
select coalesce(niveau_formalite, '(vide)') as niveau, count(*)
  from public.vestiaire_universel
 group by 1 order by 1;

-- ANNULATION (ne pas lancer sauf retour arrière) : remet les 52 valeurs sauvegardées.
-- update public.vestiaire_universel v
--    set niveau_formalite = s.niveau_formalite
--   from public.sauvegarde_formalite_52 s
--  where v.id = s.id;
