-- Quota par compte et par jour pour les fonctions Edge qui coûtent (01/10/2026).
--
-- `analyze-dressing-photo` (un appel OpenAI vision par photo) et
-- `generate-catalog-image` ne vérifiaient aucune identité : la clé `anon`,
-- publique, suffisait à les appeler en boucle. Elles exigent désormais un JWT
-- d'utilisatrice connectée (supabase/functions/_shared/protection.ts) et
-- plafonnent chaque compte par jour. Cette migration tient le compteur.
--
-- UNE LIGNE PAR COMPTE, FONCTION ET JOUR (UTC). Le compteur monte d'un à chaque
-- appel et s'arrête au plafond : le `where` de la clause de conflit est le seul
-- endroit où la limite s'applique, atomiquement — deux appels simultanés ne
-- peuvent pas dépasser le plafond (même principe que consommer_generation, 0032).
--
-- AUCUNE POLITIQUE RLS, VOLONTAIREMENT : ni l'utilisatrice ni la clé `anon` ne
-- lisent ni n'écrivent cette table ; seule la clé privilégiée des fonctions
-- Edge le fait, par la fonction ci-dessous, dont l'exécution est retirée à
-- tous les autres rôles.
--
-- ORDRE : exécuter cette migration AVANT de déployer les fonctions protégées.
-- Sans elle, ces fonctions refusent (503) plutôt que de laisser le coût ouvert :
-- le préremplissage par photo et la génération de visuels s'arrêtent.

create table if not exists public.edge_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  fonction text not null,
  jour date not null default current_date,
  n integer not null default 0,
  primary key (user_id, fonction, jour)
);

create index if not exists edge_usage_jour_idx on public.edge_usage (jour);

alter table public.edge_usage enable row level security;

create or replace function public.consommer_edge_quota(p_user uuid, p_fonction text, p_limite integer)
returns table (consomme boolean, utilisees integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if p_user is null or p_fonction is null or p_limite is null or p_limite < 1 then
    raise exception 'paramètres invalides';
  end if;

  insert into public.edge_usage as u (user_id, fonction, jour, n)
  values (p_user, p_fonction, current_date, 1)
  on conflict (user_id, fonction, jour)
  do update set n = u.n + 1 where u.n < p_limite
  returning u.n into v_n;

  if v_n is not null then
    -- Entretien : les jours passés ne servent plus. Une fois sur cent appels,
    -- pour ne pas payer ce nettoyage à chaque fois.
    if random() < 0.01 then
      delete from public.edge_usage where jour < current_date - 30;
    end if;
    return query select true, v_n;
    return;
  end if;

  -- Le plafond était déjà atteint : la ligne existe, rien n'a été incrémenté.
  select n into v_n from public.edge_usage
  where user_id = p_user and fonction = p_fonction and jour = current_date;
  return query select false, coalesce(v_n, p_limite);
end;
$$;

revoke all on function public.consommer_edge_quota(uuid, text, integer) from public;
revoke all on function public.consommer_edge_quota(uuid, text, integer) from anon;
revoke all on function public.consommer_edge_quota(uuid, text, integer) from authenticated;
grant execute on function public.consommer_edge_quota(uuid, text, integer) to service_role;
