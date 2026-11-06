-- Le nom anglais des pièces du catalogue (06/11/2026, docs/traduction.md, lot « Catalogue »).
--
-- Une colonne facultative : vide, l'app affiche le nom français, comme aujourd'hui. Elle n'est lue que lorsque l'app est en anglais
-- (nomAffiche, src/lib/langue.ts) ; le moteur, lui, lit toujours le nom français (ses règles reconnaissent des mots français).
-- Les noms anglais sont écrits ensuite par un fichier de mise à jour à part, relu avant d'être lancé.
-- À lancer à la main dans l'éditeur SQL de Supabase. Sans risque : aucune ligne n'est modifiée.

alter table vestiaire_universel add column if not exists name_en text;

-- Annulation (retour arrière seulement) :
-- alter table vestiaire_universel drop column if exists name_en;
