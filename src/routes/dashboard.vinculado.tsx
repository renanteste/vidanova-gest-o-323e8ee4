import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/dashboard/vinculado")({
  component: () => (
    <RequireAuth allow={["motorista_vinculado"]}>
      <VinculadoDashboard />
    </RequireAuth>
  ),
});

function VinculadoDashboard() {
  return (
    <AppShell title="Painel do Motorista Vinculado">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-accent" /> Veículos da frota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você pertence a uma frota. Você não cadastra veículos — apenas seleciona um veículo da frota ao iniciar uma rota.
          </p>
          <Button asChild><Link to="/veiculos">Ver veículos disponíveis</Link></Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
