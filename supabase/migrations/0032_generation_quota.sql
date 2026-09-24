-- Quota de générations de tenues (arbitré le 24/09/2026) : 2 « autre tenue »
-- par jour sans abonnement, illimité avec.
--
-- CE QUI EST DÉCOMPTÉ, ET CE QUI NE L'EST PAS. La tenue du jour, générée
-- automatiquement à l'ouverture, n'est JAMAIS décomptée. Seul le geste
-- volontaire « Autre tenue » consomme une unité. Quelqu'un qui ouvre l'app et
-- porte ce qu'on lui propose ne rencontre donc jamais cette limite, et c'est
-- voulu : elle borne l'exploration, pas l'usage.
--
-- POURQUOI UNE FONCTION ET PAS UNE SIMPLE POLICY D'UPDATE. Une policy
-- `for update using (auth.uid() = user_id)` laisserait chaque utilisatrice
-- réécrire son propre compteur depuis le navigateur — remettre `utilisees` à
-- zéro serait une requête. C'est exactement la raison pour laquelle le
-- drapeau Premium a été sorti de `profiles` (cf. 0031). La table n'a donc
-- AUCUNE policy d'écriture : le seul chemin est `consommer_generation()`, en
-- `security definer`, qui s'exécute avec les droits du propriétaire et
-- applique elle-même la limite.
--
-- LA LIMITE EST DANS LA FONCTION, PAS DANS UN PARAMÈTRE. Si le client
-- passait la limite en argument, il passerait 9999. Elle est écrite ici, en
-- dur, et renvoyée à l'appelant pour l'affichage — jamais reçue de lui.
--
-- LE JOUR EST `current_date`, DONC UTC. C'est un choix, et il a un coût connu :
-- le compteur se remet à zéro à minuit UTC, soit 1 h ou 2 h du matin en
-- France — avant le matin, ce que l'écran annonce. Pour quelqu'un en
-- Californie, la remise à zéro tomberait en milieu d'après-midi. L'alternative
-- — laisser le client annoncer son fuseau — rendrait la borne falsifiable :
-- il suffirait de faire varier le décalage pour s'offrir des journées
-- supplémentaires. Une limite exacte et contournable vaut moins qu'une limite
-- approximative et sûre. À revoir si l'app sort de l'Europe.

create table if not exists public.generation_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  jour date not null,
  utilisees integer not null default 0,
  -- Une ligne par jour et par personne : la clé primaire porte la règle,
  -- aucun dédoublonnage côté application n'est nécessaire.
  primary key (user_id, jour)
);

alter table public.generation_quota enable row level security;

-- Lecture seule, et seulement ses propres lignes. Aucune policy d'insert,
-- d'update ni de delete : voir l'en-tête.
drop policy if exists "Users can read own generation quota" on public.generation_quota;
create policy "Users can read own generation quota"
  on public.generation_quota for select
  using (auth.uid() = user_id);

create or replace function public.consommer_generation()
returns table (consomme boolean, utilisees integer, limite integer, premium boolean)
language plpgsql
security definer
-- `search_path` figé : sans lui, une fonction `security definer` peut être
-- détournée en plaçant un objet homonyme dans un schéma consulté avant public.
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_jour date := current_date;
  v_limite constant integer := 2;
  v_premium boolean;
  v_utilisees integer;
begin
  if v_uid is null then
    raise exception 'non authentifié';
  end if;

  -- Le droit Premium est relu ICI, côté serveur, jamais reçu du client.
  select coalesce(bool_or(pa.actif and (pa.expire_le is null or pa.expire_le > now())), false)
    into v_premium
    from public.premium_access pa
   where pa.user_id = v_uid;

  -- Premium : rien n'est compté, donc rien n'est écrit. Inutile de faire
  -- grossir la table pour des gens qui n'ont pas de plafond.
  if v_premium then
    return query select true, 0, v_limite, true;
    return;
  end if;

  -- Incrément atomique. Le `where` de la clause de conflit est ce qui applique
  -- réellement la limite : au-delà, aucune ligne n'est mise à jour, donc
  -- `returning` ne rend rien et `v_utilisees` reste NULL. C'est ce NULL qui
  -- distingue « je viens de consommer la deuxième » de « j'étais déjà à deux »,
  -- deux situations qui rendraient sinon le même compteur.
  insert into public.generation_quota as gq (user_id, jour, utilisees)
  values (v_uid, v_jour, 1)
  on conflict (user_id, jour) do update
     set utilisees = gq.utilisees + 1
   where gq.utilisees < v_limite
  returning gq.utilisees into v_utilisees;

  if v_utilisees is not null then
    return query select true, v_utilisees, v_limite, false;
  else
    select gq.utilisees into v_utilisees
      from public.generation_quota gq
     where gq.user_id = v_uid and gq.jour = v_jour;
    return query select false, coalesce(v_utilisees, v_limite), v_limite, false;
  end if;
end;
$$;

-- Personne d'autre que les comptes connectés : ni `anon`, ni `public`.
revoke all on function public.consommer_generation() from public;
revoke all on function public.consommer_generation() from anon;
grant execute on function public.consommer_generation() to authenticated;
