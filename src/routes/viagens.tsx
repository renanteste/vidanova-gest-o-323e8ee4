import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, MapPin, Play, Square, Truck } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/viagens")({
  component: () => (
    <RequireAuth allow={["motorista_autonomo", "motorista_vinculado"]}>
      <ViagensPage />
    </RequireAuth>
  ),
});

type Approved = {
  interesse_id: string;
  rota_id: string;
  veiculo_id: string;
  rota: { obra: string; material: string; preco_por_m3: number; origem_endereco: string; destino_endereco: string; horario_previsto: string };
  veiculo: { placa: string; modelo: string; capacidade_m3: number };
  viagem?: any;
};

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocalização indisponível"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
  });
}

function ViagensPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Approved[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ints } = await (supabase as any)
      .from("interesses_rotas")
      .select("id, rota_id, veiculo_id")
      .eq("motorista_id", user.id)
      .eq("status", "aprovado");
    const rows = (ints ?? []) as any[];
    if (!rows.length) { setItems([]); setLoading(false); return; }

    const rotaIds = rows.map((r) => r.rota_id);
    const vehIds = rows.map((r) => r.veiculo_id);
    const [r, v, viag] = await Promise.all([
      (supabase as any).from("rotas").select("id, obra, material, preco_por_m3, origem_endereco, destino_endereco, horario_previsto").in("id", rotaIds),
      (supabase as any).from("veiculos").select("id, placa, modelo, capacidade_m3").in("id", vehIds),
      (supabase as any).from("viagens").select("*").eq("motorista_id", user.id).in("rota_id", rotaIds),
    ]);
    const rm = new Map((r.data ?? []).map((x: any) => [x.id, x]));
    const vm = new Map((v.data ?? []).map((x: any) => [x.id, x]));
    const viagensList = (viag.data ?? []) as any[];

    setItems(rows.map((it) => ({
      interesse_id: it.id,
      rota_id: it.rota_id,
      veiculo_id: it.veiculo_id,
      rota: rm.get(it.rota_id) as any,
      veiculo: vm.get(it.veiculo_id) as any,
      viagem: viagensList.find((x) => x.rota_id === it.rota_id && x.veiculo_id === it.veiculo_id),
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const iniciar = async (it: Approved, file: File | null) => {
    if (!file) { toast.error("Foto do veículo é obrigatória"); return; }
    if (!user) return;
    setBusy(it.interesse_id);
    try {
      const pos = await getPosition();
      const path = `${user.id}/${it.rota_id}/inicio_${Date.now()}.jpg`;
      const up = await supabase.storage.from("viagens").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("viagens").getPublicUrl(path);
      const valor_frete = Number(it.rota.preco_por_m3) * Number(it.veiculo.capacidade_m3);
      const { error } = await (supabase as any).from("viagens").insert({
        rota_id: it.rota_id,
        veiculo_id: it.veiculo_id,
        motorista_id: user.id,
        foto_inicio_url: pub.publicUrl,
        lat_inicio: pos.coords.latitude,
        lng_inicio: pos.coords.longitude,
        valor_frete,
      });
      if (error) throw error;
      toast.success("Viagem iniciada");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao iniciar viagem");
    } finally {
      setBusy(null);
    }
  };

  const finalizar = async (it: Approved, file: File | null) => {
    if (!file) { toast.error("Foto do destino é obrigatória"); return; }
    if (!it.viagem) return;
    setBusy(it.interesse_id);
    try {
      const pos = await getPosition();
      const path = `${user!.id}/${it.rota_id}/fim_${Date.now()}.jpg`;
      const up = await supabase.storage.from("viagens").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("viagens").getPublicUrl(path);
      const { error } = await (supabase as any).from("viagens").update({
        foto_fim_url: pub.publicUrl,
        lat_fim: pos.coords.latitude,
        lng_fim: pos.coords.longitude,
        fim_em: new Date().toISOString(),
      }).eq("id", it.viagem.id);
      if (error) throw error;
      toast.success("Viagem finalizada");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao finalizar viagem");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell title="Minhas viagens">
      {loading ? <p className="text-muted-foreground">Carregando…</p> : items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhuma rota aprovada. Demonstre interesse em uma rota disponível.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <ViagemCard key={it.interesse_id} item={it} busy={busy === it.interesse_id} onStart={iniciar} onEnd={finalizar} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ViagemCard({ item, busy, onStart, onEnd }: { item: Approved; busy: boolean; onStart: (i: Approved, f: File | null) => void; onEnd: (i: Approved, f: File | null) => void; }) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const valorTotal = Number(item.rota.preco_por_m3) * Number(item.veiculo.capacidade_m3);
  const v = item.viagem;
  const status = !v ? "nao_iniciada" : v.fim_em ? "finalizada" : "em_andamento";
  const durMin = v?.inicio_em && v?.fim_em ? Math.round((new Date(v.fim_em).getTime() - new Date(v.inicio_em).getTime()) / 60000) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{item.rota.obra} — <span className="text-muted-foreground font-normal">{item.rota.material}</span></span>
          <Badge variant={status === "finalizada" ? "default" : status === "em_andamento" ? "secondary" : "outline"}>
            {status === "finalizada" ? "Finalizada" : status === "em_andamento" ? "Em andamento" : "Não iniciada"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid sm:grid-cols-2 gap-2">
          <div><strong>Origem:</strong> {item.rota.origem_endereco}</div>
          <div><strong>Destino:</strong> {item.rota.destino_endereco}</div>
          <div><strong>Veículo:</strong> {item.veiculo.placa} — {item.veiculo.modelo} ({Number(item.veiculo.capacidade_m3).toLocaleString("pt-BR")} m³)</div>
          <div><strong>Frete:</strong> <span className="text-accent font-semibold">{formatBRL(valorTotal)}</span></div>
        </div>

        {v && (
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
            <div><MapPin className="inline h-3 w-3 mr-1" />Início: {new Date(v.inicio_em).toLocaleString("pt-BR")} — ({Number(v.lat_inicio).toFixed(5)}, {Number(v.lng_inicio).toFixed(5)})</div>
            {v.fim_em && <div><MapPin className="inline h-3 w-3 mr-1" />Fim: {new Date(v.fim_em).toLocaleString("pt-BR")} — ({Number(v.lat_fim).toFixed(5)}, {Number(v.lng_fim).toFixed(5)})</div>}
            {durMin != null && <div><strong>Duração:</strong> {Math.floor(durMin / 60)}h {durMin % 60}min</div>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {status === "nao_iniciada" && (
            <>
              <input ref={startRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onStart(item, e.target.files?.[0] ?? null)} />
              <Button disabled={busy} onClick={() => startRef.current?.click()} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Camera className="h-4 w-4 mr-1" /><Play className="h-4 w-4 mr-1" /> Iniciar viagem
              </Button>
            </>
          )}
          {status === "em_andamento" && (
            <>
              <input ref={endRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onEnd(item, e.target.files?.[0] ?? null)} />
              <Button disabled={busy} onClick={() => endRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1" /><Square className="h-4 w-4 mr-1" /> Finalizar viagem
              </Button>
            </>
          )}
          {v?.foto_inicio_url && <a href={v.foto_inicio_url} target="_blank" rel="noreferrer" className="text-xs underline self-center">Foto início</a>}
          {v?.foto_fim_url && <a href={v.foto_fim_url} target="_blank" rel="noreferrer" className="text-xs underline self-center">Foto fim</a>}
        </div>
      </CardContent>
    </Card>
  );
}
