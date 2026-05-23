import { useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth, dashboardPathFor, type Perfil } from "@/lib/auth";

export function RequireAuth({ children, allow }: { children: ReactNode; allow?: Perfil[] }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.navigate({ to: "/login" });
      return;
    }
    if (allow && profile && !allow.includes(profile.perfil)) {
      router.navigate({ to: dashboardPathFor(profile.perfil) });
    }
  }, [user, profile, loading, allow, router]);

  if (loading || !user || !profile) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  }
  if (allow && !allow.includes(profile.perfil)) return null;
  return <>{children}</>;
}
