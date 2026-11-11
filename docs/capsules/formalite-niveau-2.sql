-- LE RECLASSEMENT AU NIVEAU 2 « casual_chic » (11/11/2026, décision D1 ; liste validée par la propriétaire : 126 pièces, après retrait
-- des jupes crayon, pantalons cigarette et à pinces, mules à talons et mocassins à petit talon).
--
-- Proposition et mesure : scripts/niveau-2.audit.ts (exécution n° 2 du workflow « Audits du moteur ») ; critères écrits dans l'audit.
-- Une seule colonne modifiée (niveau_formalite), sur 126 lignes nommées ; aucune ligne créée ni supprimée, aucune image touchée.
--
-- ORDRE : 1. le code qui lit « casual_chic » est en ligne (sinon l'app devinerait la formalité de ces pièces par leur nom) ;
--         2. la migration 0061 est lancée (sinon la contrainte refuse la valeur) ; 3. ce fichier.
-- À lancer à la main dans l'éditeur SQL de Supabase.

-- 0. Contrôle avant : les niveaux actuels de ces pièces (attendu : 126 lignes, en business_casual, habille ou decontracte).
select niveau_formalite, count(*) from vestiaire_universel
 where id in (452, 467, 468, 470, 517, 527, 540, 545, 546, 570, 577, 590, 596, 597, 599, 600, 602, 622, 637, 640, 641, 642, 643, 644, 649, 652, 654, 658, 661, 664, 670, 673, 675, 678, 687, 689, 699, 701, 703, 706, 773, 778, 784, 794, 797, 800, 801, 818, 840, 854, 855, 865, 868, 869, 875, 890, 891, 927, 928, 929, 931, 933, 934, 936, 941, 990, 991, 993, 997, 998, 1014, 1015, 1037, 1038, 1039, 1046, 1059, 1064, 1065, 1070, 1073, 1082, 1085, 1086, 1087, 1088, 1089, 1090, 1091, 1093, 1098, 1102, 1105, 1112, 1119, 1123, 1124, 1125, 1128, 1133, 1134, 1137, 1142, 1151, 1155, 1157, 1163, 1166, 1167, 1176, 1177, 1181, 1182, 1189, 1205, 1209, 1210, 1211, 1215, 1216, 1223, 1230, 1247, 1262, 1264, 1266)
 group by 1 order by 1;

-- 1. Sauvegarde du niveau d'avant, pour pouvoir revenir en arrière.
create table if not exists sauvegarde_formalite_niveau2 as
  select id, niveau_formalite from vestiaire_universel where id in (452, 467, 468, 470, 517, 527, 540, 545, 546, 570, 577, 590, 596, 597, 599, 600, 602, 622, 637, 640, 641, 642, 643, 644, 649, 652, 654, 658, 661, 664, 670, 673, 675, 678, 687, 689, 699, 701, 703, 706, 773, 778, 784, 794, 797, 800, 801, 818, 840, 854, 855, 865, 868, 869, 875, 890, 891, 927, 928, 929, 931, 933, 934, 936, 941, 990, 991, 993, 997, 998, 1014, 1015, 1037, 1038, 1039, 1046, 1059, 1064, 1065, 1070, 1073, 1082, 1085, 1086, 1087, 1088, 1089, 1090, 1091, 1093, 1098, 1102, 1105, 1112, 1119, 1123, 1124, 1125, 1128, 1133, 1134, 1137, 1142, 1151, 1155, 1157, 1163, 1166, 1167, 1176, 1177, 1181, 1182, 1189, 1205, 1209, 1210, 1211, 1215, 1216, 1223, 1230, 1247, 1262, 1264, 1266);

-- 2. Le reclassement.
update vestiaire_universel
   set niveau_formalite = 'casual_chic'
 where id in (452, 467, 468, 470, 517, 527, 540, 545, 546, 570, 577, 590, 596, 597, 599, 600, 602, 622, 637, 640, 641, 642, 643, 644, 649, 652, 654, 658, 661, 664, 670, 673, 675, 678, 687, 689, 699, 701, 703, 706, 773, 778, 784, 794, 797, 800, 801, 818, 840, 854, 855, 865, 868, 869, 875, 890, 891, 927, 928, 929, 931, 933, 934, 936, 941, 990, 991, 993, 997, 998, 1014, 1015, 1037, 1038, 1039, 1046, 1059, 1064, 1065, 1070, 1073, 1082, 1085, 1086, 1087, 1088, 1089, 1090, 1091, 1093, 1098, 1102, 1105, 1112, 1119, 1123, 1124, 1125, 1128, 1133, 1134, 1137, 1142, 1151, 1155, 1157, 1163, 1166, 1167, 1176, 1177, 1181, 1182, 1189, 1205, 1209, 1210, 1211, 1215, 1216, 1223, 1230, 1247, 1262, 1264, 1266);

-- 3. Contrôle après : 126 pièces en casual_chic.
select count(*) as casual_chic from vestiaire_universel where niveau_formalite = 'casual_chic';

-- Annulation (retour arrière) :
-- update vestiaire_universel v set niveau_formalite = s.niveau_formalite
--   from sauvegarde_formalite_niveau2 s where v.id = s.id;
