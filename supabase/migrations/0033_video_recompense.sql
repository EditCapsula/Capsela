-- Vidéo récompensée : le mécanisme, sans le fournisseur (24/09/2026).
--
-- Une vidéo regardée jusqu'au bout donne UNE génération supplémentaire, une
-- seule fois par jour. Le fournisseur de publicité n'est pas arbitré ; cette
-- migration pose donc tout ce qui n'en dépend pas, et RIEN de ce qui en dépend.
--
-- LA QUESTION QUI DÉCIDE DE TOUTE L'ARCHITECTURE : qui a le droit d'accorder
-- le bonus ?
--
-- Si c'est le navigateur, la réponse est « tout le monde ». Un RPC appelable
-- par `authenticated` s'appelle depuis la console du téléphone sans regarder
-- la moindre vidéo — et une limite qu'on lève en une requête n'est pas une
-- limite. Ce n'est pas une hypothèse d'école : l'onglet réseau montre le nom
-- de la fonction dès le premier usage légitime.
--
-- Donc `accorder_bonus_generation` est RÉVOQUÉE À `anon` ET À `authenticated`.
-- Seule la clé de service peut l'appeler, c'est-à-dire seule une fonction Edge.
-- Le chemin réel sera : le réseau publicitaire constate que la vidéo a été vue
-- jusqu'au bout et appelle NOTRE serveur (server-side verification), qui
-- vérifie sa signature puis accorde. Le téléphone ne fait que déclencher et
-- attendre ; il n'accorde rien.
--
-- Tant qu'aucun fournisseur n'est choisi, la fonction Edge `video-recompense`
-- refuse toute demande faute de secret de vérification, et l'app n'affiche
-- jamais la carte vidéo. Le bonus existe donc en base et vaut zéro partout —
-- ce qui est exactement l'état d'avant, sans dette cachée.

-- `if not exists` : cette migration doit passer que 0032 ait déjà été exécutée
-- ou non, et deux fois de suite sans effet de bord.
alter table public.generation_quota
  add column if not exists bonus integer not null default 0;

-- La limite effective du jour devient `2 + bonus`. Le reste de la fonction est
-- inchangé — y compris le `where` de la clause de conflit, qui reste le seul
-- endroit où la limite s'applique réellement.
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

-- UN SEUL BONUS PAR JOUR, et la fonction le fait respecter elle-même plutôt
-- que de faire confiance à son appelant : `where gq.bonus = 0` ne met à jour
-- que la ligne qui n'en a pas encore. Un deuxième appel le même jour ne rend
-- aucune ligne, donc `accorde` vaut false — sans erreur, parce que ce n'est
-- pas une anomalie : c'est la règle qui s'applique.
create or replace function public.accorder_bonus_generation(p_user_id uuid)
returns table (accorde boolean, bonus integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jour date := current_date;
  v_bonus integer;
begin
  if p_user_id is null then
    raise exception 'user_id requis';
  end if;

  insert into public.generation_quota as gq (user_id, jour, utilisees, bonus)
  values (p_user_id, v_jour, 0, 1)
  on conflict (user_id, jour) do update
     set bonus = 1
   where gq.bonus = 0
  returning gq.bonus into v_bonus;

  if v_bonus is not null then
    return query select true, v_bonus;
  else
    select gq.bonus into v_bonus
      from public.generation_quota gq
     where gq.user_id = p_user_id and gq.jour = v_jour;
    return query select false, coalesce(v_bonus, 0);
  end if;
end;
$$;

-- LE POINT CENTRAL DE CETTE MIGRATION. Personne d'autre que la clé de service.
-- Ni `public`, ni `anon`, ni `authenticated` : un téléphone ne peut pas
-- s'accorder un bonus, même en appelant le RPC à la main.
revoke all on function public.accorder_bonus_generation(uuid) from public;
revoke all on function public.accorder_bonus_generation(uuid) from anon;
revoke all on function public.accorder_bonus_generation(uuid) from authenticated;
