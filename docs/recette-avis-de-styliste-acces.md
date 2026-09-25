# Recette — Avis de styliste : accès Premium

Scénarios TEST 01 à 10 demandés le 25/09/2026. Règle testée : **AVIS_DE_STYLISTE → PREMIUM_REQUIRED** — « pas de confirmation Premium = pas d'appel OpenAI ».

## Comment simuler un profil (développement uniquement)

Sous `npm run dev` seulement, ajouter à l'URL `?simulerPremium=<PROFIL>` :

| Profil | Statut produit dans l'app |
| --- | --- |
| `PREMIUM_ACTIVE` | premium |
| `FREE` | gratuit |
| `EXPIRED` | gratuit (calculé par la vraie règle d'expiration sur une ligne échue) |
| `UNKNOWN` | inconnu |
| `DEMO` | inconnu (comme l'app sans Supabase) |

Le profil est gardé pour l'onglet ; `?simulerPremium=AUCUNE` l'arrête. Code : `src/lib/simulationPremium.ts`.

**La simulation ne change que l'affichage côté app.** Le contrôle serveur (`assertPremium`, `supabase/functions/_shared/premium.ts`) n'a volontairement aucun contournement : ses cas sont vérifiés par les tests automatiques (`src/lib/__tests__/premiumServeur.test.ts`), avec un faux client Supabase.

## Où en est chaque test

L'endpoint d'analyse (lot 3) et la prise de photo (lot 2) n'existent pas encore. Une colonne dit ce qui est vérifiable aujourd'hui.

| Test | Précondition | Action | Résultat attendu | Comportement serveur | Appel OpenAI | Vérifiable |
| --- | --- | --- | --- | --- | --- | --- |
| 01 — Premium actif | `?simulerPremium=PREMIUM_ACTIVE`, ou compte avec une ligne `premium_access` active | Accueil → « Obtenir mon avis » → photo → Analyser | Écran « Avis de styliste », puis résultat | `autoriserFonctionnalite` → accès | OUI | Accès : **aujourd'hui**. Photo, analyse, résultat : lots 2-3 |
| 02 — Free, Plus tard | `?simulerPremium=FREE` | Accueil → carte → « Plus tard » | Premium Gate (libellés exacts), fermeture, on reste sur l'Accueil | Aucun appel (rien n'est envoyé) | NON | **Aujourd'hui** |
| 03 — Free, Découvrir Premium | `?simulerPremium=FREE` | Accueil → carte → « Découvrir Premium » | Paywall Premium existant | Aucun appel | NON | **Aujourd'hui** |
| 04 — Abonnement expiré | `?simulerPremium=EXPIRED` | Accueil → carte | Premium Gate | `assertPremium` → 403 (test auto « abonnement expiré ») | NON | **Aujourd'hui** (app + test serveur) |
| 05 — Mode démo | `?simulerPremium=DEMO`, ou app sans variables Supabase | Accueil → carte | Premium Gate, aucune analyse possible | Aucun serveur en démo | NON | **Aujourd'hui** |
| 06 — Statut inconnu | `?simulerPremium=UNKNOWN` | Accueil → carte | Vérification, puis Premium Gate (statut non confirmé côté app) | Si l'endpoint est appelé : 503, affiché « Impossible d'analyser ta tenue pour le moment. » + Réessayer (`reactionRefusServeur`) | NON | App : **aujourd'hui**. Message à l'analyse : lot 3 |
| 07 — Erreur Supabase | Lecture de `premium_access` en échec | Appel de l'endpoint | Refus, jamais d'accès par défaut | `assertPremium` → 503 `statut_illisible` (tests auto « erreur de base » et « exception réseau ») | NON | Logique serveur : **aujourd'hui (tests)**. Bout en bout : lot 3 |
| 08 — Appel direct non Premium | Compte gratuit authentifié | Appel HTTP direct de l'endpoint | Requête refusée | 403 avant tout appel au modèle | NON | Logique : **aujourd'hui (tests)**. Endpoint : lot 3, avec un test qui compte les appels OpenAI |
| 09 — Premium, appel serveur | Compte Premium authentifié | Appel de l'endpoint avec une photo valide | Analyse réalisée | Accès, puis appel du modèle | OUI | Lot 3 |
| 10 — Mode test désactivé | Build de production (`npm run build`, Vercel, y compris les aperçus) | Ouvrir l'app avec `?simulerPremium=PREMIUM_ACTIVE` | Aucun effet : le statut réel s'applique | — | — | **Aujourd'hui** : test auto `resoudreProfilSimule("production", …) → null` ; build de production du 25/09/2026 inspecté : aucune chaîne de simulation (`simulerPremium`, `PREMIUM_ACTIVE`…) dans `out/` |
