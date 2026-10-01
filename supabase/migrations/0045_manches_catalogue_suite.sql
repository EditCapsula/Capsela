-- Longueur des manches du catalogue, suite (01/10/2026).
-- Les 165 pièces renseignées à la main après la migration 0044 (fichier manches-a-renseigner,
-- seconde version). Le 736 (« Chemise oversize manches courtes », saisie « longues »)
-- est volontairement écarté dans l'attente d'une confirmation.
-- Idempotent : ne touche que les lignes encore à NULL. À exécuter À LA MAIN dans l'éditeur SQL Supabase.

update public.vestiaire_universel set manches = 'sans'
where manches is null and id in (472, 473, 475, 546, 599, 642, 662, 702, 766, 772, 777, 783, 791, 804, 885, 902, 917, 922, 983, 1005);  -- 20 pièces

update public.vestiaire_universel set manches = 'courtes'
where manches is null and id in (598, 725, 732, 733, 734, 735, 738, 957, 1010, 1016, 1060);  -- 11 pièces

update public.vestiaire_universel set manches = 'longues'
where manches is null and id in (454, 455, 456, 457, 458, 459, 460, 461, 462, 474, 493, 503, 504, 505, 506, 507, 508, 509, 510, 511, 522, 597, 621, 640, 644, 675, 676, 687, 690, 695, 717, 737, 739, 748, 784, 785, 786, 789, 790, 795, 796, 798, 801, 802, 803, 805, 809, 810, 811, 814, 815, 816, 822, 823, 827, 828, 834, 835, 836, 837, 838, 839, 845, 846, 863, 865, 870, 873, 874, 875, 877, 883, 884, 889, 891, 892, 893, 894, 900, 901, 908, 909, 910, 911, 929, 930, 931, 932, 945, 947, 948, 952, 953, 958, 960, 961, 966, 967, 973, 977, 978, 985, 988, 994, 996, 997, 1000, 1001, 1017, 1023, 1030, 1031, 1032, 1036, 1038, 1039, 1044, 1045, 1046, 1051, 1062, 1067, 1068, 1071, 1075, 1078, 1082, 1084, 1085, 1086, 1087, 1088, 1089, 1090);  -- 134 pièces

-- Contrôle : sans = 51, courtes = 49, longues = 181, NULL = 346.
select manches, count(*) from public.vestiaire_universel group by manches order by manches;
