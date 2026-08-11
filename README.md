# L'édit Capsela

App mobile-first de garde-robe capsule : « ta capsule, à partir de ce que tu possèdes déjà ».
Stack : Next.js (App Router) + Tailwind + Supabase. Déploiement cible : Vercel.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000) (idéalement en vue mobile dans les devtools).

Sans configuration Supabase, l'app tourne en **mode démo** : compte et profil sont stockés
dans le navigateur (localStorage), les données de dressing sont des données d'exemple.

## Brancher Supabase (comptes réels)

1. Crée un projet sur [supabase.com](https://supabase.com) (gratuit).
2. Dans le dashboard : **SQL Editor** → colle et exécute le contenu de
   `supabase/migrations/0001_profiles.sql`.
3. **Project Settings → API** : copie l'URL du projet et la clé `anon`.
4. Copie `.env.local.example` en `.env.local` et remplis les deux valeurs.
5. Relance `npm run dev`. Inscription e-mail + mot de passe opérationnelle.

Pour « Continuer avec Google » : **Authentication → Providers → Google** dans le dashboard
Supabase (nécessite un client OAuth Google, voir la doc Supabase).

## Structure

- `src/lib/` — état global (`store.tsx`), auth + profil (`auth.tsx`, `profile.ts`,
  `supabase.ts`), données et logique de reco (`data.ts`, `logic.ts`, `selectors.ts`)
- `src/components/screens/` — un fichier par écran
- `supabase/migrations/` — schéma SQL (à exécuter dans Supabase)
- `design-reference/` — prototype Claude Design validé (référence visuelle et transcripts)

## Feuille de route (P0 → Alpha interne)

1. ✅ Compte & profil (genre, taille, style, morphologie, goûts)
2. Dressing — champ saison obligatoire et bloquant
3. Capsule par défaut personnalisée (style, morphologie, météo, genre)
4. Reco du jour · profil puis · dressing (filtre saison avant occasion)
5. Création de looks depuis le dressing
