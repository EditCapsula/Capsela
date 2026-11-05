/*
 * LA TABLE ANGLAISE (05/11/2026, docs/traduction.md) : texte français du code → texte anglais. Classée par écran.
 * Le tutoiement devient « you » ; le ton reste celui de Capsela : chaleureux, sans jugement, jamais de vocabulaire morphologique
 * négatif (interdits en anglais aussi : hide, conceal, camouflage, correct, flaw, slimming, unflattering…).
 */
export const EN: Record<string, string> = {
  // --- Barre du bas (TabBar) ---
  "Aujourd’hui": "Today",
  Dressing: "Wardrobe",
  Capsule: "Capsule",
  Planifier: "Plan",
  Journal: "Journal",

  // --- Préférences : langue ---
  Langue: "Language",
  Français: "French",
  Anglais: "English",
  "Choisir la langue": "Choose the language",
  "L'app redémarre dans la langue choisie.": "The app restarts in the language you choose.",

  // --- Commun ---
  "Un instant…": "One moment…",
  Continuer: "Continue",
  "Se connecter": "Sign in",
  "Se déconnecter": "Sign out",
  "Créer un compte": "Create an account",
  "Créer mon compte": "Create my account",
  "J'ai déjà un compte": "I already have an account",
  "Adresse e-mail": "Email address",
  "E-mail": "Email",
  "Mot de passe": "Password",
  "Date de naissance": "Date of birth",
  "Politique de confidentialité": "Privacy Policy",
  "Retour à la connexion": "Back to sign in",
  "Revenir à la connexion": "Back to sign in",
  compte: "account",
  "mot de passe": "password",

  // --- Accueil (WelcomeScreen) ---
  "La bonne tenue,": "The right outfit,",
  "au bon moment": "at the right moment",
  "Des idées de tenues adaptées à ton style, à la météo et à tes occasions — pensées à partir de ta capsule et de ton dressing.":
    "Outfit ideas suited to your style, the weather and your plans, built from your capsule and your wardrobe.",
  Commencer: "Get started",

  // --- Présentation (OnboardingScreen, ONBOARDING_SLIDES) ---
  Passer: "Skip",
  "Ton style": "Your style",
  "Un dressing": "A wardrobe",
  "qui te ressemble.": "that feels like you.",
  "Découvre des styles, des pièces et des associations qui correspondent à ta personnalité. Capsela imagine des tenues adaptées à tes envies.":
    "Discover styles, pieces and pairings that match your personality. Capsela imagines outfits that suit what you feel like wearing.",
  "Ton dressing": "Your wardrobe",
  "Tout ce que tu as.": "Everything you own.",
  "Tout ce que tu peux porter.": "Everything you can wear.",
  "Ajoute les pièces que tu possèdes et laisse Capsela repérer celles qui vont ensemble. Ton dressing devient une source d’idées, pas une pile de vêtements.":
    "Add the pieces you own and let Capsela spot the ones that go together. Your wardrobe becomes a source of ideas, not a pile of clothes.",
  "Tes tenues": "Your outfits",
  "Chaque matin,": "Every morning,",
  "tu sais quoi porter.": "you know what to wear.",
  "Capsela compose des tenues adaptées à ton style, à la météo et à tes occasions, avec tes pièces et celles qui peuvent compléter ton dressing.":
    "Capsela puts together outfits suited to your style, the weather and your plans, with your pieces and the ones that can complete your wardrobe.",
  "Tes valises": "Your suitcases",
  "Partir devient": "Travelling becomes",
  "plus simple.": "easier.",
  "Indique ta destination, tes dates et ton programme. Capsela sélectionne les pièces à emporter et compose tes tenues pour tout le séjour.":
    "Tell us your destination, your dates and your plans. Capsela picks the pieces to pack and puts together your outfits for the whole trip.",
  Capsela: "Capsela",
  "Ton dressing.": "Your wardrobe.",
  "Ton style.": "Your style.",
  "Ton quotidien.": "Your everyday.",
  "Crée ton compte pour retrouver ton dressing, tes capsules, tes tenues et tes valises au même endroit.":
    "Create your account to keep your wardrobe, capsules, outfits and suitcases in one place.",
  "Six univers de style, femme et homme : Minimaliste, Casual chic, Créatif, Classique chic, Streetwear et Glamour":
    "Six style worlds, women and men: Minimalist, Casual chic, Creative, Classic chic, Streetwear and Glamour",
  Cohérent: "Consistent",
  "Tout s’accorde facilement": "Everything goes together",
  Polyvalent: "Versatile",
  "Des pièces faciles à porter": "Easy pieces to wear",
  Évolutif: "Flexible",
  "Garde, remplace et personnalise": "Keep, swap and make it yours",
  "Exemple de capsule : une penderie de pièces qui vont ensemble": "Sample capsule: a rail of pieces that go together",
  "36 pièces · exemple": "36 pieces · example",
  Blazer: "Blazer",
  "Top rayé": "Striped top",
  Jean: "Jeans",
  Baskets: "Sneakers",
  Sac: "Bag",
  "Exemple de tenue du jour : 22 degrés à Paris, occasion travail, une tenue complète de cinq pièces":
    "Sample outfit of the day: 22 degrees in Paris, work occasion, a complete five-piece outfit",
  "Ton look du jour": "Your look of the day",
  exemple: "example",
  "Travail · Bureau": "Work · Office",
  "Pièces de la tenue": "Pieces in the outfit",
  "Voir le détail": "See details",
  robes: "dresses",
  hauts: "tops",
  bas: "bottoms",
  vestes: "jackets",
  chaussures: "shoes",
  accessoires: "accessories",
  "Exemple de valise : Rhodes, sept jours, 23 degrés, 24 pièces sélectionnées et les tenues du séjour":
    "Sample suitcase: Rhodes, seven days, 23 degrees, 24 selected pieces and the outfits for the trip",
  "1 · Destination": "1 · Destination",
  "7 jours · 23° · exemple": "7 days · 23° · example",
  "2 · Pièces": "2 · Pieces",
  "pièces sélectionnées": "selected pieces",
  "3 · Tenues du séjour": "3 · Outfits for the trip",
  "Jour {n}": "Day {n}",
  "Une tenue pour chaque jour du séjour.": "An outfit for every day of the trip.",
  "Un téléphone affichant Capsela, posé parmi un tissu terracotta, des lunettes et des créoles dorées":
    "A phone showing Capsela, among terracotta fabric, glasses and gold hoop earrings",
  "Écran {i} sur {n}": "Screen {i} of {n}",

  // --- Styles (STYLE_CONFIG, profile.ts) ---
  Minimaliste: "Minimalist",
  "Casual chic": "Casual chic",
  "Classique chic": "Classic chic",
  Romantique: "Romantic",
  Bohème: "Boho",
  Streetwear: "Streetwear",
  Preppy: "Preppy",
  Glamour: "Glamour",
  Créatif: "Creative",
  "Créatif / Artistique": "Creative / Artistic",
  "Élégant / Sophistiqué": "Elegant / Sophisticated",

  // --- Connexion sociale ---
  "Continuer avec Apple": "Continue with Apple",
  "Continuer avec Google": "Continue with Google",
  "ou par e-mail": "or with email",

  // --- Créer un compte (AuthScreen) ---
  "Crée ton": "Create your",
  "Pour recevoir ta tenue du jour et sauvegarder ton dressing, où que tu sois.":
    "To get your outfit of the day and keep your wardrobe, wherever you are.",
  Prénom: "First name",
  "Vérifie ta boîte mail.": "Check your inbox.",
  "On t'a envoyé un lien de confirmation à {email}. Clique dessus, puis reviens te connecter.":
    "We sent a confirmation link to {email}. Click it, then come back to sign in.",
  "En continuant, tu acceptes nos": "By continuing, you accept our",
  Conditions: "Terms",
  "et notre": "and our",
  "Mode démo : aucun serveur configuré, ton compte reste sur cet appareil.":
    "Demo mode: no server configured, your account stays on this device.",
  "Déjà un compte": "Already have an account",

  // --- Se connecter (LoginScreen) ---
  "Cette adresse e-mail ne semble pas complète.": "This email address doesn't look complete.",
  "Mode démo : aucun e-mail ne peut être envoyé.": "Demo mode: no email can be sent.",
  "Trop de demandes — réessaie dans quelques minutes.": "Too many requests. Try again in a few minutes.",
  "Connexion impossible. Vérifie ton réseau et réessaie.": "Can't connect. Check your network and try again.",
  "Vérifie ta boîte mail": "Check your inbox",
  "Si un compte correspond à cette adresse, tu recevras un e-mail pour réinitialiser ton mot de passe.":
    "If an account matches this address, you'll receive an email to reset your password.",
  "Réinitialiser mon": "Reset my",
  "Entre ton adresse e-mail et nous t'enverrons un lien pour créer un nouveau mot de passe.":
    "Enter your email address and we'll send you a link to create a new password.",
  "Recevoir le lien": "Send me the link",
  "Revenir à la création de compte": "Back to account creation",
  "Content de te": "Good to see you",
  revoir: "again",
  "Connecte-toi pour retrouver ton dressing et ta tenue du jour.": "Sign in to find your wardrobe and your outfit of the day.",
  "Mot de passe oublié ?": "Forgot your password?",
  "Pas encore de compte": "No account yet",

  // --- Erreurs de connexion (auth.tsx) ---
  "E-mail ou mot de passe incorrect.": "Incorrect email or password.",
  "Un compte existe déjà avec cet e-mail.": "An account already exists with this email.",
  "Le mot de passe doit contenir au moins 6 caractères.": "Your password must be at least 6 characters long.",
  "Adresse e-mail invalide.": "Invalid email address.",
  "Trop de tentatives — réessaie dans quelques minutes.": "Too many attempts. Try again in a few minutes.",
  "Une erreur est survenue : {message}": "Something went wrong: {message}",

  // --- Date de naissance (DateNaissanceScreen, ageMinimum.ts) ---
  "On ne peut pas créer ton": "We can't create your",
  "Le compte qui venait d'être créé a été supprimé.": "The account that was just created has been deleted.",
  "Revenir à l'accueil": "Back to home",
  "Une dernière": "One last",
  chose: "thing",
  "Pour créer ton compte, indique ta date de naissance. Il faut avoir au moins {n} ans.":
    "To create your account, enter your date of birth. You must be at least {n} years old.",
  "Pourquoi ? Voir notre": "Why? See our",
  "Indique ta date de naissance pour créer ton compte.": "Enter your date of birth to create your account.",
  "Cette date de naissance n'est pas valide.": "This date of birth isn't valid.",
  "Il faut avoir au moins {n} ans pour créer un compte.": "You must be at least {n} years old to create an account.",

  // --- Nouveau mot de passe (NouveauMotDePasseScreen) ---
  "Choisis au moins {n} caractères.": "Choose at least {n} characters.",
  "Les deux mots de passe ne sont pas identiques.": "The two passwords don't match.",
  "Ce lien n'est plus": "This link is no longer",
  valide: "valid",
  "Il a expiré ou a déjà servi. Demande un nouveau lien depuis l'écran de connexion, avec « Mot de passe oublié ? ».":
    "It has expired or has already been used. Request a new link from the sign-in screen, with “Forgot your password?”.",
  "Ton mot de passe a été": "Your password has been",
  "mis à jour": "updated",
  "Tu peux maintenant te connecter avec ton nouveau mot de passe.": "You can now sign in with your new password.",
  Nouveau: "New",
  "Choisis ton nouveau mot de passe : au moins {n} caractères.": "Choose your new password: at least {n} characters.",
  "Nouveau mot de passe": "New password",
  "Confirmer le nouveau mot de passe": "Confirm the new password",
  "Enregistrer mon nouveau mot de passe": "Save my new password",

  // --- Visites guidées (lib/visites.ts, VisiteGuidee.tsx) ---
  Suivant: "Next",
  Retour: "Back",
  "C'est parti": "Let's go",
  "Passer la visite": "Skip the tour",
  "Découvrir Aujourd'hui": "Discover Today",
  "Découvrir ton Dressing": "Discover your Wardrobe",
  "Découvrir ta Capsule": "Discover your Capsule",
  "Ta tenue du jour": "Your outfit of the day",
  "Composée chaque matin avec tes pièces, selon la météo et ton programme. Fais glisser pour voir d'autres idées.":
    "Put together every morning with your pieces, based on the weather and your plans. Swipe to see more ideas.",
  "Envie d'autre chose ?": "Fancy something else?",
  "Demande une autre tenue : elle respecte toujours la météo et ton occasion.":
    "Ask for another outfit: it always fits the weather and your occasion.",
  "Prépare les jours suivants": "Plan the days ahead",
  "Les flèches te montrent la tenue des prochains jours, avec leur météo.": "The arrows show the outfit for the coming days, with their weather.",
  "Ajoute tes pièces": "Add your pieces",
  "Une photo suffit : Capsela reconnaît la catégorie, la couleur de la pièce puis la détoure.":
    "One photo is enough: Capsela recognises the piece's category and colour, then cuts it out.",
  "Retrouve tout, vite": "Find everything, fast",
  "Cherche, filtre par catégorie ou trie ton dressing.": "Search, filter by category or sort your wardrobe.",
  "Ta capsule de saison": "Your seasonal capsule",
  "Touche la saison pour découvrir la capsule d'une autre saison.": "Tap the season to discover the capsule for another season.",
  "Quatre façons de la parcourir": "Four ways to browse it",
  "Compose une tenue, explore les pièces, découvre les pièces clés et les détails de ta capsule.":
    "Put together an outfit, explore the pieces, discover the key pieces and the details of your capsule.",
  "Compose ta tenue": "Put together your outfit",
  "Choisis une catégorie, puis fais défiler ses pièces avec les flèches ou d'un glissement.":
    "Choose a category, then browse its pieces with the arrows or a swipe.",

  // --- Réglages Capsela : Aide & Support (05/11/2026) ---
  "Aide & Support": "Help & Support",
  Tutoriel: "Tutorial",
  "Revoir les visites guidées de l'application.": "Replay the app's guided tours.",
  "Choisis une visite : son écran s'ouvre et elle recommence.": "Choose a tour: its screen opens and it starts again.",
  "Centre d'aide": "Help center",
  "Les réponses aux questions fréquentes.": "Answers to frequently asked questions.",
  "Contacter Capsela": "Contact Capsela",
  "Une question, une remarque ? Écris-nous :": "A question, a comment? Write to us:",
  "Écrire un e-mail": "Write an email",
  "Copier l'adresse": "Copy the address",
  "Adresse copiée": "Address copied",

  // --- Écran de chargement : les astuces (05/11/2026) ---
  "Le savais-tu ?": "Did you know?",
  "Tu peux indiquer tes congés dans les Réglages : pendant ces dates, Capsela met les tenues de travail en pause.":
    "You can add your time off in Settings: during those dates, Capsela pauses work outfits.",
  "Plus tu ajoutes de pièces à ton dressing, plus tes tenues te ressemblent.": "The more pieces you add to your wardrobe, the more your outfits look like you.",
  "Une photo suffit pour ajouter une pièce : Capsela reconnaît sa catégorie et sa couleur, puis la détoure.":
    "One photo is all it takes to add a piece: Capsela recognises its category and colour, then cuts it out.",
  "Les flèches à côté de « Aujourd'hui » te montrent la tenue des jours suivants, avec leur météo.":
    "The arrows next to “Today” show you the outfit for the coming days, with their weather.",
  "Tu pars bientôt ? Capsela prépare ta valise : les pièces à emporter et les looks de ton séjour.":
    "Leaving soon? Capsela packs your suitcase: the pieces to bring and the looks for your trip.",
  "Un dîner, un rendez-vous ? Planifie ta tenue à l'avance : elle suit la météo du jour prévu.":
    "A dinner, a date? Plan your outfit ahead: it follows the weather of the day.",
  "Touche la saison dans Capsule pour découvrir ta capsule d'une autre saison.": "Tap the season in Capsule to discover your capsule for another season.",
  "Envie de revoir une visite guidée ? Retrouve-les dans les Réglages, rubrique Tutoriel.": "Want to replay a guided tour? Find them in Settings, under Tutorial.",
};
