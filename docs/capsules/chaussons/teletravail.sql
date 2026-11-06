-- Chaussures d'intérieur : aussi pour le Télétravail (06/11/2026). Le moteur n'admet en Télétravail (occasion travail_formel, mode
-- Télétravail) que les chaussures d'intérieur (R-B17) dont les occasions déclarées comprennent travail_formel (declaredOccasionOk,
-- logic.ts). Les 12 modèles par style (ajout-chaussons-par-style.sql, ids 1309 à 1320) ne déclaraient que cocooning. En Présentiel,
-- une chaussure d'intérieur reste toujours écartée (R-B13) : ajouter travail_formel ne la fait pas sortir au bureau.
-- À lancer à la main dans l'éditeur SQL de Supabase.

-- A. Lecture seule : les occasions actuelles des chaussures d'intérieur, génériques comprises (481 femme, 520 homme).
select id, name, genre, occasions
  from vestiaire_universel
 where category = 'chaussures' and (sous_type ilike '%intérieur%' or id in (481, 520))
 order by id;

-- B. Les 12 modèles par style : cocooning ET télétravail.
update vestiaire_universel
   set occasions = 'cocooning,travail_formel'
 where id between 1309 and 1320
   and sous_type = 'Chaussures d''intérieur'
   and occasions = 'cocooning';

-- C. SEULEMENT si l'étape A montre que 481 et 520 n'ont pas travail_formel (à valider avant : ce sont des pièces existantes).
-- update vestiaire_universel set occasions = occasions || ',travail_formel'
--  where id in (481, 520) and coalesce(occasions, '') <> '' and occasions not like '%travail_formel%';

-- Annulation de B :
-- update vestiaire_universel set occasions = 'cocooning' where id between 1309 and 1320 and occasions = 'cocooning,travail_formel';
