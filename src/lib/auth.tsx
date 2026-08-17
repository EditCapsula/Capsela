"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { DEFAULT_PREFS, EMPTY_PROFILE, type Profile } from "./profile";

const DEMO_KEY = "capsela.demo.auth";
const AUTH_INTENT_KEY = "capsela.authIntent";

/**
 * Signale une intention de création de compte avant de déclencher signInGoogle
 * (le seul point d'entrée Google, exposé uniquement sur l'écran "Créer un
 * compte") — nécessaire pour distinguer nouvel utilisateur / compte existant
 * après un aller-retour OAuth qui démonte et remonte l'app (sessionStorage,
 * contrairement à un state React, survit à ce rechargement dans le même onglet).
 */
export function markSignupIntent() {
  try {
    sessionStorage.setItem(AUTH_INTENT_KEY, "signup");
  } catch {
    // sessionStorage indisponible : au pire l'utilisateur atterrit sur la Homepage
    // au lieu du questionnaire, jamais l'inverse.
  }
}

function readAndClearSignupIntent(): boolean {
  try {
    const v = sessionStorage.getItem(AUTH_INTENT_KEY);
    sessionStorage.removeItem(AUTH_INTENT_KEY);
    return v === "signup";
  } catch {
    return false;
  }
}

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
  saveProfile: (p: Profile) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    displayName: (row.display_name as string) ?? "",
    birthdate: (row.birthdate as string) ?? null,
    gender: (row.gender as Profile["gender"]) ?? null,
    paletteBase: (row.palette_base as string) ?? null,
    paletteNeutres: (row.palette_neutres as string[]) ?? [],
    paletteAccents: (row.palette_accents as string[]) ?? [],
    paletteAffinite: (row.palette_affinite as Profile["paletteAffinite"]) ?? null,
    paletteIntensite: (row.palette_intensite as Profile["paletteIntensite"]) ?? null,
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
    palette_base: p.paletteBase,
    palette_neutres: p.paletteNeutres,
    palette_accents: p.paletteAccents,
    palette_affinite: p.paletteAffinite,
    palette_intensite: p.paletteIntensite,
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

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await getSupabase().from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data ? rowToProfile(data) : EMPTY_PROFILE);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Lecture localStorage après montage uniquement : le rendu serveur n'y a pas accès,
      // et un état initial différent côté client provoquerait un mismatch d'hydratation.
      try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) {
          const demo = JSON.parse(raw) as DemoAuth;
          // eslint-disable-next-line react-hooks/set-state-in-effect
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
        await loadProfile(data.user.id);
        setJustSignedUp(readAndClearSignupIntent());
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await loadProfile(u.id);
        setJustSignedUp(readAndClearSignupIntent());
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
      setJustSignedUp(readAndClearSignupIntent());
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

  const value: AuthContextValue = {
    ready,
    signedIn: Boolean(user || demoUser),
    justSignedUp,
    demoMode: !isSupabaseConfigured,
    email: user?.email ?? demoUser?.email ?? null,
    profile,
    error,
    signUpEmail,
    signInEmail,
    signInGoogle,
    signOut,
    saveProfile,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
