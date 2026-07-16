import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Truck, Route as RouteIcon, Package, Download, MapPin, Ban, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/geo";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/dashboard/admin")({
  component: () => (
    <RequireAuth allow={["admin"]}>
      <AdminDashboard />
    </RequireAuth>
  ),
});

type Viagem = {
  id: string; rota_id: string; veiculo_id: string; motorista_id: string;
  inicio_em: string; fim_em: string | null;
  foto_inicio_url: string; foto_fim_url: string | null;
  lat_inicio: number; lng_inicio: number; lat_fim: number | null; lng_fim: number | null;
  valor_frete: number | null;
};

function AdminDashboard() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [rotas, setRotas] = useState<Record<string, any>>({});
  const [veiculos, setVeiculos] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [filtroStatus, setFiltroStatus] = useState(""); // New status filter state
  const [fotoOpen, setFotoOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [v, r, ve, p] = await Promise.all([
      (supabase as any).from("viagens").select("*").order("inicio_em", { ascending: false }),
      (supabase as any).from("rotas").select("*"),
      (supabase as any).from("veiculos").select("*"),
      (supabase as any).from("profiles").select("*"),
    ]);
    setViagens((v.data ?? []) as Viagem[]);
    setRotas(Object.fromEntries((r.data ?? []).map((x: any) => [x.id, x])));
    setVeiculos(Object.fromEntries((ve.data ?? []).map((x: any) => [x.id, x])));
    setProfiles(p.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.user_id, p])), [profiles]);

  const getStatus = (v: Viagem) => {
    if (v.fim_em) return { label: "Finalizada ✅", className: "bg-green-500 text-white" };
    if (v.inicio_em && v.foto_inicio_url) return { label: "Em andamento 🟡", className: "bg-yellow-500 text-white" };
    if (v.inicio_em) return { label: "A caminho 🔵", className: "bg-blue-500 text-white" };
    return { label: "Aguardando ⚪", className: "bg-gray-400 text-white" };
  };

  const filtradas = useMemo(() => viagens.filter((v) => {
    const r = rotas[v.rota_id];
    if (dataIni && new Date(v.inicio_em) < new Date(dataIni)) return false;
    if (dataFim && new Date(v.inicio_em) > new Date(dataFim + "T23:59:59")) return false;
    if (filtroOrigem && !r?.origem_endereco?.toLowerCase().includes(filtroOrigem.toLowerCase())) return false;
    if (filtroDestino && !r?.destino_endereco?.toLowerCase().includes(filtroDestino.toLowerCase())) return false;
    if (filtroMaterial && !r?.material?.toLowerCase().includes(filtroMaterial.toLowerCase())) return false;
    if (filtroStatus && getStatus(v).label !== filtroStatus) return false;
    return true;
  }), [viagens, rotas, dataIni, dataFim, filtroOrigem, filtroDestino, filtroMaterial, filtroStatus]);

  // métricas
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const viagensHoje = viagens.filter((v) => new Date(v.inicio_em) >= hoje).length;
  const viagensMes = viagens.filter((v) => new Date(v.inicio_em) >= inicioMes).length;
  const m3Periodo = filtradas.reduce((s, v) => s + Number(veiculos[v.veiculo_id]?.capacidade_m3 ?? 0), 0);
  const valorPeriodo = filtradas.reduce((s, v) => s + Number(v.valor_frete ?? 0), 0);
  const ranking = useMemo(() => {
    const map = new Map<string, { m3: number; viagens: number }>();
    filtradas.forEach((v) => {
      const cap = Number(veiculos[v.veiculo_id]?.capacidade_m3 ?? 0);
      const cur = map.get(v.motorista_id) ?? { m3: 0, viagens: 0 };
      cur.m3 += cap; cur.viagens += 1; map.set(v.motorista_id, cur);
    });
    return [...map.entries()].map(([uid, x]) => ({ uid, nome: profileMap[uid]?.nome ?? uid.slice(0, 8), ...x }))
      .sort((a, b) => b.m3 - a.m3).slice(0, 5);
  }, [filtradas, veiculos, profileMap]);

  const exportCSV = () => {
    const rows = [
      ["Data início", "Data fim", "Obra", "Material", "Origem", "Destino", "Motorista", "Veículo", "Placa", "Capacidade m³", "Valor frete", "Lat início", "Lng início", "Lat fim", "Lng fim"],
      ...filtradas.map((v) => {
        const r = rotas[v.rota_id] ?? {}; const ve = veiculos[v.veiculo_id] ?? {}; const m = profileMap[v.motorista_id] ?? {};
        return [
          new Date(v.inicio_em).toLocaleString("pt-BR"),
          v.fim_em ? new Date(v.fim_em).toLocaleString("pt-BR") : "",
          r.obra ?? "", r.material ?? "", r.origem_endereco ?? "", r.destino_endereco ?? "",
          m.nome ?? "", ve.modelo ?? "", ve.placa ?? "", ve.capacidade_m3 ?? "",
          v.valor_frete ?? "", v.lat_inicio ?? "", v.lng_inicio ?? "", v.lat_fim ?? "", v.lng_fim ?? "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `viagens_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Relatório de Viagens", 40, 30);
    doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, 46);

    // preload images
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
      const r = rotas[v.rota_id] ?? {}; const ve = veiculos[v.veiculo_id] ?? {};
      return [
        "", // foto slot
        profileMap[v.motorista_id]?.nome ?? "—",
        `${ve.placa ?? "—"}\n${ve.modelo ?? ""}`,
        r.origem_endereco ?? "—",
        r.destino_endereco ?? "—",
        new Date(v.inicio_em).toLocaleString("pt-BR"),
        v.valor_frete != null ? formatBRL(Number(v.valor_frete)) : "—",
        getStatus(v).label,
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
            try {
              doc.addImage(img, "JPEG", data.cell.x + 2, data.cell.y + 2, 36, 24);
            } catch { /* ignore */ }
          }
        }
      },
      bodyStyles: { minCellHeight: 30 },
    });
    doc.save(`viagens_${Date.now()}.pdf`);
  };

  const toggleAtivo = async (uid: string, ativo: boolean) => {
    const { error } = await (supabase as any).from("profiles").update({ ativo: !ativo }).eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success(ativo ? "Usuário bloqueado" : "Usuário ativado");
    load();
  };

  const todosVeiculos = Object.values(veiculos);

  return (
    <AppShell title="Painel do Administrador">
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat icon={<RouteIcon className="h-5 w-5" />} label="Viagens hoje" value={viagensHoje} />
        <Stat icon={<RouteIcon className="h-5 w-5" />} label="Viagens no mês" value={viagensMes} />
        <Stat icon={<Package className="h-5 w-5" />} label="m³ no período filtrado" value={m3Periodo.toLocaleString("pt-BR")} />
        <Stat icon={<Truck className="h-5 w-5" />} label="Valor total filtrado" value={formatBRL(valorPeriodo)} />
      </div>

      <Tabs defaultValue="relatorio">
        <TabsList>
          <TabsTrigger value="relatorio">Relatório de viagens</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="veiculos">Veículos</TabsTrigger>
        </TabsList>

        <TabsContent value="relatorio" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-5 gap-3">
              <div><Label>De</Label><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} /></div>
              <div><Label>Até</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
              <div><Label>Origem</Label><Input value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)} placeholder="Cidade/rua" /></div>
              <div><Label>Destino</Label><Input value={filtroDestino} onChange={(e) => setFiltroDestino(e.target.value)} placeholder="Cidade/rua" /></div>
              <div><Label>Material</Label><Input value={filtroMaterial} onChange={(e) => setFiltroMaterial(e.target.value)} placeholder="Ex: SOLO 2B" /></div>
              <div>
                <Label>Status</Label>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-full rounded-md border border-gray-200 p-2">
                  <option value="">Todos</option>
                  <option value="Finalizada ✅">Finalizada ✅</option>
                  <option value="Em andamento 🟡">Em andamento 🟡</option>
                  <option value="A caminho 🔵">A caminho 🔵</option>
                  <option value="Aguardando ⚪">Aguardando ⚪</option>
                </select>
              </div>
              <div className="sm:col-span-5 flex justify-end">
                <Button onClick={exportCSV} variant="outline"><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {loading ? <p className="text-muted-foreground">Carregando…</p> : filtradas.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Nenhuma viagem encontrada.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Foto</TableHead><TableHead>Início</TableHead><TableHead>Obra</TableHead>
                    <TableHead>Material</TableHead><TableHead>Motorista</TableHead><TableHead>Veículo</TableHead>
                    <TableHead>GPS</TableHead><TableHead className="text-right">Frete</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtradas.map((v) => {
                      const r = rotas[v.rota_id] ?? {}; const ve = veiculos[v.veiculo_id] ?? {};
                      return (
                        <TableRow key={v.id}>
                          <TableCell>
                            {v.foto_inicio_url && (
                              <button onClick={() => setFotoOpen(v.foto_inicio_url)}>
                                <img src={v.foto_inicio_url} alt="início" className="h-12 w-12 object-cover rounded" />
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(v.inicio_em).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{r.obra}</TableCell>
                          <TableCell className="text-xs">{r.material}</TableCell>
                          <TableCell className="text-xs">{profileMap[v.motorista_id]?.nome ?? v.motorista_id.slice(0, 6)}</TableCell>
                          <TableCell className="text-xs">{ve.placa}<br /><span className="text-muted-foreground">{ve.modelo}</span></TableCell>
                          <TableCell>
                            <a className="text-xs text-accent underline inline-flex items-center" target="_blank" rel="noreferrer"
                               href={`https://www.google.com/maps?q=${v.lat_inicio},${v.lng_inicio}`}>
                              <MapPin className="h-3 w-3 mr-1" />Mapa
                            </a>
                          </TableCell>
                          <TableCell className="text-right font-medium">{v.valor_frete ? formatBRL(Number(v.valor_frete)) : "—"}</TableCell>
                          <TableCell><Badge className={getStatus(v).className}>{getStatus(v).label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking">
          <Card>
            <CardHeader><CardTitle className="text-base">Top motoristas (período filtrado)</CardTitle></CardHeader>
            <CardContent>
              {ranking.length === 0 ? <p className="text-muted-foreground">Sem dados.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Motorista</TableHead><TableHead className="text-right">Viagens</TableHead><TableHead className="text-right">m³ transportados</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ranking.map((x, i) => (
                      <TableRow key={x.uid}>
                        <TableCell>{i + 1}</TableCell><TableCell>{x.nome}</TableCell>
                        <TableCell className="text-right">{x.viagens}</TableCell>
                        <TableCell className="text-right font-semibold">{x.m3.toLocaleString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Perfil</TableHead><TableHead>Telefone</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.user_id}>
                      <TableCell>{p.nome}</TableCell>
                      <TableCell><Badge variant="outline">{p.perfil}</Badge></TableCell>
                      <TableCell className="text-xs">{p.telefone ?? "—"}</TableCell>
                      <TableCell>
                        {p.ativo === false ? <Badge variant="destructive">Bloqueado</Badge> : <Badge>Ativo</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => toggleAtivo(p.user_id, p.ativo !== false)}>
                          {p.ativo === false ? <><CheckCircle2 className="h-4 w-4 mr-1" />Ativar</> : <><Ban className="h-4 w-4 mr-1" />Bloquear</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="veiculos">
          <Card>
            <CardContent className="pt-4">
              {veiculosNaoUsados.length === 0 ? <p className="text-muted-foreground">Todos os veículos já participaram de alguma viagem.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Placa</TableHead><TableHead>Modelo</TableHead><TableHead className="text-right">Capacidade</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {veiculosNaoUsados.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.placa}</TableCell><TableCell>{v.modelo}</TableCell>
                        <TableCell className="text-right">{Number(v.capacidade_m3).toLocaleString("pt-BR")} m³</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!fotoOpen} onOpenChange={(o) => !o && setFotoOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Foto da viagem</DialogTitle></DialogHeader>
          {fotoOpen && <img src={fotoOpen} alt="" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5 flex items-center gap-3">
        <span className="h-9 w-9 rounded-md bg-accent/10 text-accent grid place-items-center">{icon}</span>
        <div>
          <div className="text-lg font-semibold">{value}</div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
