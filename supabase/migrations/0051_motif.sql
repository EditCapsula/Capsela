-- Motif d'une pièce (11/10/2026) : « Uni », « Rayures », « Carreaux »… lu sur la photo par l'analyse, corrigeable dans la fiche.
--
-- Une seule colonne, facultative. Les lignes existantes ne sont pas touchées (motif inconnu = null, le moteur de tenues ne le lit pas
-- encore). Tant que cette migration n'est pas exécutée, l'app fonctionne : choisir un motif échoue à l'enregistrement de cette seule
-- colonne (jamais dans l'insertion de la pièce), et l'échec est signalé à l'écran — même règle que les manches (0042).
--
-- Les valeurs doivent rester celles de MOTIFS (src/lib/motifs.ts, supabase/functions/_shared/enumsPiece.ts) ; un test les verrouille.

alter table public.dressing_items add column if not exists motif text;

alter table public.dressing_items drop constraint if exists dressing_items_motif_check;
alter table public.dressing_items add constraint dressing_items_motif_check
  check (motif is null or motif in ('uni', 'rayures', 'carreaux', 'pois', 'fleurs', 'animalier', 'graphique', 'autre'));
