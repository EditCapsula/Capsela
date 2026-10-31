-- Style Créatif, étape 2 — 1/3 : étiqueter « Créatif » des articles EXISTANTS (30/10/2026).
-- À lancer à la main dans l'éditeur SQL, après validation. Ajout seulement : aucun style retiré, aucune autre colonne touchée,
-- aucun identifiant ni aucune image modifiés. Idempotent (un article déjà étiqueté n'est pas retouché). Annulation : 03-annuler.sql.

-- 1.a Équivalents exacts de la capsule de référence (relus un à un, docs/capsules/creatif/audit-rapprochement-creatif.md).
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Créatif' else styles || ', Créatif' end
where id in (
  504  , -- Pull col roulé (homme) ← H-CR-HIV-05
  505  , -- Veste en jean (homme) ← H-CR-PRI-18
  506  , -- Blazer noir en laine (homme) ← H-CR-HIV-14
  512  , -- Manteau droit en laine (homme) ← H-CR-AUT-18
  521  , -- T-shirt technique / Débardeur sport (homme) ← H-CR-PRI-20, H-CR-ÉTÉ-18
  565  , -- Chemise imprimée légère (homme) ← H-CR-ÉTÉ-04
  574  , -- Sandales en cuir à brides (homme) ← H-CR-ÉTÉ-23
  577  , -- Mocassins souples (homme) ← H-CR-AUT-26
  609  , -- Chemise Oxford (homme) ← H-CR-AUT-03
  675  , -- Blazer déstructuré (homme) ← H-CR-PRI-16
  709  , -- Derbies classiques (homme) ← H-CR-HIV-25
  710  , -- T-shirt oversize graphique (femme) ← F-CRE-ÉTÉ-02, F-CRE-ÉTÉ-25, F-CRE-AUT-02
  750  , -- Sneakers rétro basses (homme) ← H-CR-AUT-23
  752  , -- Sneakers montantes (homme) ← H-CR-HIV-23
  807  , -- Pantalon droit (homme) ← H-CR-AUT-11, H-CR-HIV-12
  813  , -- Bottines en cuir / Chelsea (homme) ← H-CR-AUT-25, H-CR-HIV-24
  817  , -- Pantalon droit velours côtelé (femme) ← F-CRE-AUT-10
  836  , -- Surchemise (homme) ← H-CR-PRI-06
  846  , -- Cardigan épais (homme) ← H-CR-HIV-07
  851  , -- Bonnet côtelé minimaliste (homme) ← H-CR-HIV-28
  852  , -- Gants classiques (homme) ← H-CR-HIV-29
  901  , -- Chemise imprimée paisley (homme) ← H-CR-AUT-02, H-CR-HIV-03
  905  , -- Pantalon ample à pinces (homme) ← H-CR-PRI-11, H-CR-AUT-10
  910  , -- Surchemise épaisse (homme) ← H-CR-AUT-15
  911  , -- Veste workwear souple (homme) ← H-CR-AUT-17
  957  , -- T-shirt graphique minimal (homme) ← H-CR-PRI-01
  973  , -- Sweat graphique oversize (femme) ← F-CRE-HIV-07, F-CRE-HIV-26
  1063   -- Top drapé asymétrique (femme) ← F-CRE-PRI-03, F-CRE-ÉTÉ-03
) and coalesce(styles, '') not like '%Créatif%';

-- 1.b Pièces transversales (communes à tous les styles) : sans elles, Sport et Cocooning n'ont pas de chaussures Créatif
-- (R-B13 : seules les chaussures d'intérieur sont admises en Cocooning).
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Créatif' else styles || ', Créatif' end
where id in (481, 520, 971, 972) and coalesce(styles, '') not like '%Créatif%'; -- 481 Chaussures d'intérieur (femme) ; 520 Chaussures d'intérieur (homme) ; 971 Baskets de sport (femme) ; 972 Baskets de sport (homme)

-- 1.c DÉCISION EN ATTENTE — pièces UNISEXES rapprochées de la capsule homme : les étiqueter les fait aussi entrer dans les capsules
-- Créatif FEMME. Laissées en commentaire : à décommenter seulement si tu le décides.
-- update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Créatif' else styles || ', Créatif' end
-- where id in (486, 580, 756, 926) and coalesce(styles, '') not like '%Créatif%'; -- 486 Lunettes de soleil ← H-CR-PRI-31 ; 580 Ceinture tressée ← H-CR-ÉTÉ-29 ; 756 Sac crossbody ← H-CR-AUT-28 ; 926 Écharpe oversize ← H-CR-HIV-27
