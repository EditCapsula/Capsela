-- Genre : 4 valeurs déclarées en base (Tâche 3, arbitrages du 20/08/2026),
-- 3 réellement exposées côté UI ('femme', 'homme', 'neutre' — 'non_precise'
-- n'a jamais été rendu). Réduit à 2 : 'femme', 'homme'.
--
-- Application non lancée, aucune donnée réelle : pas de logique de reprise.
-- Si un compte de test porte encore 'neutre'/'non_precise', l'ALTER TABLE
-- ci-dessous échoue (Postgres valide les lignes existantes contre une
-- nouvelle contrainte CHECK) — signal volontaire plutôt qu'une conversion
-- silencieuse ; dans ce cas, identifier puis supprimer le compte de test
-- concerné avant de rejouer cette migration.
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check
  check (gender is null or gender in ('femme', 'homme'));
