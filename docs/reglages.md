# Profil et Réglages Capsela

Mis en place le 05/11/2026 d'après la maquette « Mon profil / Réglages Capsela ». Évolution de l'existant, pas une refonte :
aucune fonctionnalité retirée, aucune donnée ni règle du moteur modifiée.

## Parcours

Avatar de l'en-tête (tout écran principal) → **Mon profil** → engrenage en haut à droite → **Réglages Capsela**. Le retour de
Réglages ramène au Profil ; le retour d'une sous-page ramène à Réglages. Réglages n'est pas dans la barre du bas.

## Un emplacement de référence par information

| Information | Emplacement de référence | Raccourcis qui y mènent |
| --- | --- | --- |
| Identité : prénom, date de naissance, photo | Profil, carte d'identité | — |
| Profil stylistique, tailles | Profil | — |
| Abonnement | Profil, carte « Mon abonnement » (écran Premium) | — (pas de ligne dans Réglages) |
| Notifications | Réglages → Notifications | — |
| Jours travaillés, congés | Réglages → Mon quotidien | — |
| Ville, géolocalisation, météo de la position | Réglages → Météo et localisation | ligne météo de l'Accueil et de Tenue ; « Mon lieu et ma météo » du Profil (consultation) |
| Langue, unités, réinitialisation | Réglages → Préférences de l'application | — |
| E-mail, mot de passe | Réglages → Compte et sécurité | « Gérer mon compte » du Profil |
| Statistiques, choix publicitaires, téléchargement des données, légal, suppression du compte | Réglages → Confidentialité et données | — |
| Visites guidées, FAQ, contact | Réglages → Aide & Support | — |
| Déconnexion | Réglages, bas de page | — |

Une sous-page ouverte par un raccourci (ligne météo, « Gérer mon compte ») ramène à l'écran d'où elle a été ouverte.

## Fichiers

- `src/components/screens/ProfileScreen.tsx` — Mon profil.
- `src/components/screens/PreferencesScreen.tsx` — Réglages Capsela et ses sous-pages (Notifications, Mon quotidien, Météo et
  localisation, Centre d'aide) ; feuilles Langue, Unités, Tutoriel, Contacter Capsela.
- `src/components/ReglagesCompte.tsx` — sous-pages Compte et sécurité, Confidentialité et données (ex-`AccountScreen`).
- `src/lib/store.tsx` — `goPreferences(section?)`, `closePreferences`, `goAccount` ; `state.preferencesSection` (sous-page
  ouverte), `state.preferencesDirect` (ouverte par un raccourci).
- `src/lib/unites.ts` — l'affichage des températures en °C ou °F.
- `src/lib/centreAide.ts` — le contenu du Centre d'aide.

## Ce qui n'existe pas, et n'est donc pas affiché

- **Affichage** (thème, taille du texte) : aucun réglage dans l'app.
- **Unités du corps** : aucune mesure n'est affichée en centimètres (les tailles sont des tailles). Les **Unités** ne règlent que
  les températures, partout où elles s'affichent ; la météo reçue, le moteur et ce qui est enregistré restent en °C.
- **Centre d'aide** : aucune FAQ n'existait. Le contenu de `centreAide.ts`, rédigé d'après le code, a été validé par la
  propriétaire le 05/11/2026 (`CENTRE_AIDE_VALIDE = true`). La réponse sur « Autre tenue » lit `GENERATIONS_GRATUITES_PAR_JOUR`.
- **Délai de réponse du support** (« sous 48 h » sur la maquette) : aucun engagement n'est pris, rien n'est promis.
