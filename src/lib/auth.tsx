"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { DEFAULT_PREFS, EMPTY_PROFILE, type Profile } from "./profile";

const DEMO_KEY = "capsela.demo.auth";

interface DemoAuth {
  email: string;
  profile: Profile;
}

export interface AuthContextValue {
  /** null pendant le chargement initial de la session. */
  ready: boolean;
  /** Un utilisateur est connecté (réel ou démo). */
  signedIn: boolean;
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
    favoriteColors: (row.favorite_colors as string[]) ?? [],
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
    favorite_colors: p.favoriteColors,
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
      if (data.user) await loadProfile(data.user.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await loadProfile(u.id);
      else setProfile(EMPTY_PROFILE);
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
