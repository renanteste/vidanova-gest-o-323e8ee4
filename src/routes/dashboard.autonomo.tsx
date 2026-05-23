import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/dashboard/autonomo")({
  component: () => (
    <RequireAuth allow={["motorista_autonomo"]}>
      <AutonomoDashboard />
    </RequireAuth>
  ),
});

function AutonomoDashboard() {
  const { user } = useAuth();
  const [hasVehicle, setHasVehicle] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("veiculos").select("id").eq("proprietario_id", user.id).maybeSingle()
      .then(({ data }) => setHasVehicle(!!data));
  }, [user]);

  return (
    <AppShell title="Painel do Motorista Autônomo">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-accent" /> Meu veículo</CardTitle>
        </CardHeader>
        <CardContent>
          {hasVehicle ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Seu veículo já está cadastrado.</p>
              <Button asChild><Link to="/veiculos">Ver detalhes</Link></Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Você ainda não cadastrou seu veículo. Como motorista autônomo você pode cadastrar 1 veículo.</p>
              <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/veiculos">Cadastrar veículo</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
