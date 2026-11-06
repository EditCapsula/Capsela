-- Pièces réservées à la valise : plage, piscine et spa (06/11/2026, tableau validé par la propriétaire : « Oui »).
-- Un maillot de bain et une surchemise (femme), un short de bain et une chemise de plage (homme), un modèle par style : 32 pièces.
-- Reconnues par leur sous_type (src/lib/piecesDeValise.ts) : jamais dans une capsule, ajoutées par la valise seule à ses situations de
-- baignade. Nouvelles lignes seulement, aucune pièce existante modifiée. À lancer à la main dans l'éditeur SQL de Supabase, une
-- seule fois, APRÈS la mise en ligne du code (sinon ces pièces entreraient dans les capsules). Annulation en fin de fichier.
--
-- Saisons : maillot et short de bain toute l'année (spa, piscine couverte), couvertures au printemps et en été. Occasions :
-- quotidien (plage, piscine) et cocooning (spa) ; la surchemise femme ne sert qu'à la plage et à la piscine. Visuels : image_status
-- 'missing', générés par le workflow « Générer toutes les images du catalogue ».

-- 0. Précaution : le compteur d'identifiants après le plus grand id existant. Ne modifie aucune ligne.
select setval(pg_get_serial_sequence('vestiaire_universel', 'id'), (select max(id) from vestiaire_universel));

-- 1. Les 32 pièces.
insert into vestiaire_universel (name, category, genre, styles, saison_capsule, sous_type, matiere, couleur_dominante, hex, manches, occasions, niveau_formalite, role_piece, est_basique_capsule, statement, image_status, frozen) values
  ('Maillot une pièce échancré', 'combinaisons', 'femme', 'Minimaliste', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Noir', '#2A2724', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Maillot une pièce à bretelles nouées', 'combinaisons', 'femme', 'Casual chic', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Sable', '#D9C9B2', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Maillot une pièce encolure carrée', 'combinaisons', 'femme', 'Classique chic', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Marine', '#3A4152', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Maillot une pièce à volants', 'combinaisons', 'femme', 'Romantique', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Rose poudré', '#D3AE9F', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Maillot une pièce crocheté', 'combinaisons', 'femme', 'Bohème', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Terracotta', '#B4735A', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Maillot une pièce sportif zippé', 'combinaisons', 'femme', 'Streetwear', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Noir', '#2A2724', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Maillot une pièce rayé', 'combinaisons', 'femme', 'Preppy', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Marine', '#3A4152', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Maillot une pièce drapé à anneau doré', 'combinaisons', 'femme', 'Glamour', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Noir', '#2A2724', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Maillot une pièce color-block', 'combinaisons', 'femme', 'Créatif', 'Printemps, Été, Automne, Hiver', 'Maillot de bain', 'Maille de bain', 'Moutarde', '#C39A50', 'sans', 'quotidien,cocooning', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Surchemise en lin', 'hauts', 'femme', 'Minimaliste', 'Printemps, Été', 'Surchemise de plage', 'Lin', 'Blanc', '#F7F4EE', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Surchemise en lin rayée', 'hauts', 'femme', 'Casual chic', 'Printemps, Été', 'Surchemise de plage', 'Lin', 'Bleu ciel', '#A9BFCB', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Chemise de plage en voile de coton', 'hauts', 'femme', 'Classique chic', 'Printemps, Été', 'Surchemise de plage', 'Voile de coton', 'Ivoire', '#F0EAE0', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Surchemise en broderie anglaise', 'hauts', 'femme', 'Romantique', 'Printemps, Été', 'Surchemise de plage', 'Coton', 'Blanc', '#F7F4EE', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Kimono de plage imprimé', 'hauts', 'femme', 'Bohème', 'Printemps, Été', 'Kimono de plage', 'Viscose', 'Rouille', '#A9613F', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Chemise oversize en popeline', 'hauts', 'femme', 'Streetwear', 'Printemps, Été', 'Surchemise de plage', 'Coton popeline', 'Kaki', '#8A8560', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Chemise oxford rayée', 'hauts', 'femme', 'Preppy', 'Printemps, Été', 'Surchemise de plage', 'Coton oxford', 'Bleu ciel', '#A9BFCB', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Kimono en satin', 'hauts', 'femme', 'Glamour', 'Printemps, Été', 'Kimono de plage', 'Satin', 'Champagne', '#E8D9B5', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Chemise imprimée graphique', 'hauts', 'femme', 'Créatif', 'Printemps, Été', 'Surchemise de plage', 'Viscose', 'Corail', '#C9846A', 'longues', 'quotidien', 'decontracte', 'calque', false, false, 'missing', false),
  ('Short de bain uni', 'shorts', 'homme', 'Minimaliste', 'Printemps, Été, Automne, Hiver', 'Short de bain', 'Polyester', 'Marine', '#3A4152', null, 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Short de bain', 'shorts', 'homme', 'Casual chic', 'Printemps, Été, Automne, Hiver', 'Short de bain', 'Polyester', 'Sable', '#D9C9B2', null, 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Short de bain tailleur', 'shorts', 'homme', 'Classique chic', 'Printemps, Été, Automne, Hiver', 'Short de bain', 'Polyester', 'Marine', '#3A4152', null, 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Short de bain imprimé', 'shorts', 'homme', 'Bohème', 'Printemps, Été, Automne, Hiver', 'Short de bain', 'Polyester', 'Terracotta', '#B4735A', null, 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Short de bain long', 'shorts', 'homme', 'Streetwear', 'Printemps, Été, Automne, Hiver', 'Short de bain', 'Polyester', 'Noir', '#2A2724', null, 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Short de bain à motifs', 'shorts', 'homme', 'Preppy', 'Printemps, Été, Automne, Hiver', 'Short de bain', 'Polyester', 'Bordeaux', '#6E3B3A', null, 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Short de bain color-block', 'shorts', 'homme', 'Créatif', 'Printemps, Été, Automne, Hiver', 'Short de bain', 'Polyester', 'Moutarde', '#C39A50', null, 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chemise en lin', 'hauts', 'homme', 'Minimaliste', 'Printemps, Été', 'Chemise de plage', 'Lin', 'Blanc', '#F7F4EE', 'courtes', 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chemise en lin', 'hauts', 'homme', 'Casual chic', 'Printemps, Été', 'Chemise de plage', 'Lin', 'Bleu ciel', '#A9BFCB', 'courtes', 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chemisette en coton', 'hauts', 'homme', 'Classique chic', 'Printemps, Été', 'Chemise de plage', 'Coton', 'Ivoire', '#F0EAE0', 'courtes', 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chemise en lin col tunisien', 'hauts', 'homme', 'Bohème', 'Printemps, Été', 'Chemise de plage', 'Lin', 'Blanc cassé', '#EDE4D6', 'courtes', 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chemise de bowling', 'hauts', 'homme', 'Streetwear', 'Printemps, Été', 'Chemise de plage', 'Viscose', 'Kaki', '#8A8560', 'courtes', 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chemise oxford manches courtes', 'hauts', 'homme', 'Preppy', 'Printemps, Été', 'Chemise de plage', 'Coton oxford', 'Bleu ciel', '#A9BFCB', 'courtes', 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false),
  ('Chemise imprimée graphique', 'hauts', 'homme', 'Créatif', 'Printemps, Été', 'Chemise de plage', 'Viscose', 'Vert sauge', '#9AA389', 'courtes', 'quotidien,cocooning', 'decontracte', 'base', false, false, 'missing', false);

-- 2. Contrôle : doit renvoyer 32.
select count(*) from vestiaire_universel
 where sous_type in ('Maillot de bain', 'Short de bain', 'Surchemise de plage', 'Chemise de plage', 'Kimono de plage');

-- Annulation (retour arrière seulement) :
-- delete from vestiaire_universel
--  where sous_type in ('Maillot de bain', 'Short de bain', 'Surchemise de plage', 'Chemise de plage', 'Kimono de plage');
