-- Droits Premium.
--
-- TABLE SÉPARÉE DE profiles, ET C'EST TOUT L'INTÉRÊT. La policy « Users can
-- update own profile » (0001) laisse chaque utilisatrice écrire n'importe
-- quelle colonne de sa propre ligne : un drapeau premium posé là-bas serait
-- falsifiable depuis le navigateur en une seule requête, avec son propre
-- jeton. Vérifié dans 0001 avant d'écrire cette table.
--
-- Ici : lecture par la propriétaire, AUCUNE policy d'insert ni d'update.
-- Une table dont les seules écritures passent par la clé de service — la
-- main aujourd'hui, la vérification de reçu d'achat le jour venu. RLS reste
-- activée : sans policy d'écriture, le client se voit refuser l'insert comme
-- l'update, ce qui est exactement le but.
--
-- expire_le nullable : un accès accordé à la main n'expire pas forcément,
-- un abonnement oui. L'application traite null comme « pas d'échéance ».

create table if not exists public.premium_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  actif boolean not null default true,
  source text not null check (source in ('manuel', 'app_store', 'play_store')),
  expire_le timestamptz,
  created_at timestamptz not null default now()
);

alter table public.premium_access enable row level security;

create policy "Users can read own premium access"
  on public.premium_access for select
  using (auth.uid() = user_id);
