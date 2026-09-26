-- 0037 — Reconnaissance des pièces portées sur un avis de styliste enregistré
-- (26/09/2026, couche PHOTO → PIÈCES DU DRESSING → COMPOSITION → ACTIONS).
--
-- À EXÉCUTER À LA MAIN dans l'éditeur SQL de Supabase. Avant elle, l'app
-- fonctionne : la reconnaissance et ses corrections vivent à l'écran, et
-- seule leur conservation dans le Journal échoue — écriture isolée
-- (enregistrerReconnaissanceAvis), signalée à l'écran, qui ne touche jamais
-- l'enregistrement de l'avis lui-même.

-- [{ categorie, libelle, pieceId, statut, candidats }] : les vêtements
-- visibles reliés au dressing, corrections de l'utilisatrice comprises.
-- Pas de clé étrangère, comme pieces_dressing : une pièce retirée depuis
-- n'est simplement plus affichée.
alter table public.avis_styliste
  add column if not exists pieces_reconnues jsonb not null default '[]'::jsonb
  check (jsonb_typeof(pieces_reconnues) = 'array');

-- Mise à jour par la propriétaire uniquement, pour garder une correction.
-- (0036 n'en permettait aucune : l'avis lui-même ne se réécrit toujours pas
-- côté app, seule cette colonne est mise à jour.)
drop policy if exists "avis_styliste_update_proprietaire" on public.avis_styliste;
create policy "avis_styliste_update_proprietaire" on public.avis_styliste
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
