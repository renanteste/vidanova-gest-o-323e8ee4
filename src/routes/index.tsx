import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth, dashboardPathFor } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.navigate({ to: "/login" });
    else if (profile) router.navigate({ to: dashboardPathFor(profile.perfil) });
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen grid place-items-center text-muted-foreground">
      Carregando…
    </div>
  );
}
