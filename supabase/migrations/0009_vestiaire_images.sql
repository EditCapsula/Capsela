-- Gestion automatique des images produit du catalogue (vestiaire_universel) —
-- affichées dans les cards "La combinaison" de la Tenue du jour. Additif/
-- idempotent. Ne concerne que le catalogue Capsela (suggestions) : jamais
-- les pièces réelles du dressing utilisateur (Item.photoUrl côté app), qui
-- gardent toujours leur propre photo.
--
-- Réutilise la colonne `url_image` déjà présente (migration 0003, jamais
-- exploitée côté app jusqu'ici) comme URL d'image plutôt que d'en créer une
-- nouvelle en doublon — elle sert indifféremment pour une image posée
-- manuellement ou générée automatiquement, distinguée par image_source.
alter table public.vestiaire_universel add column if not exists image_source text;
alter table public.vestiaire_universel add column if not exists image_prompt text;
alter table public.vestiaire_universel add column if not exists image_status text default 'missing';
alter table public.vestiaire_universel add column if not exists image_generated_at timestamptz;
alter table public.vestiaire_universel add column if not exists image_version integer default 1;

-- Image produit affiliée réelle (distincte de lien_affiliation, qui n'est
-- que le lien de clic sortant) — priorité sur url_image quand présente : on
-- ne génère jamais un visuel artificiel pour représenter un produit
-- commercial précis déjà pourvu d'une vraie photo.
alter table public.vestiaire_universel add column if not exists affiliate_image_url text;

alter table public.vestiaire_universel drop constraint if exists vestiaire_universel_image_status_check;
alter table public.vestiaire_universel add constraint vestiaire_universel_image_status_check
  check (image_status in ('missing', 'generating', 'ready', 'error'));

alter table public.vestiaire_universel drop constraint if exists vestiaire_universel_image_source_check;
alter table public.vestiaire_universel add constraint vestiaire_universel_image_source_check
  check (image_source is null or image_source in ('generated', 'manual', 'affiliate', 'user'));

update public.vestiaire_universel set image_status = 'missing' where image_status is null;

-- Rétro-cohérence : une ligne qui avait déjà url_image renseignée (posée à
-- la main avant ce système) ne doit jamais déclencher une génération.
update public.vestiaire_universel
  set image_status = 'ready', image_source = coalesce(image_source, 'manual')
  where url_image is not null and image_status = 'missing';
