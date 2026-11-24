-- EFFACER LES DATES DE NAISSANCE (24/11/2026, arbitré par la propriétaire ; suite de 0067).
--
-- DESTRUCTIVE ET IRRÉVERSIBLE : les dates effacées ne se retrouvent pas. À lancer SEULEMENT après 0067, et après avoir vérifié
-- que chaque compte qui avait une date a bien sa tranche (requête de contrôle ci-dessous : elle doit rendre 0).
--
--   select count(*) from public.profiles where birthdate is not null and tranche_age is null;
--
-- La colonne `birthdate` reste (vide) : l'app des versions déjà installées la lit encore ; elle pourra être supprimée plus tard.

update public.profiles set birthdate = null where birthdate is not null and tranche_age is not null;

update auth.users
set raw_user_meta_data = raw_user_meta_data - 'birthdate'
where raw_user_meta_data ? 'birthdate'
  and exists (select 1 from public.profiles p where p.id = auth.users.id and p.tranche_age is not null);
