# Avis de styliste — journal des arbitrages

Décisions prises par la Product Owner sur les points « À ARBITRER » de `docs/avis-de-styliste.md`. La spec reste la source de vérité ; ce journal la complète, point par point, dans l'ordre des décisions.

| Date | Point (spec) | Décision | Appliqué |
| --- | --- | --- | --- |
| 25/09/2026 | 11 — Point d'entrée | Accueil, section dédiée « Besoin d'un regard ? », carte « Avis de styliste » (description et CTA « Obtenir mon avis » fournis). Pas une 3ᵉ action de « Et si on préparait la suite ? ». « Demander un avis » (écran Tenue) reste distinct et intact. Aucune entrée dans la barre du bas. | Lot 1 |
| 25/09/2026 | 10 — Premium Gate | Feuille modale sur l'écran source ; « Découvrir Premium » → Paywall existant ; « Plus tard » ferme la feuille et laisse exactement sur l'écran source. Libellés de la section 5. | Lot 1 |
| 25/09/2026 | 9 — Profils d'accès | Règle unique AVIS_DE_STYLISTE → PREMIUM_REQUIRED : Premium confirmé → accès ; gratuit, expiré, non connecté, mode démo, statut inconnu → Premium Gate. Statut inconnu : vérification, puis Gate si non confirmé. | Lot 1 |
| 25/09/2026 | Nouveau — Statut Premium inconnu côté serveur | Refus, fail-closed : pas de confirmation Premium = pas d'appel OpenAI (erreur Supabase, table absente, lecture impossible compris). Refus technique : pas de Gate, mais « Impossible d'analyser ta tenue pour le moment. » + Réessayer. | Lot 1 (helper serveur) ; message au lot 3 |
| 25/09/2026 | Nouveau — Testabilité | Simulation des profils PREMIUM_ACTIVE, FREE, EXPIRED, UNKNOWN, DEMO, en développement uniquement ; jamais en production ; aucun contournement serveur. Checklist TEST 01 à 10. | Lot 1 |
| 25/09/2026 | 14 — Formats et tailles | Toute image lisible par le navigateur, convertie en JPEG. Réglages du dressing : 1200 px, JPEG 0,8. Source 15 Mo max. EXIF supprimé. | Lot 2 |
| 25/09/2026 | 2 — Conservation des photos | Aucune conservation par défaut ; photo conservée seulement si l'avis est enregistré dans le Journal (bucket privé à créer). | Lot 2 (rien n'est stocké) ; stockage au lot Journal |
| 25/09/2026 | 16 — Sortie pendant l'analyse | Garder le résultat : l'analyse continue si l'utilisatrice quitte l'écran ; au retour dans la même session, état « en cours », résultat ou erreur + Réessayer. Aucune reprise garantie après fermeture complète de l'app ; aucune persistance créée pour ce cas. Le résultat ne devient persistant que par « Enregistrer dans mon journal ». | Lot 3 (état d'analyse en mémoire, dans le store) |
| 25/09/2026 | 6 — Nombre et longueur | 2 à 3 points forts et 2 à 3 suggestions, une phrase chacun (≈ 140 caractères) ; avis global et conseil en 1 à 2 phrases (≈ 220). Plafonds vérifiés avec ~25 % de marge (180 / 280). | Lot 3 |
| 25/09/2026 | 7 — Affichage partiel | Jamais : une réponse incomplète est invalide (une relance, puis « Impossible d'analyser ta tenue pour le moment. »). | Lot 3 |
| 25/09/2026 | 13 — Personnalisation | Style, morphologie si renseignée (déclarée, jamais déduite de l'image), palette de couleurs préférées, colorimétrie analysée. Jamais nom, email ni identifiant. Garde-fous : la morphologie n'oriente que des suggestions de vêtements, en termes positifs ; le serveur rejette toute réponse contenant une note, la mention d'IA ou un mot interdit du projet (cacher, dissimuler, camoufler, corriger, défaut, grossir, amincir, peu flatteur). | Lot 3 |
| 25/09/2026 | 15 — Délai et relances | 45 s par appel ; une relance automatique, uniquement sur réponse invalide (pas sur délai dépassé ni erreur de l'API). | Lot 3 |
| 25/09/2026 | 3 — Méthode « Avec ton dressing » | Option A : le modèle décrit jusqu'à 3 besoins (catégorie, type de pièce, couleurs, matières, lien vers le conseil ou une suggestion) ; le serveur cherche dans le dressing de l'utilisatrice (lu par l'identifiant du JWT). Le dressing n'est jamais envoyé à OpenAI. | Lot 4 |
| 25/09/2026 | 4 — Aucune pièce / dressing vide | Section masquée. | Lot 4 |
| 25/09/2026 | 5 — Nombre de pièces | 3 au maximum. | Lot 4 |
| 25/09/2026 | 17 — Clic sur une pièce | Fiche de la pièce (écran existant), retour vers le résultat conservé en mémoire. | Lot 4 |
| 25/09/2026 | 19 — Place dans le Journal | Section dédiée « Mes avis de styliste » (un avis reçu n'est pas une tenue portée) : table `avis_styliste` à part, jamais `outfit_history`. Section masquée s'il n'y a aucun avis ou si la migration 0036 n'est pas exécutée. | Lot 5 (migration 0036, à exécuter à la main) |
| 25/09/2026 | 2 — Durée de conservation de la photo | Conservée tant que l'avis existe, dans un bucket privé (`avis-styliste-photos`, URL signées), supprimée avec l'avis ou le compte. | Lot 5 |
| 25/09/2026 | Nouveau — Suppression d'un avis | Possible, avec confirmation ; supprime la ligne puis la photo. Libellés non fournis (TODO_COPY). | Lot 5 |
| 25/09/2026 | Nouveau — Pièce retirée du dressing | Masquée dans « Avec ton dressing » de l'avis enregistré ; section masquée s'il n'en reste aucune. | Lot 5 |
