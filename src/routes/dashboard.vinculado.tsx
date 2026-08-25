import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, DollarSign, Package, Activity } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/dashboard/vinculado")({
  component: () => (
    <RequireAuth allow={["motorista_vinculado"]}>
      <VinculadoDashboard />
    </RequireAuth>
  ),
});

function VinculadoDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [viagens, setViagens] = useState<any[]>([]);
  const [aprovadas, setAprovadas] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [vRes, iRes] = await Promise.all([
        (supabase as any).from("viagens").select("*, rotas(obra, material)").eq("motorista_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("interesses_rotas").select("id, rota_id, veiculo_id, status, status_aprovacao_frota")
          .or(`motorista_id.eq.${user.id},motorista_designado_id.eq.${user.id}`)
          .eq("status", "aprovado"),
      ]);
      setViagens(vRes.data ?? []);
      setAprovadas(iRes.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const finalizadas = viagens.filter((v) => v.status === "finalizada");
  const emAndamento = viagens.filter((v) => v.status && v.status !== "finalizada");
  const totalValor = finalizadas.reduce((s, v) => s + Number(v.valor_frete ?? 0), 0);
  const proximasCount = Math.max(0, aprovadas.length - viagens.length);

  if (loading) return (
    <AppShell title="Painel do Motorista Vinculado">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div>
    </AppShell>
  );

  return (
    <AppShell title="Painel do Motorista Vinculado">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi icon={Truck} label="Viagens realizadas" value={finalizadas.length.toString()} />
        <Kpi icon={Activity} label="Em andamento" value={emAndamento.length.toString()} />
        <Kpi icon={Package} label="Próximas" value={proximasCount.toString()} />
        <Kpi icon={DollarSign} label="Total recebido" value={formatBRL(totalValor)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Em andamento</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {emAndamento.length === 0 ? <p className="text-muted-foreground">Nenhuma viagem em andamento.</p> :
              emAndamento.map((v) => (
                <div key={v.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <span>{v.rotas?.obra ?? "—"}</span>
                  <Badge variant="secondary">Em andamento</Badge>
                </div>
              ))}
            <Button asChild size="sm" className="mt-2"><Link to="/viagens">Ver viagens</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Últimas finalizadas</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {finalizadas.slice(0, 5).length === 0 ? <p className="text-muted-foreground">Nenhuma viagem finalizada.</p> :
              finalizadas.slice(0, 5).map((v) => (
                <div key={v.id} className="flex justify-between border-b pb-2 last:border-0">
                  <span>{v.rotas?.obra ?? "—"}</span>
                  <span className="text-accent font-semibold">{formatBRL(Number(v.valor_frete ?? 0))}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Icon className="h-4 w-4" />{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
