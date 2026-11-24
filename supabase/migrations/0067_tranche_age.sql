-- LA TRANCHE D'ÂGE À LA PLACE DE LA DATE DE NAISSANCE (24/11/2026, arbitré par la propriétaire ; src/lib/ageMinimum.ts).
--
-- La date de naissance ne servait qu'au seuil de 15 ans. Une tranche suffit (minimisation, RGPD), et des tranches de dix ans
-- permettent d'analyser l'âge des utilisateurs, de façon agrégée seulement. Les 15-17 ans ne reçoivent que des publicités non
-- personnalisées (publicite.ts).
--
-- NON DESTRUCTIVE : ajoute la colonne, la remplit pour les comptes existants (depuis leur date de naissance, sinon depuis la tranche
-- des métadonnées du compte) et met le déclencheur d'inscription à jour. Les dates de naissance ne sont PAS effacées ici : c'est
-- 0068, à lancer une fois les tranches vérifiées.
-- L'application fonctionne AVANT cette migration : la tranche est gardée dans les métadonnées du compte, et déduite de la date.
-- Réversible : `alter table public.profiles drop column tranche_age;` (et le déclencheur de 0001).

alter table public.profiles
  add column if not exists tranche_age text
  check (tranche_age in ('moins_15', '15_17', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'));

-- La tranche d'un âge en années pleines.
create or replace function public.tranche_depuis_age(a integer)
returns text
language sql
immutable
as $$
  select case
    when a is null then null
    when a < 15 then 'moins_15'
    when a < 18 then '15_17'
    when a < 25 then '18_24'
    when a < 35 then '25_34'
    when a < 45 then '35_44'
    when a < 55 then '45_54'
    when a < 65 then '55_64'
    else '65_plus'
  end;
$$;

-- 1. Les comptes qui ont une date de naissance (dans le profil, sinon dans les métadonnées de l'inscription).
update public.profiles p
set tranche_age = public.tranche_depuis_age(extract(year from age(current_date, d.naissance))::integer)
from (
  select p2.id,
    coalesce(
      p2.birthdate,
      case when (u.raw_user_meta_data ->> 'birthdate') ~ '^\d{4}-\d{2}-\d{2}$' then (u.raw_user_meta_data ->> 'birthdate')::date end
    ) as naissance
  from public.profiles p2
  join auth.users u on u.id = p2.id
) d
where d.id = p.id and p.tranche_age is null and d.naissance is not null and d.naissance <= current_date;

-- 2. Les comptes qui ont déjà choisi une tranche dans l'app avant cette migration (métadonnées du compte).
update public.profiles p
set tranche_age = u.raw_user_meta_data ->> 'tranche_age'
from auth.users u
where u.id = p.id
  and p.tranche_age is null
  and (u.raw_user_meta_data ->> 'tranche_age') in ('moins_15', '15_17', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus');

-- 3. L'inscription : la tranche des métadonnées (inscription par e-mail) est recopiée dans la colonne ; plus aucune date.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, tranche_age)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case
      when (new.raw_user_meta_data ->> 'tranche_age') in ('moins_15', '15_17', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus')
        then new.raw_user_meta_data ->> 'tranche_age'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
