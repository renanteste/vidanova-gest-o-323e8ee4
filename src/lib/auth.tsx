import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Perfil = "admin" | "frota" | "motorista_autonomo" | "motorista_vinculado";

export interface ProfileData {
  user_id: string;
  perfil: Perfil;
  nome: string;
  telefone: string | null;
  cnh: string | null;
  fk_frota_id: string | null;
  veiculo_id: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: ProfileData | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (data && (data as any).ativo === false) {
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setProfile((data as ProfileData) ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { loadProfile(s.user.id); }, 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <Ctx.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function dashboardPathFor(perfil: Perfil): string {
  switch (perfil) {
    case "admin": return "/dashboard/admin";
    case "frota": return "/dashboard/frota";
    case "motorista_autonomo": return "/dashboard/autonomo";
    case "motorista_vinculado": return "/dashboard/vinculado";
  }
}

export const perfilLabel: Record<Perfil, string> = {
  admin: "Administrador",
  frota: "Dono de Frota",
  motorista_autonomo: "Motorista Autônomo",
  motorista_vinculado: "Motorista Vinculado",
};
