-- Chaussures de randonnée réservées à la valise (06/11/2026, demandé : « Pour des randos dans les tenues vacances il faut intégrer une
-- paire de chaussures de randonnée pour femme et homme »). Une paire par genre, sans style : reconnues par leur sous_type
-- (src/lib/piecesDeValise.ts), jamais dans une capsule ; la valise les ajoute à ses seules journées de randonnée, où elles remplacent
-- les autres chaussures. Pour le moteur, une chaussure de sport (SHOE_TYPE_MAP : Baskets). Nouvelles lignes seulement, aucune pièce
-- existante modifiée. À lancer à la main dans l'éditeur SQL de Supabase, une seule fois, APRÈS la mise en ligne du code (sinon ces
-- deux paires entreraient dans les capsules). Visuels : image_status 'missing', générés par le workflow du catalogue.

-- 0. Précaution : le compteur d'identifiants après le plus grand id existant. Ne modifie aucune ligne.
select setval(pg_get_serial_sequence('vestiaire_universel', 'id'), (select max(id) from vestiaire_universel));

-- 1. Les deux paires.
insert into vestiaire_universel (name, category, genre, styles, saison_capsule, sous_type, matiere, couleur_dominante, hex, manches, occasions, niveau_formalite, role_piece, est_basique_capsule, statement, image_status, frozen) values
  ('Chaussures de randonnée en nubuck', 'chaussures', 'femme', null, 'Printemps, Été, Automne, Hiver', 'Chaussures de randonnée', 'Nubuck', 'Taupe', '#A8967C', null, 'sport', 'decontracte', 'base', false, false, 'missing', false),
  ('Chaussures de randonnée en cuir', 'chaussures', 'homme', null, 'Printemps, Été, Automne, Hiver', 'Chaussures de randonnée', 'Cuir', 'Gris anthracite', '#4B4A47', null, 'sport', 'decontracte', 'base', false, false, 'missing', false);

-- 2. Contrôle : les deux paires.
select id, name, genre, sous_type, image_status from vestiaire_universel where sous_type = 'Chaussures de randonnée' order by genre;

-- Annulation (retour arrière seulement, avant toute utilisation) :
-- delete from vestiaire_universel where sous_type = 'Chaussures de randonnée'
--    and name in ('Chaussures de randonnée en nubuck', 'Chaussures de randonnée en cuir');
