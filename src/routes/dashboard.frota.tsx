import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Users, Plus, TrendingUp, DollarSign, Box, Calendar } from "lucide-react";
import { formatBRL } from "@/lib/geo";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/dashboard/frota")({
  component: () => (
    <RequireAuth allow={["frota"]}>
      <FrotaDashboard />
    </RequireAuth>
  ),
});

type Viagem = {
  id: string; rota_id: string; veiculo_id: string; motorista_id: string;
  inicio_em: string; fim_em: string | null; valor_frete: number | null;
};
type Veiculo = { id: string; placa: string; modelo: string; capacidade_m3: number; ativa: boolean };
type Driver = { user_id: string; nome: string; ativo: boolean };
type Rota = { id: string; origem_endereco: string; destino_endereco: string; preco_por_m3: number };

function FrotaDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [rotas, setRotas] = useState<Map<string, Rota>>(new Map());

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [vRes, dRes] = await Promise.all([
        supabase.from("veiculos").select("id, placa, modelo, capacidade_m3, ativa").eq("proprietario_id", user.id),
        supabase.from("profiles").select("user_id, nome, ativo").eq("fk_frota_id", user.id),
      ]);
      const vs = (vRes.data as Veiculo[]) ?? [];
      const ds = (dRes.data as Driver[]) ?? [];
      setVehicles(vs);
      setDrivers(ds);

      const motIds = ds.map((d) => d.user_id);
      if (motIds.length > 0) {
        const { data: vis } = await supabase
          .from("viagens")
          .select("id, rota_id, veiculo_id, motorista_id, inicio_em, fim_em, valor_frete")
          .in("motorista_id", motIds)
          .order("inicio_em", { ascending: false });
        const vList = (vis as Viagem[]) ?? [];
        setViagens(vList);
        const rotaIds = [...new Set(vList.map((v) => v.rota_id))];
        if (rotaIds.length) {
          const { data: rs } = await supabase
            .from("rotas").select("id, origem_endereco, destino_endereco, preco_por_m3").in("id", rotaIds);
          setRotas(new Map(((rs as Rota[]) ?? []).map((r) => [r.id, r])));
        }
      } else {
        setViagens([]);
      }
      setLoading(false);
    })();
  }, [user]);

  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);

  const viagensHoje = viagens.filter((v) => new Date(v.inicio_em) >= startToday).length;
  const viagensMes = viagens.filter((v) => new Date(v.inicio_em) >= startMonth);
  const veiculoMap = new Map(vehicles.map((v) => [v.id, v]));
  const m3Mes = viagensMes.reduce((sum, v) => sum + Number(veiculoMap.get(v.veiculo_id)?.capacidade_m3 ?? 0), 0);
  const faturadoMes = viagensMes.reduce((sum, v) => sum + Number(v.valor_frete ?? 0), 0);
  const veiculosAtivos = vehicles.filter((v) => v.ativa).length;
  const motoristasAtivos = drivers.filter((d) => d.ativo).length;

  // Gráfico últimos 7 dias
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const count = viagens.filter((v) => {
      const t = new Date(v.inicio_em);
      return t >= d && t < next;
    }).length;
    return { dia: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), viagens: count };
  });

  // Rankings
  const motCounts = new Map<string, { count: number; m3: number }>();
  const vehCounts = new Map<string, { count: number; m3: number }>();
  viagens.forEach((v) => {
    const cap = Number(veiculoMap.get(v.veiculo_id)?.capacidade_m3 ?? 0);
    const m = motCounts.get(v.motorista_id) ?? { count: 0, m3: 0 };
    motCounts.set(v.motorista_id, { count: m.count + 1, m3: m.m3 + cap });
    const ve = vehCounts.get(v.veiculo_id) ?? { count: 0, m3: 0 };
    vehCounts.set(v.veiculo_id, { count: ve.count + 1, m3: ve.m3 + cap });
  });
  const driverMap = new Map(drivers.map((d) => [d.user_id, d]));
  const topMotoristas = [...motCounts.entries()]
    .sort((a, b) => b[1].m3 - a[1].m3)
    .slice(0, 3)
    .map(([id, s]) => ({ nome: driverMap.get(id)?.nome ?? "—", ...s }));
  const topVeiculos = [...vehCounts.entries()]
    .sort((a, b) => b[1].m3 - a[1].m3)
    .slice(0, 3)
    .map(([id, s]) => ({ placa: veiculoMap.get(id)?.placa ?? "—", modelo: veiculoMap.get(id)?.modelo ?? "—", ...s }));

  // Veículos sem uso últimos 7 dias
  const usedIds7d = new Set(viagens.filter((v) => new Date(v.inicio_em) >= sevenDaysAgo).map((v) => v.veiculo_id));
  const veiculosSemUso = vehicles.filter((v) => !usedIds7d.has(v.id)).map((v) => ({
    ...v,
    ultimoUso: viagens.find((vi) => vi.veiculo_id === v.id)?.inicio_em ?? null,
  }));

  // Motoristas inativos (sem viagem últimos 7d ou flag ativo=false)
  const usedDriverIds7d = new Set(viagens.filter((v) => new Date(v.inicio_em) >= sevenDaysAgo).map((v) => v.motorista_id));
  const motoristasInativos = drivers.filter((d) => !usedDriverIds7d.has(d.user_id) || !d.ativo).map((d) => ({
    ...d,
    ultimaViagem: viagens.find((v) => v.motorista_id === d.user_id)?.inicio_em ?? null,
  }));

  const recent = viagens.slice(0, 10);

  return (
    <AppShell title="Painel da Frota">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi icon={<Calendar className="h-5 w-5" />} label="Viagens hoje" value={String(viagensHoje)} />
            <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Viagens no mês" value={String(viagensMes.length)} />
            <Kpi icon={<Box className="h-5 w-5" />} label="m³ transportados (mês)" value={m3Mes.toLocaleString("pt-BR")} />
            <Kpi icon={<DollarSign className="h-5 w-5" />} label="Faturado (mês)" value={formatBRL(faturadoMes)} />
            <Kpi icon={<Truck className="h-5 w-5" />} label="Veículos ativos" value={`${veiculosAtivos}/${vehicles.length}`} action={<Link to="/veiculos" className="text-xs text-accent underline">gerenciar</Link>} />
            <Kpi icon={<Users className="h-5 w-5" />} label="Motoristas ativos" value={`${motoristasAtivos}/${drivers.length}`} action={<Link to="/motoristas" className="text-xs text-accent underline">gerenciar</Link>} />
          </div>

          {/* Gráfico */}
          <Card>
            <CardHeader><CardTitle className="text-base">Viagens últimos 7 dias</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dia" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="viagens" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Rankings */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 3 motoristas</CardTitle></CardHeader>
              <CardContent>
                {topMotoristas.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                  <ol className="space-y-2">
                    {topMotoristas.map((m, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span><strong>{i + 1}.</strong> {m.nome}</span>
                        <span className="text-muted-foreground">{m.count} viagens · {m.m3.toLocaleString("pt-BR")} m³</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Top 3 veículos</CardTitle></CardHeader>
              <CardContent>
                {topVeiculos.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
                  <ol className="space-y-2">
                    {topVeiculos.map((v, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span><strong>{i + 1}.</strong> {v.placa} <span className="text-muted-foreground">— {v.modelo}</span></span>
                        <span className="text-muted-foreground">{v.count} viagens · {v.m3.toLocaleString("pt-BR")} m³</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Viagens recentes */}
          <Card>
            <CardHeader><CardTitle className="text-base">Viagens recentes</CardTitle></CardHeader>
            <CardContent>
              {recent.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma viagem ainda.</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((v) => {
                      const veh = veiculoMap.get(v.veiculo_id);
                      const rota = rotas.get(v.rota_id);
                      return (
                        <TableRow key={v.id}>
                          <TableCell>{driverMap.get(v.motorista_id)?.nome ?? "—"}</TableCell>
                          <TableCell className="text-xs">{veh?.placa ?? "—"}<br /><span className="text-muted-foreground">{veh?.modelo}</span></TableCell>
                          <TableCell className="max-w-[180px] truncate">{rota?.origem_endereco ?? "—"}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{rota?.destino_endereco ?? "—"}</TableCell>
                          <TableCell className="text-right">{v.valor_frete != null ? formatBRL(Number(v.valor_frete)) : "—"}</TableCell>
                          <TableCell className="text-xs">{new Date(v.inicio_em).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Veículos sem uso + motoristas inativos */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Veículos sem uso (7 dias)
                  <Button asChild size="sm" variant="outline"><Link to="/veiculos"><Plus className="h-4 w-4 mr-1" />Veículos</Link></Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {veiculosSemUso.length === 0 ? <p className="text-sm text-muted-foreground">Todos em uso.</p> : (
                  <ul className="text-sm divide-y">
                    {veiculosSemUso.map((v) => (
                      <li key={v.id} className="py-2 flex justify-between">
                        <span><strong>{v.placa}</strong> <span className="text-muted-foreground">— {v.modelo}</span></span>
                        <span className="text-xs text-muted-foreground">{v.ultimoUso ? `último: ${new Date(v.ultimoUso).toLocaleDateString("pt-BR")}` : "nunca usado"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Motoristas inativos
                  <Button asChild size="sm" variant="outline"><Link to="/motoristas"><Plus className="h-4 w-4 mr-1" />Motoristas</Link></Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {motoristasInativos.length === 0 ? <p className="text-sm text-muted-foreground">Todos ativos.</p> : (
                  <ul className="text-sm divide-y">
                    {motoristasInativos.map((d) => (
                      <li key={d.user_id} className="py-2 flex justify-between">
                        <span>{d.nome} {!d.ativo && <span className="text-xs text-destructive">(bloqueado)</span>}</span>
                        <span className="text-xs text-muted-foreground">{d.ultimaViagem ? `última: ${new Date(d.ultimaViagem).toLocaleDateString("pt-BR")}` : "sem viagens"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ icon, label, value, action }: { icon: React.ReactNode; label: string; value: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-9 w-9 rounded-md bg-accent/10 text-accent grid place-items-center shrink-0">{icon}</span>
            <div className="min-w-0">
              <div className="text-xl font-semibold truncate">{value}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
            </div>
          </div>
          {action}
        </div>
      </CardContent>
    </Card>
  );
}
