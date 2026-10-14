-- Les collants « fins transparents » (496) et « semi-opaques » (497) portaient la photo d'une POCHETTE (catalog-images/femme/accessoires/17.webp),
-- visible dans la liste « Les pièces de ta tenue ». Les deux autres collants (498, 499) portent déjà la photo de collants
-- (femme/accessoires/59.webp, vérifiée à l'œil le 14/10/2026) : les deux premiers la reprennent. À exécuter À LA MAIN dans l'éditeur SQL ;
-- réversible : remettre 'femme/accessoires/17.webp'. Aucune autre pièce n'est touchée (les autres images partagées du catalogue relient
-- des pièces de même type, mesuré le 14/10/2026 par scripts/images-partagees.audit.ts).
update public.vestiaire_universel
set url_image = 'https://tkrbzrazejrxavtfspll.supabase.co/storage/v1/object/public/catalog-images/femme/accessoires/59.webp'
where id in (496, 497)
  and url_image = 'https://tkrbzrazejrxavtfspll.supabase.co/storage/v1/object/public/catalog-images/femme/accessoires/17.webp';
