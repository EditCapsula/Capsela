-- Style Créatif — 05 : CRÉER les 17 pièces de sport Créatif (bloc 2.b de 02), 31/10/2026.
-- À lancer à la main, SEULEMENT APRÈS la mise en ligne du sport par étiquette (option C2, PR « sport par style ») ET après
-- 04-etiqueter-sport-commun.sql. Avec l'ancienne règle, ces pièces entreraient dans les capsules de TOUS les styles ; avec C2, dans
-- les seules capsules Créatif (mesuré : scripts/creatif-sport.audit.ts, scénario S5 — aucune capsule d'un autre style modifiée).
-- Nouvelles lignes seulement, styles = « Créatif » seul. Ne pas lancer deux fois. Annulation en fin de fichier.

-- 05.0 Précaution : le compteur d'identifiants après le plus grand id existant. Ne modifie aucune ligne.
select setval(pg_get_serial_sequence('vestiaire_universel', 'id'), (select max(id) from vestiaire_universel));

insert into vestiaire_universel (name, category, genre, styles, saison_capsule, sous_type, matiere, couleur_dominante, hex, manches, occasions, niveau_formalite, role_piece, est_basique_capsule, statement, image_status, frozen) values
  ('Brassière graphique', 'hauts', 'femme', 'Créatif', 'Printemps', 'Brassière', 'Matière technique stretch', 'Chocolat', '#7C5436', 'sans', 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-PRI-19 · couleur proposée
  ('Legging imprimé ou contrasté', 'pantalons', 'femme', 'Créatif', 'Printemps', 'Legging', 'Matière technique stretch', 'Vert sauge', '#9AA389', null, 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-PRI-20 · couleur proposée
  ('Haut technique manches courtes', 'hauts', 'femme', 'Créatif', 'Printemps', 'Haut technique', 'Matière technique', 'Bleu cobalt', '#1E4FA3', 'courtes', 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-PRI-21 · couleur proposée
  ('Brassière technique color-block', 'hauts', 'femme', 'Créatif', 'Été', 'Brassière', 'Matière technique', 'Chocolat', '#7C5436', 'sans', 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-ÉTÉ-21 · couleur proposée
  ('Short de sport imprimé', 'shorts', 'femme', 'Créatif', 'Été', 'Short', 'Matière technique', 'Corail', '#C9846A', null, 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-ÉTÉ-22 · couleur proposée
  ('Débardeur respirant graphique', 'hauts', 'femme', 'Créatif', 'Été', 'Débardeur', 'Matière technique', 'Turquoise', '#3A9A9E', 'sans', 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-ÉTÉ-23 · couleur proposée
  ('Brassière technique imprimée', 'hauts', 'femme', 'Créatif', 'Automne', 'Brassière', 'Matière technique', 'Vert forêt', '#2F4A38', 'sans', 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-AUT-21 · couleur proposée
  ('Legging à empiècements', 'pantalons', 'femme', 'Créatif', 'Automne', 'Legging', 'Matière technique', 'Chocolat', '#7C5436', null, 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-AUT-22 · couleur proposée
  ('Haut technique manches longues', 'hauts', 'femme', 'Créatif', 'Automne', 'Haut technique', 'Matière technique', 'Rouille', '#A9613F', 'longues', 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-AUT-23 · couleur proposée
  ('Brassière technique graphique', 'hauts', 'femme', 'Créatif', 'Hiver', 'Brassière', 'Matière technique', 'Prune', '#5B3A4A', 'sans', 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-HIV-21 · couleur proposée
  ('Legging technique contrasté', 'pantalons', 'femme', 'Créatif', 'Hiver', 'Legging', 'Matière technique', 'Gris', '#9B968F', null, 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-HIV-22 · couleur proposée
  ('Haut thermique technique', 'hauts', 'femme', 'Créatif', 'Hiver', 'Haut technique', 'Matière technique', 'Noir', '#2A2724', null, 'sport', 'sport', 'base', false, false, 'missing', false), -- F-CRE-HIV-23 · couleur proposée
  ('Short de sport', 'shorts', 'homme', 'Créatif', 'Printemps, Été', 'Short', 'Matière technique', 'Noir', '#2A2724', null, 'sport', 'sport', 'base', false, false, 'missing', false), -- H-CR-PRI-21, H-CR-ÉTÉ-17
  ('Débardeur technique', 'hauts', 'homme', 'Créatif', 'Été', 'Débardeur', 'Polyester technique', 'Noir', '#2A2724', 'sans', 'sport', 'sport', 'base', false, false, 'missing', false), -- H-CR-ÉTÉ-16
  ('Haut technique manches longues', 'hauts', 'homme', 'Créatif', 'Automne', 'Haut technique', 'Matière technique', 'Noir', '#2A2724', 'longues', 'sport', 'sport', 'base', false, false, 'missing', false), -- H-CR-AUT-19
  ('Haut thermique', 'hauts', 'homme', 'Créatif', 'Hiver', 'Haut technique', 'Matière technique', 'Noir', '#2A2724', null, 'sport', 'sport', 'base', false, false, 'missing', false), -- H-CR-HIV-19
  ('Pantalon de sport chaud', 'pantalons', 'homme', 'Créatif', 'Hiver', 'Jogging', 'Matière technique', 'Noir', '#2A2724', null, 'sport', 'sport', 'base', false, false, 'missing', false); -- H-CR-HIV-20

-- Contrôle : doit renvoyer 17.
select count(*) from vestiaire_universel where styles = 'Créatif' and niveau_formalite = 'sport';

-- Annulation (retour arrière seulement) :
-- delete from vestiaire_universel where styles = 'Créatif' and niveau_formalite = 'sport';
