-- Chaussures d'intérieur : un modèle par style (06/11/2026, tableau validé par la propriétaire : « Oui je valide le tableau »).
-- Signalé : seul le modèle Minimaliste existait (« j'ai vu minimaliste sur la fiche ») ; les autres styles n'avaient aucune chaussure
-- pour Cocooning et Télétravail. Nouvelles lignes seulement : aucune pièce existante n'est modifiée. À lancer à la main dans l'éditeur
-- SQL de Supabase, une seule fois. Annulation en fin de fichier.
--
-- Reconnaissance : sous_type « Chaussures d'intérieur » (SHOE_TYPE_MAP, vestiaire.ts). Occasion cocooning, quatre saisons, style seul.
-- Visuels : image_status 'missing' ; le workflow « Générer toutes les images du catalogue » ne générera que ceux-ci.

-- 0. Avant : les chaussures d'intérieur déjà au catalogue (lecture seule). À regarder : s'il en existe déjà pour un style ci-dessous,
--    me le dire avant de lancer l'étape 2.
select id, name, genre, styles, sous_type, couleur_dominante
  from vestiaire_universel
 where category = 'chaussures'
   and (sous_type ilike '%intérieur%' or name ~* 'chausson|charentaise|pantoufle|intérieur|sabots? fourrés?')
 order by styles, genre;

-- 1. Précaution : le compteur d'identifiants après le plus grand id existant. Ne modifie aucune ligne.
select setval(pg_get_serial_sequence('vestiaire_universel', 'id'), (select max(id) from vestiaire_universel));

-- 2. Les nouvelles pièces.
insert into vestiaire_universel (name, category, genre, styles, saison_capsule, sous_type, matiere, couleur_dominante, hex, manches, occasions, niveau_formalite, role_piece, est_basique_capsule, statement, image_status, frozen) values
  ('Mules d''intérieur en maille côtelée', 'chaussures', 'femme', 'Casual chic', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Maille', 'Beige', '#CDBBA2', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Charentaises en feutre', 'chaussures', 'homme', 'Casual chic', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Feutre', 'Gris', '#9B968F', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chaussons ballerines en velours', 'chaussures', 'femme', 'Classique chic', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Velours', 'Marine', '#3A4152', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Mocassins d''intérieur en daim', 'chaussures', 'homme', 'Classique chic', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Daim', 'Marine', '#3A4152', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chaussons en satin à nœud', 'chaussures', 'femme', 'Romantique', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Satin', 'Rose poudré', '#D3AE9F', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Babouches en cuir brodées', 'chaussures', 'unisexe', 'Bohème', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Cuir', 'Camel', '#C08A5E', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Claquettes d''intérieur matelassées', 'chaussures', 'unisexe', 'Streetwear', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Nylon matelassé', 'Noir', '#2A2724', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Mocassins d''intérieur doublés', 'chaussures', 'femme', 'Preppy', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Daim', 'Bordeaux', '#6E3B3A', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chaussons en velours à écusson', 'chaussures', 'homme', 'Preppy', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Velours', 'Bordeaux', '#6E3B3A', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Mules d''intérieur en velours à plumes', 'chaussures', 'femme', 'Glamour', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Velours', 'Champagne', '#E8D9B5', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chaussons en feutre color-block moutarde et vert', 'chaussures', 'femme', 'Créatif', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Feutre', 'Moutarde', '#C39A50', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chaussons en feutre color-block gris et terracotta', 'chaussures', 'homme', 'Créatif', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Feutre', 'Gris', '#9B968F', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false);

-- 3. Minimaliste homme : seulement s'il n'existe aucune chaussure d'intérieur Minimaliste pour l'homme (ou unisexe).
insert into vestiaire_universel (name, category, genre, styles, saison_capsule, sous_type, matiere, couleur_dominante, hex, manches, occasions, niveau_formalite, role_piece, est_basique_capsule, statement, image_status, frozen)
select 'Mules d''intérieur en feutre', 'chaussures', 'homme', 'Minimaliste', 'Printemps, Été, Automne, Hiver', 'Chaussures d''intérieur', 'Feutre', 'Gris anthracite', '#4B4A47', null, 'cocooning', 'decontracte', 'base', false, false, 'missing', false
 where not exists (
   select 1 from vestiaire_universel
    where category = 'chaussures'
      and (sous_type ilike '%intérieur%' or name ~* 'chausson|charentaise|pantoufle|intérieur|sabots? fourrés?')
      and styles ilike '%Minimaliste%'
      and genre in ('homme', 'unisexe')
 );

-- 4. Contrôle : la liste de l'étape 0, avec les nouvelles pièces (12 ou 13 de plus).
select id, name, genre, styles, image_status
  from vestiaire_universel
 where category = 'chaussures'
   and (sous_type ilike '%intérieur%' or name ~* 'chausson|charentaise|pantoufle|intérieur|sabots? fourrés?')
 order by styles, genre;

-- Annulation (retour arrière seulement, avant toute utilisation) :
-- delete from vestiaire_universel
--  where category = 'chaussures' and sous_type = 'Chaussures d''intérieur' and occasions = 'cocooning'
--    and name in ('Mules d''intérieur en maille côtelée', 'Charentaises en feutre', 'Chaussons ballerines en velours',
--                 'Mocassins d''intérieur en daim', 'Chaussons en satin à nœud', 'Babouches en cuir brodées',
--                 'Claquettes d''intérieur matelassées', 'Mocassins d''intérieur doublés', 'Chaussons en velours à écusson',
--                 'Mules d''intérieur en velours à plumes', 'Chaussons en feutre color-block moutarde et vert',
--                 'Chaussons en feutre color-block gris et terracotta', 'Mules d''intérieur en feutre');
