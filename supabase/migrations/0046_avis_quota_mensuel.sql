-- Plafond mensuel des avis de styliste (01/10/2026, demandé : « limiter les
-- demandes d'avis styliste à 5 dans le mois »).
--
-- CHAQUE AVIS EST UN APPEL PAYANT AU MODÈLE. `stylist-advice` n'avait aucun
-- plafond (phase de test, ACCES_LIBRE) : tout compte connecté pouvait enchaîner
-- les demandes. Le plafond se tient ici, en base, et non dans l'app : un client
-- modifié ne le contourne pas.
--
-- UNE LIGNE PAR COMPTE, FONCTION ET MOIS (UTC), dans une table À PART de
-- `edge_usage` (0043) : celle-ci est nettoyée au-delà de 30 jours par
-- `consommer_edge_quota`, ce qui aurait supprimé la ligne du mois en cours en
-- fin de mois. Le compteur monte d'un à chaque appel et s'arrête au plafond : le
-- `where` de la clause de conflit est le seul endroit où la limite s'applique,
-- atomiquement — deux demandes simultanées ne peuvent pas dépasser le plafond.
--
-- `rendre_quota_mensuel` rend l'unité quand l'échec est celui du service
-- (modèle indisponible, délai dépassé, réponse invalide) : un avis qui n'a pas
-- pu être donné ne compte pas.
--
-- AUCUNE POLITIQUE RLS, VOLONTAIREMENT : ni l'utilisatrice ni la clé `anon` ne
-- lisent ni n'écrivent cette table ; seule la clé privilégiée des fonctions
-- Edge le fait, par les fonctions ci-dessous.
--
-- ORDRE : exécuter cette migration AVANT de déployer la fonction `stylist-advice`
-- mise à jour. Sans elle, la fonction refuse (503) plutôt que de laisser le coût
-- ouvert.

create table if not exists public.edge_usage_mensuel (
  user_id uuid not null references auth.users (id) on delete cascade,
  fonction text not null,
  mois date not null default date_trunc('month', now())::date,
  n integer not null default 0,
  primary key (user_id, fonction, mois)
);

alter table public.edge_usage_mensuel enable row level security;

create or replace function public.consommer_quota_mensuel(p_user uuid, p_fonction text, p_limite integer)
returns table (consomme boolean, utilisees integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mois date := date_trunc('month', now())::date;
  v_n integer;
begin
  if p_user is null or p_fonction is null or p_limite is null or p_limite < 1 then
    raise exception 'paramètres invalides';
  end if;

  insert into public.edge_usage_mensuel as u (user_id, fonction, mois, n)
  values (p_user, p_fonction, v_mois, 1)
  on conflict (user_id, fonction, mois)
  do update set n = u.n + 1 where u.n < p_limite
  returning u.n into v_n;

  if v_n is not null then
    return query select true, v_n;
    return;
  end if;

  -- Le plafond était déjà atteint : la ligne existe, rien n'a été incrémenté.
  select n into v_n from public.edge_usage_mensuel
  where user_id = p_user and fonction = p_fonction and mois = v_mois;
  return query select false, coalesce(v_n, p_limite);
end;
$$;

create or replace function public.rendre_quota_mensuel(p_user uuid, p_fonction text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.edge_usage_mensuel
  set n = greatest(n - 1, 0)
  where user_id = p_user and fonction = p_fonction and mois = date_trunc('month', now())::date;
$$;

revoke all on function public.consommer_quota_mensuel(uuid, text, integer) from public;
revoke all on function public.consommer_quota_mensuel(uuid, text, integer) from anon;
revoke all on function public.consommer_quota_mensuel(uuid, text, integer) from authenticated;
grant execute on function public.consommer_quota_mensuel(uuid, text, integer) to service_role;

revoke all on function public.rendre_quota_mensuel(uuid, text) from public;
revoke all on function public.rendre_quota_mensuel(uuid, text) from anon;
revoke all on function public.rendre_quota_mensuel(uuid, text) from authenticated;
grant execute on function public.rendre_quota_mensuel(uuid, text) to service_role;
