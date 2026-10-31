-- Annulation du lot 5 : remet à vide les seules coupes que 01 a écrites (même identifiants, même valeur).
update public.vestiaire_universel v
set coupe = null
from (values
  (491, 'Ajusté'),  -- Brassière de sport / Top respirant
  (493, 'Ample'),  -- Sweat à capuche (Hoodie) / Sweat zippé
  (494, 'Ajusté'),  -- Legging de sport / Cycliste (Biker short)
  (495, 'Ample'),  -- Pantalon de jogger / Jogging structuré
  (522, 'Ample'),  -- Sweat à capuche (Hoodie) / Sweat zippé
  (523, 'Ajusté'),  -- Legging de sport / Cycliste (Biker short)
  (524, 'Ample'),  -- Pantalon de jogger / Jogging structuré
  (566, 'Ample'),  -- Surchemise légère texturée
  (596, 'Ample'),  -- Jupe midi ligne A
  (650, 'Ample'),  -- Surchemise légère
  (671, 'Ample'),  -- Surchemise légère épurée
  (688, 'Ajusté'),  -- Pantalon cigarette
  (689, 'Ample'),  -- Robe midi ligne A
  (701, 'Ample'),  -- Jupe midi ligne A
  (716, 'Ajusté'),  -- Top bandeau structuré
  (723, 'Ample'),  -- Short cargo
  (724, 'Ample'),  -- Jupe cargo midi
  (745, 'Ample'),  -- Short cargo
  (748, 'Ample'),  -- Surchemise utilitaire légère
  (761, 'Ajusté'),  -- Body décolleté drapé
  (763, 'Ajusté'),  -- Top bustier structuré
  (765, 'Ajusté'),  -- Jupe crayon midi
  (779, 'Ajusté'),  -- Robe fourreau midi
  (793, 'Ample'),  -- Jupe trapèze courte
  (815, 'Ajusté'),  -- Pull col roulé fin
  (824, 'Ample'),  -- Jean wide leg
  (836, 'Ample'),  -- Surchemise
  (866, 'Ajusté'),  -- Pantalon cigarette
  (867, 'Ajusté'),  -- Jupe crayon midi
  (868, 'Ample'),  -- Jupe midi trapèze
  (873, 'Ajusté'),  -- Pull col roulé fin
  (894, 'Ample'),  -- Surchemise épaisse
  (906, 'Ample'),  -- Pantalon relaxed
  (910, 'Ample'),  -- Surchemise épaisse
  (929, 'Ample'),  -- Blouse manches longues légèrement bouffantes
  (930, 'Ajusté'),  -- Pull col roulé fin
  (932, 'Ample'),  -- Pull maille douce manches ballon
  (936, 'Ample'),  -- Jupe midi trapèze
  (939, 'Ample'),  -- Manteau cape structuré
  (967, 'Ample'),  -- Surchemise épaisse
  (1004, 'Ample'),  -- Blouse manches ballon
  (1031, 'Ajusté'),  -- Pull col roulé fin écru
  (1044, 'Ajusté'),  -- Pull col roulé fin noir
  (1049, 'Ample'),  -- Pantalon relaxed taupe
  (1051, 'Ample'),  -- Surchemise épaisse taupe
  (1064, 'Ample'),  -- Robe fluide manches ballon
  (1081, 'Ajusté'),  -- Jupe crayon midi en crêpe
  (1107, 'Ample'),  -- Surchemise patchwork
  (1109, 'Ample'),  -- Jogging coordonné à détail arty
  (1123, 'Ample'),  -- Pantalon palazzo à empiècements
  (1138, 'Ample'),  -- Surchemise légère patchwork
  (1148, 'Ample'),  -- Jupe trapèze midi à panneaux
  (1151, 'Ample'),  -- Pantalon palazzo en lin imprimé
  (1154, 'Ajusté'),  -- Sous-pull coloré
  (1159, 'Ample'),  -- Jean barrel ou wide-leg
  (1172, 'Ample'),  -- Jogging en maille graphique
  (1182, 'Ample'),  -- Jupe trapèze midi graphique
  (1184, 'Ample'),  -- Pantalon wide-leg à pinces contrastées
  (1190, 'Ample'),  -- Jean wide-leg contrasté
  (1211, 'Ample'),  -- Jupe trapèze midi en matière texturée
  (1213, 'Ample'),  -- Pantalon palazzo en laine texturée
  (1227, 'Ample'),  -- Pantalon jogger technique
  (1241, 'Ample'),  -- Surchemise estivale
  (1263, 'Ajusté'),  -- Sous-pull fin
  (1265, 'Ample'),  -- Pantalon cargo revisité
  (1269, 'Ample'),  -- Jogger technique
  (1277, 'Ajusté'),  -- Sous-pull graphique
  (1283, 'Ample'),  -- Pantalon cargo hiver
  (1287, 'Ample'),  -- Hoodie confortable
  (1292, 'Ajusté'),  -- Brassière graphique
  (1293, 'Ajusté'),  -- Legging imprimé ou contrasté
  (1295, 'Ajusté'),  -- Brassière technique color-block
  (1298, 'Ajusté'),  -- Brassière technique imprimée
  (1299, 'Ajusté'),  -- Legging à empiècements
  (1301, 'Ajusté'),  -- Brassière technique graphique
  (1302, 'Ajusté')   -- Legging technique contrasté
) as x(id, coupe)
where v.id = x.id and v.coupe = x.coupe
returning v.id, v.name;
