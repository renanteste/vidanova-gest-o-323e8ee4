import { createFileRoute } from "@tanstack/react-router";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Users, TrendingUp, DollarSign, Box, Calendar, Download, FileText, MapPin } from "lucide-react";
import { formatBRL } from "@/lib/geo";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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
  foto_inicio_url: string | null; lat_inicio: number | null; lng_inicio: number | null;
};
type Veiculo = { id: string; placa: string; modelo: string; capacidade_m3: number; ativa: boolean };
type Driver = { user_id: string; nome: string; ativo: boolean };
type Rota = { id: string; origem_endereco: string; destino_endereco: string; obra: string | null; material: string | null; preco_por_m3: number };

function FrotaDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [rotas, setRotas] = useState<Map<string, Rota>>(new Map());

  // filtros
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("");
  const [filtroMotorista, setFiltroMotorista] = useState("");

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
        const { data: vis } = await (supabase as any)
          .from("viagens")
          .select("id, rota_id, veiculo_id, motorista_id, inicio_em, fim_em, valor_frete, foto_inicio_url, lat_inicio, lng_inicio")
          .in("motorista_id", motIds)
          .order("inicio_em", { ascending: false });
        const vList = (vis as Viagem[]) ?? [];
        setViagens(vList);
        const rotaIds = [...new Set(vList.map((v) => v.rota_id))];
        if (rotaIds.length) {
          const { data: rs } = await supabase
            .from("rotas").select("id, origem_endereco, destino_endereco, obra, material, preco_por_m3").in("id", rotaIds);
          setRotas(new Map(((rs as Rota[]) ?? []).map((r) => [r.id, r])));
        }
      } else {
        setViagens([]);
      }
      setLoading(false);
    })();
  }, [user]);

  const veiculoMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.user_id, d])), [drivers]);

  const getStatus = (v: Viagem) => {
    if (v.fim_em) return "Finalizada";
    if (v.inicio_em && v.foto_inicio_url) return "Em andamento";
    if (v.inicio_em) return "A caminho";
    return "Aguardando";
  };

  const filtradas = useMemo(() => viagens.filter((v) => {
    if (dataIni && new Date(v.inicio_em) < new Date(dataIni)) return false;
    if (dataFim && new Date(v.inicio_em) > new Date(dataFim + "T23:59:59")) return false;
    if (filtroVeiculo && v.veiculo_id !== filtroVeiculo) return false;
    if (filtroMotorista && v.motorista_id !== filtroMotorista) return false;
    return true;
  }), [viagens, dataIni, dataFim, filtroVeiculo, filtroMotorista]);

  // KPIs baseados no filtro
  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const viagensHoje = viagens.filter((v) => new Date(v.inicio_em) >= startToday).length;
  const viagensMes = viagens.filter((v) => new Date(v.inicio_em) >= startMonth);
  const m3Periodo = filtradas.reduce((sum, v) => sum + Number(veiculoMap.get(v.veiculo_id)?.capacidade_m3 ?? 0), 0);
  const faturadoPeriodo = filtradas.reduce((sum, v) => sum + Number(v.valor_frete ?? 0), 0);
  const veiculosAtivos = vehicles.filter((v) => v.ativa).length;
  const motoristasAtivos = drivers.filter((d) => d.ativo).length;

  const exportExcel = () => {
    const rows = filtradas.map((v) => {
      const r = rotas.get(v.rota_id); const ve = veiculoMap.get(v.veiculo_id); const m = driverMap.get(v.motorista_id);
      return {
        Data: new Date(v.inicio_em).toLocaleString("pt-BR"),
        Motorista: m?.nome ?? "—",
        Placa: ve?.placa ?? "—",
        Veiculo: ve?.modelo ?? "—",
        Obra: r?.obra ?? "—",
        Material: r?.material ?? "—",
        Origem: r?.origem_endereco ?? "—",
        Destino: r?.destino_endereco ?? "—",
        Capacidade_m3: ve?.capacidade_m3 ?? "",
        Valor_Frete: v.valor_frete ?? "",
        Status: getStatus(v),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Viagens");
    XLSX.writeFile(wb, `viagens_frota_${Date.now()}.xlsx`);
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Relatório de Viagens - Frota", 40, 30);
    doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, 46);

    const imgs: Record<string, string> = {};
    await Promise.all(filtradas.map(async (v) => {
      if (!v.foto_inicio_url) return;
      try {
        const res = await fetch(v.foto_inicio_url);
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve) => {
          const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.readAsDataURL(blob);
        });
        imgs[v.id] = dataUrl;
      } catch { /* ignore */ }
    }));

    const body = filtradas.map((v) => {
      const r = rotas.get(v.rota_id); const ve = veiculoMap.get(v.veiculo_id); const m = driverMap.get(v.motorista_id);
      return [
        "",
        m?.nome ?? "—",
        `${ve?.placa ?? "—"}\n${ve?.modelo ?? ""}`,
        r?.origem_endereco ?? "—",
        r?.destino_endereco ?? "—",
        new Date(v.inicio_em).toLocaleString("pt-BR"),
        v.valor_frete != null ? formatBRL(Number(v.valor_frete)) : "—",
        getStatus(v),
      ];
    });

    autoTable(doc, {
      head: [["Foto", "Motorista", "Veículo", "Origem", "Destino", "Data", "Frete", "Status"]],
      body,
      startY: 60,
      styles: { fontSize: 8, cellPadding: 3, valign: "middle" },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 0: { cellWidth: 40 }, 3: { cellWidth: 120 }, 4: { cellWidth: 120 } },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const v = filtradas[data.row.index];
          const img = v && imgs[v.id];
          if (img) {
            try { doc.addImage(img, "JPEG", data.cell.x + 2, data.cell.y + 2, 36, 24); } catch { /* ignore */ }
          }
        }
      },
      bodyStyles: { minCellHeight: 30 },
    });
    doc.save(`viagens_frota_${Date.now()}.pdf`);
  };

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
            <Kpi icon={<Box className="h-5 w-5" />} label="m³ (filtrado)" value={m3Periodo.toLocaleString("pt-BR")} />
            <Kpi icon={<DollarSign className="h-5 w-5" />} label="Faturado (filtrado)" value={formatBRL(faturadoPeriodo)} />
            <Kpi icon={<Truck className="h-5 w-5" />} label="Veículos ativos" value={`${veiculosAtivos}/${vehicles.length}`} />
            <Kpi icon={<Users className="h-5 w-5" />} label="Motoristas ativos" value={`${motoristasAtivos}/${drivers.length}`} />
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-4 gap-3">
              <div><Label>De</Label><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} /></div>
              <div><Label>Até</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
              <div>
                <Label>Veículo</Label>
                <select value={filtroVeiculo} onChange={(e) => setFiltroVeiculo(e.target.value)} className="w-full rounded-md border border-gray-200 p-2">
                  <option value="">Todos</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
                </select>
              </div>
              <div>
                <Label>Motorista</Label>
                <select value={filtroMotorista} onChange={(e) => setFiltroMotorista(e.target.value)} className="w-full rounded-md border border-gray-200 p-2">
                  <option value="">Todos</option>
                  {drivers.map((d) => <option key={d.user_id} value={d.user_id}>{d.nome}</option>)}
                </select>
              </div>
              <div className="sm:col-span-4 flex justify-end gap-2">
                <Button onClick={exportExcel} variant="outline"><Download className="h-4 w-4 mr-1" /> Exportar Excel</Button>
                <Button onClick={exportPDF} variant="outline"><FileText className="h-4 w-4 mr-1" /> Exportar PDF</Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {filtradas.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Nenhuma viagem encontrada no período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>GPS</TableHead>
                      <TableHead className="text-right">Frete</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((v) => {
                      const veh = veiculoMap.get(v.veiculo_id);
                      const rota = rotas.get(v.rota_id);
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(v.inicio_em).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{driverMap.get(v.motorista_id)?.nome ?? "—"}</TableCell>
                          <TableCell className="text-xs">{veh?.placa ?? "—"}<br /><span className="text-muted-foreground">{veh?.modelo}</span></TableCell>
                          <TableCell className="max-w-[180px] truncate">{rota?.origem_endereco ?? "—"}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{rota?.destino_endereco ?? "—"}</TableCell>
                          <TableCell>
                            {v.lat_inicio != null && v.lng_inicio != null && (
                              <a className="text-xs text-accent underline inline-flex items-center" target="_blank" rel="noreferrer"
                                 href={`https://www.google.com/maps?q=${v.lat_inicio},${v.lng_inicio}`}>
                                <MapPin className="h-3 w-3 mr-1" />Mapa
                              </a>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{v.valor_frete != null ? formatBRL(Number(v.valor_frete)) : "—"}</TableCell>
                          <TableCell><Badge variant="outline">{getStatus(v)}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-9 w-9 rounded-md bg-accent/10 text-accent grid place-items-center shrink-0">{icon}</span>
          <div className="min-w-0">
            <div className="text-xl font-semibold truncate">{value}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
