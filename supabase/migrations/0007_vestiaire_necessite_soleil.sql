-- Pièces qui ne se justifient que par temps ensoleillé (ex. lunettes de
-- soleil) — R-B16, jamais suggérées par l'app tant que la météo du jour
-- n'indique pas de soleil. Additif/idempotent.

alter table public.vestiaire_universel add column if not exists necessite_soleil boolean null default false;
