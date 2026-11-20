-- La provenance d'un look (20/11/2026, demandé sur Mes looks : « je veux surtout indiquer la provenance des looks »).
--
-- `origine` dit d'où une tenue a été enregistrée : Ma tenue du jour, l'Accueil, Planifier, la Capsule (Composer), une idée de look, la
-- valise. Facultative : les looks d'avant cette migration n'en ont pas, et leur carte ne dit rien (aucune donnée inventée). Un look créé
-- (source « created ») n'en a pas besoin : sa source le dit.
--
-- L'application fonctionne AVANT cette migration : l'origine est écrite à part de l'insertion (son échec ne touche jamais la sauvegarde
-- du look) et gardée aussi sur l'appareil. La politique de mise à jour existe déjà (0026).
-- Réversible : `alter table public.saved_looks drop column origine;`.

alter table public.saved_looks
  add column if not exists origine text
  check (origine is null or origine in ('tenue_du_jour', 'accueil', 'planifier', 'composer', 'idee_look', 'valise'));
