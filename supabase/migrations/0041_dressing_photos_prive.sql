-- Photos du dressing : bucket PRIVÉ, lecture par URL signée (30/09/2026 —
-- correction jugée la plus urgente de la liste avant lancement).
--
-- CE QUI RESTAIT EXPOSÉ. Le bucket `dressing-photos` a été créé public
-- (0023) : une URL suffisait pour voir une photo, sans session. Ce sont des
-- photos personnelles, dont des hauts photographiés portés — donc des photos
-- de personnes. 0028 avait déjà retiré l'énumération (lecture limitée au
-- dossier {user_id}/ de la propriétaire), mais pas l'accès par URL, qui ne
-- consulte aucune politique sur un bucket public.
--
-- CE QUE FAIT CETTE MIGRATION :
--   1. le bucket devient privé : /storage/v1/object/public/dressing-photos/…
--      ne sert plus rien ;
--   2. la politique de lecture de 0028 est reposée à l'identique — on ne peut
--      pas supposer que 0028 a été exécutée, et c'est elle qui autorise la
--      propriétaire (et elle seule) à créer ses URL signées.
--
-- PRÉREQUIS : le code qui signe les URL (src/lib/dressing.ts,
-- signerPhotosDressing) doit être EN PRODUCTION AVANT. Une URL signée se lit
-- aussi sur un bucket public, l'inverse est faux : dans cet ordre, rien ne
-- casse.
--
-- INCHANGÉ : la colonne dressing_items.photo_url garde l'URL publique de
-- l'objet, qui n'est plus qu'un repère ; aucune ligne n'est réécrite. Les
-- politiques d'écriture, de mise à jour et de suppression (0023) vérifient
-- déjà le préfixe {user_id}/. La suppression de compte (delete-account)
-- passe par la clé service_role.

update storage.buckets set public = false where id = 'dressing-photos';

drop policy if exists "Dressing photos are publicly readable" on storage.objects;

drop policy if exists "Users can list their own dressing photos" on storage.objects;
create policy "Users can list their own dressing photos"
  on storage.objects for select
  using (
    bucket_id = 'dressing-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Vérification, à lancer après : doit rendre `false`.
-- select public from storage.buckets where id = 'dressing-photos';
