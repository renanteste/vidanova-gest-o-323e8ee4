import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Truck, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard/admin")({
  component: () => (
    <RequireAuth allow={["admin"]}>
      <AdminDashboard />
    </RequireAuth>
  ),
});

function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, vehicles: 0, fleets: 0 });

  useEffect(() => {
    (async () => {
      const [p, v, f] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("veiculos").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("perfil", "frota"),
      ]);
      setStats({ users: p.count ?? 0, vehicles: v.count ?? 0, fleets: f.count ?? 0 });
    })();
  }, []);

  return (
    <AppShell title="Painel do Administrador">
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={<Users className="h-5 w-5" />} label="Usuários" value={stats.users} />
        <StatCard icon={<Truck className="h-5 w-5" />} label="Veículos" value={stats.vehicles} />
        <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Frotas" value={stats.fleets} />
      </div>
      <Card>
        <CardHeader><CardTitle>Acesso completo</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Como administrador você pode visualizar todos os usuários e todos os veículos cadastrados na plataforma. Acesse <strong>Todos veículos</strong> no menu.</p>
          <p>Administradores não executam viagens.</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-4">
        <span className="h-10 w-10 rounded-md bg-accent/10 text-accent grid place-items-center">{icon}</span>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
