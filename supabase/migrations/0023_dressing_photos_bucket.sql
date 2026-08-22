-- Bucket de stockage des photos réelles du dressing (prises/importées à
-- l'ajout d'une pièce) — jusqu'ici jamais branché : seule une URL locale
-- (blob:) était générée pour l'aperçu, perdue au rechargement (cf.
-- correctif 22/08/2026 sur dressing_items qui a rendu ce manque visible).
--
-- Contrairement à catalog-images (public, écriture réservée au
-- service_role — visuels produit génériques, cf. migration 0010), ce
-- bucket contient des photos personnelles : lecture publique conservée
-- pour la simplicité (comme catalog-images, pas d'URL signée à gérer côté
-- client), mais écriture strictement réservée au propriétaire du chemin
-- via le préfixe {user_id}/... de chaque objet, jamais au rôle anonyme ou
-- à un autre utilisateur connecté.
--
-- Convention de chemin : dressing-photos/{user_id}/{uuid}.{ext}

insert into storage.buckets (id, name, public)
values ('dressing-photos', 'dressing-photos', true)
on conflict (id) do nothing;

drop policy if exists "Dressing photos are publicly readable" on storage.objects;
create policy "Dressing photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'dressing-photos');

drop policy if exists "Users can upload their own dressing photos" on storage.objects;
create policy "Users can upload their own dressing photos"
  on storage.objects for insert
  with check (bucket_id = 'dressing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own dressing photos" on storage.objects;
create policy "Users can update their own dressing photos"
  on storage.objects for update
  using (bucket_id = 'dressing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own dressing photos" on storage.objects;
create policy "Users can delete their own dressing photos"
  on storage.objects for delete
  using (bucket_id = 'dressing-photos' and auth.uid()::text = (storage.foldername(name))[1]);
