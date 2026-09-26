"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { COLORIMETRIE_VIDE, type Colorimetrie } from "./colorimetrie";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { DEFAULT_PREFS, EMPTY_PROFILE, type Profile } from "./profile";
import { consumeSignupIntent, forgetSignupIntent } from "./signupIntent";
import { lireRetourLien, messageErreurNouveauMotDePasse, PARAM_RECUPERATION } from "./motDePasse";

const DEMO_KEY = "capsela.demo.auth";

export { markSignupIntent } from "./signupIntent";

interface DemoAuth {
  email: string;
  profile: Profile;
}

export interface AuthContextValue {
  /** null pendant le chargement initial de la session. */
  ready: boolean;
  /** Un utilisateur est connecté (réel ou démo). */
  signedIn: boolean;
  /**
   * true uniquement pour la connexion Google qui vient de créer le compte
   * (intention posée par markSignupIntent avant l'appel) — seul signal fiable
   * de "nouvel utilisateur" pour ce point d'entrée, distinct d'une simple
   * connexion ou d'une session restaurée au chargement. La création de compte
   * par e-mail navigue directement vers le questionnaire sans passer par ce
   * flag (cf. AuthScreen.submitEmail).
   */
  justSignedUp: boolean;
  /** Mode démo : pas de credentials Supabase configurés. */
  demoMode: boolean;
  email: string | null;
  /** Id Supabase Auth réel — null en mode démo (pas d'utilisateur Supabase) ou tant qu'aucune session n'est chargée. */
  userId: string | null;
  profile: Profile;
  error: string | null;
  signUpEmail: (
    name: string,
    email: string,
    password: string,
    birthdate?: string
  ) => Promise<"ok" | "confirm_email" | "error">;
  signInEmail: (email: string, password: string) => Promise<boolean>;
  signInGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Supprime définitivement le compte (Edge Function delete-account, cf. son en-tête) et déconnecte. Renvoie false + error rempli en cas d'échec — jamais de déconnexion locale silencieuse si la suppression serveur a échoué. */
  deleteAccount: () => Promise<boolean>;
  saveProfile: (p: Profile) => Promise<void>;
  clearError: () => void;
  /**
   * RÉINITIALISATION DU MOT DE PASSE (recette du 26/09/2026, cf. motDePasse.ts).
   * `recuperation` : "active" quand l'app s'ouvre depuis le lien de l'e-mail
   * (session de récupération ouverte par Supabase), "lien_invalide" quand le
   * lien a expiré ou a déjà servi.
   */
  recuperation: "aucune" | "active" | "lien_invalide";
  /** Envoie le lien de réinitialisation. Ne dit JAMAIS si l'adresse a un compte : "envoye" dans les deux cas. */
  demanderLienReinitialisation: (email: string) => Promise<"envoye" | "demo" | "trop_de_tentatives" | "erreur_reseau">;
  /** Enregistre le nouveau mot de passe dans la session de récupération ; null si réussi, sinon le message à afficher. */
  enregistrerNouveauMotDePasse: (motDePasse: string) => Promise<string | null>;
  /** Referme le parcours de récupération (URL nettoyée, session de récupération fermée si `deconnecter`). */
  terminerRecuperation: (deconnecter: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    displayName: (row.display_name as string) ?? "",
    birthdate: (row.birthdate as string) ?? null,
    gender: (row.gender as Profile["gender"]) ?? null,
    paletteCouleurs: (row.palette_couleurs as string[]) ?? [],
    paletteAffinite: (row.palette_affinite as Profile["paletteAffinite"]) ?? null,
    paletteIntensite: (row.palette_intensite as Profile["paletteIntensite"]) ?? null,
    // jsonb : la colonne a un défaut `{"statut":"aucune"}`, mais une ligne
    // antérieure à la migration 0034 peut rendre null. Le repli n'est pas une
    // précaution de style, c'est le cas de toutes les lignes existantes.
    colorimetrie: (row.colorimetrie as Colorimetrie) ?? COLORIMETRIE_VIDE,
    tailleHaut: (row.taille_haut as string) ?? null,
    tailleBas: (row.taille_bas as string) ?? null,
    pointure: (row.pointure as string) ?? null,
    styles: (row.styles as string[]) ?? [],
    morphology: (row.morphology as string) ?? null,
    city: (row.city as string) || "Paris",
    completed: Boolean(row.completed),
    prefs: { ...DEFAULT_PREFS, ...((row.prefs as object) ?? {}) },
  };
}

function profileToRow(p: Profile) {
  return {
    display_name: p.displayName,
    birthdate: p.birthdate,
    gender: p.gender,
    palette_couleurs: p.paletteCouleurs,
    // `palette_affinite` n'est PLUS ÉCRITE (25/09/2026) : l'étape qui la
    // renseignait est retirée de l'onboarding. La colonne reste, et reste
    // lue, pour ne pas effacer ce que des profils ont déjà déclaré — mais la
    // réécrire à chaque sauvegarde la remettrait à null pour tout le monde.
    palette_intensite: p.paletteIntensite,
    colorimetrie: p.colorimetrie,
    taille_haut: p.tailleHaut,
    taille_bas: p.tailleBas,
    pointure: p.pointure,
    styles: p.styles,
    morphology: p.morphology,
    city: p.city,
    completed: p.completed,
    prefs: p.prefs,
  };
}

function frenchAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("already registered")) return "Un compte existe déjà avec cet e-mail.";
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("valid email")) return "Adresse e-mail invalide.";
  if (m.includes("rate limit")) return "Trop de tentatives — réessaie dans quelques minutes.";
  return "Une erreur est survenue : " + message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [demoUser, setDemoUser] = useState<DemoAuth | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [recuperation, setRecuperation] = useState<AuthContextValue["recuperation"]>("aucune");

  const loadProfile = useCallback(async (authUser: User) => {
    const { data } = await getSupabase().from("profiles").select("*").eq("id", authUser.id).maybeSingle();
    const loaded = data ? rowToProfile(data) : EMPTY_PROFILE;
    // Repli sur les métadonnées Supabase Auth (correctif 20/08/2026) — nom et
    // date de naissance saisis à l'inscription (signUpEmail) ne sont écrits
    // que dans user_metadata, jamais dans la table profiles (aucune ligne n'y
    // est créée avant le premier saveProfile, typiquement à la fin du
    // questionnaire) : sans ce repli, ces deux infos étaient silencieusement
    // perdues — jamais reportées sur le profil que l'app affiche/enregistre.
    // Connexion Google (correctif 24/08/2026, signalé : prénom jamais
    // demandé) — Supabase n'écrit rien dans display_name pour ce provider,
    // le prénom arrive dans given_name/full_name/name (selon ce que le
    // compte Google partage) ; à défaut, l'étape "prenom" de l'onboarding
    // (ProfileSetupScreen) prend le relais plutôt que de laisser le champ vide.
    const meta = authUser.user_metadata as
      | { display_name?: string; birthdate?: string; given_name?: string; full_name?: string; name?: string }
      | undefined;
    const metaFirstName = meta?.given_name || meta?.full_name?.split(" ")[0] || meta?.name?.split(" ")[0];
    setProfile({
      ...loaded,
      displayName: loaded.displayName || meta?.display_name || metaFirstName || "",
      birthdate: loaded.birthdate || meta?.birthdate || null,
    });
  }, []);

  useEffect(() => {
    // Retour du lien de l'e-mail : lu dans l'URL AVANT tout, pour ne pas
    // dépendre du seul événement PASSWORD_RECOVERY, qui peut partir avant
    // que l'abonnement ci-dessous soit posé.
    const retour = lireRetourLien(window.location.href);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (retour === "recuperation") setRecuperation("active");
    else if (retour === "lien_invalide") setRecuperation("lien_invalide");

    if (!isSupabaseConfigured) {
      // Lecture localStorage après montage uniquement : le rendu serveur n'y a pas accès,
      // et un état initial différent côté client provoquerait un mismatch d'hydratation.
      try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) {
          const demo = JSON.parse(raw) as DemoAuth;
          setDemoUser(demo);
          setProfile(demo.profile ?? EMPTY_PROFILE);
        }
      } catch {
        // stockage local illisible : repart déconnecté
      }
      setReady(true);
      return;
    }

    const supabase = getSupabase();
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        await loadProfile(data.user);
        setJustSignedUp(consumeSignupIntent());
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecuperation("active");
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await loadProfile(u);
        setJustSignedUp(consumeSignupIntent());
      } else {
        setProfile(EMPTY_PROFILE);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const persistDemo = (demo: DemoAuth | null) => {
    setDemoUser(demo);
    if (demo) localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    else localStorage.removeItem(DEMO_KEY);
  };

  /** Relit le compte démo stocké (survit à une déconnexion) pour le restaurer à la reconnexion. */
  const readStoredDemo = (): DemoAuth | null => {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      return raw ? (JSON.parse(raw) as DemoAuth) : null;
    } catch {
      return null;
    }
  };

  const signUpEmail = async (
    name: string,
    email: string,
    password: string,
    birthdate?: string
  ): Promise<"ok" | "confirm_email" | "error"> => {
    setError(null);
    const fresh = { ...EMPTY_PROFILE, displayName: name, birthdate: birthdate || null };
    if (!isSupabaseConfigured) {
      persistDemo({ email, profile: fresh });
      setProfile(fresh);
      return "ok";
    }
    const { data, error: err } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { display_name: name, birthdate: birthdate || null } },
    });
    if (err) {
      setError(frenchAuthError(err.message));
      return "error";
    }
    // Session absente = le projet Supabase exige la confirmation par e-mail.
    return data.session ? "ok" : "confirm_email";
  };

  const signInEmail = async (email: string, password: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const stored = readStoredDemo();
      const restored: DemoAuth = stored && stored.email === email ? stored : { email, profile: EMPTY_PROFILE };
      persistDemo(restored);
      setProfile(restored.profile);
      return true;
    }
    const { error: err } = await getSupabase().auth.signInWithPassword({ email, password });
    if (err) {
      setError(frenchAuthError(err.message));
      return false;
    }
    return true;
  };

  const signInGoogle = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      const email = "demo@capsela.app";
      const stored = readStoredDemo();
      const restored: DemoAuth = stored && stored.email === email ? stored : { email, profile: EMPTY_PROFILE };
      persistDemo(restored);
      setProfile(restored.profile);
      setJustSignedUp(consumeSignupIntent());
      return true;
    }
    const { error: err } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      setError(frenchAuthError(err.message));
      return false;
    }
    // Redirection OAuth : la session reviendra via onAuthStateChange.
    return false;
  };

  const signOut = async () => {
    forgetSignupIntent();
    setJustSignedUp(false);
    if (!isSupabaseConfigured) {
      // Termine la session locale sans effacer le compte/profil stocké : une
      // reconnexion avec le même e-mail doit retrouver son dressing.
      setDemoUser(null);
      setProfile(EMPTY_PROFILE);
      return;
    }
    await getSupabase().auth.signOut();
  };

  const deleteAccount = async (): Promise<boolean> => {
    setError(null);
    if (!isSupabaseConfigured) {
      // Mode démo : pas de compte serveur réel — efface le profil démo
      // stocké localement (persistDemo(null), contrairement à signOut qui le
      // conserve pour permettre une reconnexion avec le même e-mail).
      persistDemo(null);
      setJustSignedUp(false);
      setProfile(EMPTY_PROFILE);
      return true;
    }
    if (!user) return false;
    try {
      const { error: err } = await getSupabase().functions.invoke("delete-account");
      if (err) {
        setError("Impossible de supprimer le compte : " + err.message);
        return false;
      }
      // Nettoyage local best-effort — le compte est déjà supprimé côté
      // serveur à ce stade, cet appel échouerait silencieusement sans
      // conséquence si le token est déjà invalidé.
      await getSupabase().auth.signOut();
      return true;
    } catch (e) {
      setError("Impossible de supprimer le compte : " + (e instanceof Error ? e.message : "erreur inconnue"));
      return false;
    }
  };

  const saveProfile = async (p: Profile) => {
    setProfile(p);
    if (!isSupabaseConfigured) {
      if (demoUser) persistDemo({ ...demoUser, profile: p });
      return;
    }
    if (!user) return;
    const { error: err } = await getSupabase()
      .from("profiles")
      .upsert({ id: user.id, ...profileToRow(p) });
    if (err) setError("Impossible d'enregistrer le profil : " + err.message);
  };

  const demanderLienReinitialisation: AuthContextValue["demanderLienReinitialisation"] = async (adresse) => {
    // Mode démo : aucun service d'e-mail. Le dire plutôt que prétendre avoir envoyé.
    if (!isSupabaseConfigured) return "demo";
    try {
      const { error: err } = await getSupabase().auth.resetPasswordForEmail(adresse.trim(), {
        redirectTo: `${window.location.origin}/?${PARAM_RECUPERATION}=1`,
      });
      if (!err) return "envoye";
      const m = err.message.toLowerCase();
      if (m.includes("rate limit") || err.status === 429) return "trop_de_tentatives";
      if (m.includes("fetch") || m.includes("network")) return "erreur_reseau";
      // Toute autre réponse (adresse inconnue comprise) : même issue qu'un
      // envoi réussi — ne jamais révéler si un compte existe.
      return "envoye";
    } catch {
      return "erreur_reseau";
    }
  };

  const enregistrerNouveauMotDePasse: AuthContextValue["enregistrerNouveauMotDePasse"] = async (motDePasse) => {
    if (!isSupabaseConfigured) return "Mode démo : aucun mot de passe n'est enregistré.";
    try {
      const { error: err } = await getSupabase().auth.updateUser({ password: motDePasse });
      return err ? messageErreurNouveauMotDePasse(err.message) : null;
    } catch (e) {
      return messageErreurNouveauMotDePasse(e instanceof Error ? e.message : "network");
    }
  };

  const terminerRecuperation: AuthContextValue["terminerRecuperation"] = async (deconnecter) => {
    setRecuperation("aucune");
    // L'URL garde le marqueur et le code : les retirer évite qu'un
    // rechargement rouvre le parcours.
    window.history.replaceState(null, "", window.location.pathname);
    if (deconnecter && isSupabaseConfigured) await getSupabase().auth.signOut();
  };

  const value: AuthContextValue = {
    ready,
    signedIn: Boolean(user || demoUser),
    justSignedUp,
    demoMode: !isSupabaseConfigured,
    email: user?.email ?? demoUser?.email ?? null,
    userId: user?.id ?? null,
    profile,
    error,
    signUpEmail,
    signInEmail,
    signInGoogle,
    signOut,
    deleteAccount,
    saveProfile,
    clearError: () => setError(null),
    recuperation,
    demanderLienReinitialisation,
    enregistrerNouveauMotDePasse,
    terminerRecuperation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
