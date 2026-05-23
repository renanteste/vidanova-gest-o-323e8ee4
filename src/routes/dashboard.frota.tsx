import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, Users, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard/frota")({
  component: () => (
    <RequireAuth allow={["frota"]}>
      <FrotaDashboard />
    </RequireAuth>
  ),
});

function FrotaDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ vehicles: 0, drivers: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [v, d] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("proprietario_id", user.id),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("fk_frota_id", user.id),
      ]);
      setCounts({ vehicles: v.count ?? 0, drivers: d.count ?? 0 });
    })();
  }, [user]);

  return (
    <AppShell title="Painel da Frota">
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-md bg-accent/10 text-accent grid place-items-center"><Truck className="h-5 w-5" /></span>
              <div>
                <div className="text-2xl font-semibold">{counts.vehicles}</div>
                <div className="text-xs text-muted-foreground uppercase">Veículos</div>
              </div>
            </div>
            <Button asChild size="sm"><Link to="/veiculos"><Plus className="h-4 w-4 mr-1" />Gerenciar</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-md bg-accent/10 text-accent grid place-items-center"><Users className="h-5 w-5" /></span>
              <div>
                <div className="text-2xl font-semibold">{counts.drivers}</div>
                <div className="text-xs text-muted-foreground uppercase">Motoristas vinculados</div>
              </div>
            </div>
            <Button asChild size="sm"><Link to="/motoristas"><Plus className="h-4 w-4 mr-1" />Gerenciar</Link></Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Bem-vindo</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cadastre seus veículos e crie contas para os motoristas que trabalham com sua frota.
        </CardContent>
      </Card>
    </AppShell>
  );
}
