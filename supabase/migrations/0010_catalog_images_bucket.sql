-- Bucket de stockage des visuels produit générés/posés pour le catalogue
-- Capsela (vestiaire_universel). Lecture publique (photos produit
-- génériques, pas de donnée personnelle) ; écriture réservée au rôle
-- service_role, utilisé exclusivement par l'Edge Function
-- generate-catalog-image (jamais exposé au frontend). Additif/idempotent.
--
-- Organisation des chemins (pas de dossiers réels en object storage, juste
-- une convention de préfixe) : catalog-images/{genre}/{category}/{id}-v{version}.webp
-- genre ∈ (femme, unisexe) — le modèle de genre déjà en place côté app
-- (CatalogItem.genre) n'a que ces deux valeurs, jamais "homme".

insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;

drop policy if exists "Catalog images are publicly readable" on storage.objects;
create policy "Catalog images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'catalog-images');

drop policy if exists "Only service_role can write catalog images" on storage.objects;
create policy "Only service_role can write catalog images"
  on storage.objects for insert
  with check (bucket_id = 'catalog-images' and auth.role() = 'service_role');

drop policy if exists "Only service_role can update catalog images" on storage.objects;
create policy "Only service_role can update catalog images"
  on storage.objects for update
  using (bucket_id = 'catalog-images' and auth.role() = 'service_role');

drop policy if exists "Only service_role can delete catalog images" on storage.objects;
create policy "Only service_role can delete catalog images"
  on storage.objects for delete
  using (bucket_id = 'catalog-images' and auth.role() = 'service_role');
