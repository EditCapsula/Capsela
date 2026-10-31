-- Style Créatif, étape 2 — 3/3 : ANNULER 01 et 02 (30/10/2026). Ne sert qu'en cas de retour arrière.
-- 02 : les pièces créées sont les seules dont la colonne styles vaut EXACTEMENT « Créatif » (01 n'en crée aucune : il ajoute à des
--      styles existants). À vérifier avant de supprimer :
select id, name, genre from vestiaire_universel where styles = 'Créatif' order by id;
-- delete from vestiaire_universel where styles = 'Créatif';

-- 01 : retire « , Créatif » ajouté aux articles existants, sans toucher aux autres styles.
-- update vestiaire_universel set styles = replace(styles, ', Créatif', '') where styles like '%, Créatif';
