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
