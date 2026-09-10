-- Restreint la lecture du bucket dressing-photos à la propriétaire des
-- fichiers (audit avant lancement, 10/09/2026 — signalé par le tableau de
-- bord Supabase lui-même : « Clients can list all files in this bucket »).
--
-- La migration 0023 avait posé, pour SELECT :
--
--     using (bucket_id = 'dressing-photos')
--
-- sans aucune condition de propriétaire, là où les trois autres politiques du
-- même bucket vérifiaient toutes le préfixe {user_id}/ du chemin. Cette
-- asymétrie n'était pas voulue : le commentaire de 0023 annonçait « écriture
-- strictement réservée au propriétaire du chemin », et rien sur la lecture.
--
-- CE QU'ELLE EXPOSAIT. Une politique SELECT sur storage.objects n'autorise pas
-- seulement le téléchargement : elle autorise l'ÉNUMÉRATION. N'importe qui
-- disposant de la clé anonyme — elle est publique par construction, le
-- navigateur l'expose — pouvait donc lister tous les dossiers du bucket, donc
-- les chemins des photos de toutes les utilisatrices. Et le bucket étant
-- public, un chemin connu suffit à télécharger le fichier. Sans cette
-- politique, les UUID des chemins restent indevinables ; avec elle, ils
-- deviennent énumérables. Ce sont des photos personnelles.
--
-- CE QUI CONTINUE DE FONCTIONNER, et pourquoi la politique n'est pas
-- simplement supprimée :
--
--   · l'affichage des vignettes passe par l'URL publique
--     (/storage/v1/object/public/...), servie sans consulter RLS — c'est la
--     définition même d'un bucket public ;
--   · l'export RGPD (article 20, cf. src/lib/dataExport.ts) appelle
--     `.list(userId)` avec l'identifiant de la session en cours, vérifié
--     depuis ProfileScreen : il reste dans son propre dossier, donc couvert
--     par la nouvelle condition ;
--   · la suppression de compte (fonction Edge delete-account) et le nettoyage
--     des photos orphelines utilisent la clé service_role, qui contourne RLS.
--
-- Le bouton « Remove policy » proposé par le tableau de bord aurait retiré
-- SELECT en entier et cassé l'export RGPD. C'est la restriction qu'il fallait,
-- pas la suppression.

drop policy if exists "Dressing photos are publicly readable" on storage.objects;

drop policy if exists "Users can list their own dressing photos" on storage.objects;
create policy "Users can list their own dressing photos"
  on storage.objects for select
  using (
    bucket_id = 'dressing-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
