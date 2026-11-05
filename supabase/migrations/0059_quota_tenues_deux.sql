-- LA LIMITE GRATUITE DE « AUTRE TENUE » : 2 PAR JOUR (05/11/2026, arbitré par la propriétaire : « fais 2 »). Fin de la phase de
-- test de 0055 (5 par jour) : retour à la valeur d'origine de 0033. Seule la constante `v_base` change : la fonction est celle de
-- 0055, à l'identique (bonus vidéo, Premium sans limite, droits). Aucune donnée n'est modifiée. Le chiffre affiché dans l'app est
-- GENERATIONS_GRATUITES_PAR_JOUR (src/lib/premium.ts), passé à 2 en même temps.
--
-- À lancer À LA MAIN dans l'éditeur SQL de Supabase.

create or replace function public.consommer_generation()
returns table (consomme boolean, utilisees integer, limite integer, premium boolean, bonus integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_jour date := current_date;
  v_base constant integer := 2;
  v_bonus integer := 0;
  v_limite integer;
  v_premium boolean;
  v_utilisees integer;
begin
  if v_uid is null then
    raise exception 'non authentifié';
  end if;

  select coalesce(bool_or(pa.actif and (pa.expire_le is null or pa.expire_le > now())), false)
    into v_premium
    from public.premium_access pa
   where pa.user_id = v_uid;

  if v_premium then
    return query select true, 0, v_base, true, 0;
    return;
  end if;

  select coalesce(gq.bonus, 0) into v_bonus
    from public.generation_quota gq
   where gq.user_id = v_uid and gq.jour = v_jour;
  v_bonus := coalesce(v_bonus, 0);
  v_limite := v_base + v_bonus;

  insert into public.generation_quota as gq (user_id, jour, utilisees)
  values (v_uid, v_jour, 1)
  on conflict (user_id, jour) do update
     set utilisees = gq.utilisees + 1
   where gq.utilisees < v_base + gq.bonus
  returning gq.utilisees into v_utilisees;

  if v_utilisees is not null then
    return query select true, v_utilisees, v_limite, false, v_bonus;
  else
    select gq.utilisees into v_utilisees
      from public.generation_quota gq
     where gq.user_id = v_uid and gq.jour = v_jour;
    return query select false, coalesce(v_utilisees, v_limite), v_limite, false, v_bonus;
  end if;
end;
$$;

revoke all on function public.consommer_generation() from public;
revoke all on function public.consommer_generation() from anon;
grant execute on function public.consommer_generation() to authenticated;
