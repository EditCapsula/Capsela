-- Retours sur les accords de saison (02/10/2026) : « J'aime cette association » / « Pas pour moi ».
-- Jusqu'ici gardés sur l'appareil (localStorage) ; cette table les rattache au compte, pour qu'ils
-- suivent la personne d'un appareil à l'autre et puissent nourrir une personnalisation plus tard.
--
-- Une ligne par accord et par personne, révisable : la clé primaire (user_id, accord_cle) fait qu'un
-- second geste corrige la ligne au lieu d'en empiler une ; retirer un retour supprime la ligne.
-- accord_cle est la clé de l'application (« Automne|Vieux rose+Marron », src/lib/conseilsCouleurs.ts) ;
-- `saison` et `couleurs` en sont la décomposition, pour pouvoir compter sans parser la clé.
--
-- L'application fonctionne AVANT cette migration : les retours restent alors sur l'appareil, et l'envoi
-- vers cette table échoue sans bruit. Modèle RLS aligné sur public.outfit_feedback (0029).

create table if not exists public.accord_retours (
  user_id uuid not null references auth.users (id) on delete cascade,
  accord_cle text not null,
  saison text not null,
  couleurs text[] not null,
  retour text not null check (retour in ('aime', 'pas_pour_moi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, accord_cle)
);

create index if not exists accord_retours_user_idx
  on public.accord_retours (user_id);

-- Sans ce déclencheur, updated_at resterait à l'heure de l'insertion.
create or replace function public.touch_accord_retours()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists accord_retours_touch on public.accord_retours;
create trigger accord_retours_touch
  before update on public.accord_retours
  for each row execute function public.touch_accord_retours();

alter table public.accord_retours enable row level security;

drop policy if exists "Users can read own accord retours" on public.accord_retours;
create policy "Users can read own accord retours"
  on public.accord_retours for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own accord retours" on public.accord_retours;
create policy "Users can insert own accord retours"
  on public.accord_retours for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own accord retours" on public.accord_retours;
create policy "Users can update own accord retours"
  on public.accord_retours for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own accord retours" on public.accord_retours;
create policy "Users can delete own accord retours"
  on public.accord_retours for delete
  using (auth.uid() = user_id);
