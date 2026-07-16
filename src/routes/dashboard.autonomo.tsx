import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, DollarSign, Package, Activity } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/dashboard/autonomo")({
  component: () => (
    <RequireAuth allow={["motorista_autonomo"]}>
      <AutonomoDashboard />
    </RequireAuth>
  ),
});

function AutonomoDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [viagens, setViagens] = useState<any[]>([]);
  const [aprovadas, setAprovadas] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [veh, vRes, iRes] = await Promise.all([
        (supabase as any).from("veiculos").select("*").eq("proprietario_id", user.id).maybeSingle(),
        (supabase as any).from("viagens").select("*, rotas(obra, material)").eq("motorista_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("interesses_rotas").select("id, rota_id, status").eq("motorista_id", user.id).eq("status", "aprovado"),
      ]);
      setVehicle(veh.data);
      setViagens(vRes.data ?? []);
      setAprovadas(iRes.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  // filtros
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("");

  const viagensFiltradas = useMemo(() => viagens.filter((v) => {
    const ref = v.inicio_em ?? v.created_at;
    if (dataIni && ref && new Date(ref) < new Date(dataIni)) return false;
    if (dataFim && ref && new Date(ref) > new Date(dataFim + "T23:59:59")) return false;
    if (filtroVeiculo && v.veiculo_id !== filtroVeiculo) return false;
    return true;
  }), [viagens, dataIni, dataFim, filtroVeiculo]);

  const finalizadas = viagensFiltradas.filter((v) => v.status === "finalizada");
  const emAndamento = viagensFiltradas.filter((v) => v.status && v.status !== "finalizada");
  const totalValor = finalizadas.reduce((s, v) => s + Number(v.valor_frete ?? 0), 0);
  const totalM3 = finalizadas.length * Number(vehicle?.capacidade_m3 ?? 0);
  const proximasCount = Math.max(0, aprovadas.length - viagens.length);

  if (loading) return (
    <AppShell title="Painel do Motorista Autônomo">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div>
    </AppShell>
  );

  return (
    <AppShell title="Painel do Motorista Autônomo">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi icon={Truck} label="Viagens realizadas" value={finalizadas.length.toString()} />
        <Kpi icon={Activity} label="Em andamento" value={emAndamento.length.toString()} />
        <Kpi icon={Package} label="m³ transportado" value={totalM3.toLocaleString("pt-BR")} />
        <Kpi icon={DollarSign} label="Total recebido" value={formatBRL(totalValor)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-accent" /> Meu veículo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {vehicle ? (
              <>
                <div><strong>{vehicle.placa}</strong> — {vehicle.modelo}</div>
                <div className="text-muted-foreground">{vehicle.tipo_cacamba} · {Number(vehicle.capacidade_m3).toLocaleString("pt-BR")} m³</div>
                <Button asChild size="sm"><Link to="/veiculos">Ver detalhes</Link></Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">Você ainda não cadastrou seu veículo.</p>
                <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/veiculos">Cadastrar</Link></Button>
              </>
            )}
            <div className="pt-2"><Badge variant="outline">Próximas: {proximasCount}</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Em andamento</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {emAndamento.length === 0 ? <p className="text-muted-foreground">Nenhuma viagem em andamento.</p> :
              emAndamento.map((v) => (
                <div key={v.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <span>{v.rotas?.obra ?? "—"}</span>
                  <Badge variant="secondary">{v.status}</Badge>
                </div>
              ))}
            <Button asChild size="sm" className="mt-2"><Link to="/viagens">Ver viagens</Link></Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Últimas finalizadas</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {finalizadas.slice(0, 5).length === 0 ? <p className="text-muted-foreground">Nenhuma viagem finalizada.</p> :
              finalizadas.slice(0, 5).map((v) => (
                <div key={v.id} className="flex justify-between border-b pb-2 last:border-0">
                  <span>{v.rotas?.obra ?? "—"} <span className="text-muted-foreground text-xs">· {v.rotas?.material}</span></span>
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
