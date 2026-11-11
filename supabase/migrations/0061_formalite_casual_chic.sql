-- LE NIVEAU 2 DE FORMALITÉ : « casual_chic » (11/11/2026, décision D1 de l'audit « formalité, contexte et activités »,
-- docs/audit-moteur-stylistique/08-formalite-contexte-activites.md).
--
-- La contrainte de la migration 0003 n'admet que quatre valeurs (sport, decontracte, business_casual, habille). Elle est remplacée par
-- la même, avec « casual_chic » en plus — le casual chic / smart casual, entre le décontracté et le business casual. Les valeurs
-- existantes restent toutes valides : aucune ligne n'est modifiée par cette migration, aucune pièce ne change de niveau. Le reclassement
-- des pièces est un autre SQL, montré et validé à part.
--
-- Non destructive, relançable. À lancer à la main dans l'éditeur SQL de Supabase.

alter table public.vestiaire_universel
  drop constraint if exists vestiaire_universel_niveau_formalite_check;
alter table public.vestiaire_universel
  add constraint vestiaire_universel_niveau_formalite_check
  check (niveau_formalite is null or niveau_formalite in ('sport', 'decontracte', 'casual_chic', 'business_casual', 'habille'));

-- Contrôle : la contrainte et ses valeurs.
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conname = 'vestiaire_universel_niveau_formalite_check';
