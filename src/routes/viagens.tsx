import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Camera, Check, MapPin, Navigation, Package, PackageCheck, PlayCircle, Truck } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/viagens")({
  component: () => (
    <RequireAuth allow={["motorista_autonomo", "motorista_vinculado"]}>
      <ViagensPage />
    </RequireAuth>
  ),
});

type StatusViagem =
  | "pendente"
  | "indo_origem"
  | "no_carregamento"
  | "carregando"
  | "carregado"
  | "indo_destino"
  | "descarregando"
  | "finalizada";

const STAGES: { key: StatusViagem; label: string; icon: any }[] = [
  { key: "pendente", label: "Aguardando início", icon: PlayCircle },
  { key: "indo_origem", label: "A caminho da origem", icon: Navigation },
  { key: "no_carregamento", label: "No local de carregamento", icon: MapPin },
  { key: "carregando", label: "Carregando", icon: Package },
  { key: "carregado", label: "Carregado", icon: PackageCheck },
  { key: "indo_destino", label: "A caminho do destino", icon: Navigation },
  { key: "descarregando", label: "Descarregando", icon: Package },
  { key: "finalizada", label: "Finalizada", icon: Check },
];

type Item = {
  interesse_id: string;
  rota_id: string;
  veiculo_id: string;
  rota: any;
  veiculo: any;
  viagem: any | null;
};

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocalização indisponível"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
  });
}

function ViagensPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ints } = await (supabase as any)
      .from("interesses_rotas")
      .select("id, rota_id, veiculo_id")
      .or(`motorista_id.eq.${user.id},motorista_designado_id.eq.${user.id}`)
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
    const vl = (viag.data ?? []) as any[];

    setItems(rows.map((it) => ({
      interesse_id: it.id,
      rota_id: it.rota_id,
      veiculo_id: it.veiculo_id,
      rota: rm.get(it.rota_id),
      veiculo: vm.get(it.veiculo_id),
      viagem: vl.find((x) => x.rota_id === it.rota_id && x.veiculo_id === it.veiculo_id) ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const startTrip = async (it: Item) => {
    if (!user) return;
    setBusy(it.interesse_id);
    try {
      const pos = await getPosition();
      const valor_frete = Number(it.rota.preco_por_m3) * Number(it.veiculo.capacidade_m3);
      const { error } = await (supabase as any).from("viagens").insert({
        rota_id: it.rota_id,
        veiculo_id: it.veiculo_id,
        motorista_id: user.id,
        status: "indo_origem",
        lat_inicio: pos.coords.latitude,
        lng_inicio: pos.coords.longitude,
        valor_frete,
      });
      if (error) throw error;
      toast.success("A caminho da origem");
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(null); }
  };

  const advanceSimple = async (it: Item, patch: any, msg: string) => {
    if (!it.viagem) return;
    setBusy(it.interesse_id);
    try {
      const { error } = await (supabase as any).from("viagens").update(patch).eq("id", it.viagem.id);
      if (error) throw error;
      toast.success(msg);
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(null); }
  };

  const uploadPhoto = async (it: Item, file: File, kind: "inicio" | "carregamento" | "fim") => {
    const path = `${user!.id}/${it.rota_id}/${kind}_${Date.now()}.jpg`;
    const up = await supabase.storage.from("viagens").upload(path, file, { contentType: file.type || "image/jpeg" });
    if (up.error) throw up.error;
    return supabase.storage.from("viagens").getPublicUrl(path).data.publicUrl;
  };

  const chegouOrigem = async (it: Item, file: File | null) => {
    if (!file) { toast.error("Foto obrigatória"); return; }
    setBusy(it.interesse_id);
    try {
      const pos = await getPosition();
      const url = await uploadPhoto(it, file, "inicio");
      await (supabase as any).from("viagens").update({
        status: "no_carregamento",
        chegou_origem_em: new Date().toISOString(),
        foto_inicio_url: url,
        lat_inicio: pos.coords.latitude,
        lng_inicio: pos.coords.longitude,
      }).eq("id", it.viagem.id);
      toast.success("Chegada confirmada");
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(null); }
  };

  const carregado = async (it: Item, file: File | null) => {
    if (!file) { toast.error("Foto do carregamento obrigatória"); return; }
    setBusy(it.interesse_id);
    try {
      const pos = await getPosition();
      const url = await uploadPhoto(it, file, "carregamento");
      await (supabase as any).from("viagens").update({
        status: "carregado",
        carregado_em: new Date().toISOString(),
        foto_carregamento_url: url,
        lat_carregamento: pos.coords.latitude,
        lng_carregamento: pos.coords.longitude,
      }).eq("id", it.viagem.id);
      toast.success("Carregamento concluído");
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(null); }
  };

  const finalizar = async (it: Item, file: File | null) => {
    if (!file) { toast.error("Foto do destino obrigatória"); return; }
    setBusy(it.interesse_id);
    try {
      const pos = await getPosition();
      const url = await uploadPhoto(it, file, "fim");
      await (supabase as any).from("viagens").update({
        status: "finalizada",
        fim_em: new Date().toISOString(),
        foto_fim_url: url,
        lat_fim: pos.coords.latitude,
        lng_fim: pos.coords.longitude,
      }).eq("id", it.viagem.id);
      toast.success("Viagem finalizada!");
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(null); }
  };

  return (
    <AppShell title="Minhas viagens">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhuma rota aprovada.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <ViagemCard
              key={it.interesse_id}
              item={it}
              busy={busy === it.interesse_id}
              onStart={startTrip}
              onChegouOrigem={chegouOrigem}
              onIniciarCarregamento={(i) => advanceSimple(i, { status: "carregando", carregamento_iniciado_em: new Date().toISOString() }, "Carregamento iniciado")}
              onCarregado={carregado}
              onIndoDestino={(i) => advanceSimple(i, { status: "indo_destino", indo_destino_em: new Date().toISOString() }, "A caminho do destino")}
              onDescarregando={(i) => advanceSimple(i, { status: "descarregando", descarregando_em: new Date().toISOString() }, "Descarregando")}
              onFinalizar={finalizar}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Timeline({ status }: { status: StatusViagem }) {
  const idx = STAGES.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const done = i < idx;
        const current = i === idx;
        return (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            <div className={`flex flex-col items-center text-[10px] ${current ? "text-accent font-semibold" : done ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center ${current ? "border-accent bg-accent/10" : done ? "border-primary bg-primary/10" : "border-muted"}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="mt-0.5 max-w-[60px] text-center leading-tight">{s.label}</span>
            </div>
            {i < STAGES.length - 1 && <div className={`h-0.5 w-3 ${i < idx ? "bg-primary" : "bg-muted"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function ViagemCard({ item, busy, onStart, onChegouOrigem, onIniciarCarregamento, onCarregado, onIndoDestino, onDescarregando, onFinalizar }: {
  item: Item; busy: boolean;
  onStart: (i: Item) => void;
  onChegouOrigem: (i: Item, f: File | null) => void;
  onIniciarCarregamento: (i: Item) => void;
  onCarregado: (i: Item, f: File | null) => void;
  onIndoDestino: (i: Item) => void;
  onDescarregando: (i: Item) => void;
  onFinalizar: (i: Item, f: File | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<((f: File) => void) | null>(null);
  const v = item.viagem;
  const status: StatusViagem = v?.status ?? "pendente";
  const valor = Number(item.rota.preco_por_m3) * Number(item.veiculo.capacidade_m3);
  const dur = v?.inicio_em && v?.fim_em ? Math.round((new Date(v.fim_em).getTime() - new Date(v.inicio_em).getTime()) / 60000) : null;

  const trigger = (cb: (f: File) => void) => { setPending(() => cb); fileRef.current?.click(); };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{item.rota.obra} — <span className="text-muted-foreground font-normal">{item.rota.material}</span></span>
          <Badge variant={status === "finalizada" ? "default" : status === "pendente" ? "outline" : "secondary"}>
            {STAGES.find((s) => s.key === status)?.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Timeline status={status} />

        <div className="grid sm:grid-cols-2 gap-2">
          <div><strong>Origem:</strong> {item.rota.origem_endereco}</div>
          <div><strong>Destino:</strong> {item.rota.destino_endereco}</div>
          <div><strong>Veículo:</strong> {item.veiculo.placa} — {item.veiculo.modelo} ({Number(item.veiculo.capacidade_m3).toLocaleString("pt-BR")} m³)</div>
          <div><strong>Frete:</strong> <span className="text-accent font-semibold">{formatBRL(valor)}</span></div>
        </div>

        {v && (
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
            {v.inicio_em && <div>Início: {new Date(v.inicio_em).toLocaleString("pt-BR")}</div>}
            {v.chegou_origem_em && <div>Chegou origem: {new Date(v.chegou_origem_em).toLocaleString("pt-BR")}</div>}
            {v.carregado_em && <div>Carregado: {new Date(v.carregado_em).toLocaleString("pt-BR")}</div>}
            {v.fim_em && <div>Fim: {new Date(v.fim_em).toLocaleString("pt-BR")}</div>}
            {dur != null && <div><strong>Duração total:</strong> {Math.floor(dur / 60)}h {dur % 60}min</div>}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f && pending) pending(f); e.currentTarget.value = ""; }} />

        <div className="flex flex-wrap gap-2 pt-1">
          {status === "pendente" && (
            <Button disabled={busy} onClick={() => onStart(item)} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <PlayCircle className="h-4 w-4 mr-1" /> Iniciar viagem
            </Button>
          )}
          {status === "indo_origem" && (
            <Button disabled={busy} onClick={() => trigger((f) => onChegouOrigem(item, f))}>
              <Camera className="h-4 w-4 mr-1" /> Cheguei na origem
            </Button>
          )}
          {status === "no_carregamento" && (
            <Button disabled={busy} onClick={() => onIniciarCarregamento(item)}>
              <Package className="h-4 w-4 mr-1" /> Iniciar carregamento
            </Button>
          )}
          {status === "carregando" && (
            <Button disabled={busy} onClick={() => trigger((f) => onCarregado(item, f))}>
              <Camera className="h-4 w-4 mr-1" /> Confirmar carregamento
            </Button>
          )}
          {status === "carregado" && (
            <Button disabled={busy} onClick={() => onIndoDestino(item)} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Navigation className="h-4 w-4 mr-1" /> Sair para destino
            </Button>
          )}
          {status === "indo_destino" && (
            <Button disabled={busy} onClick={() => onDescarregando(item)}>
              <Package className="h-4 w-4 mr-1" /> Cheguei e estou descarregando
            </Button>
          )}
          {status === "descarregando" && (
            <Button disabled={busy} onClick={() => trigger((f) => onFinalizar(item, f))}>
              <Camera className="h-4 w-4 mr-1" /> Finalizar viagem
            </Button>
          )}

          {v?.foto_inicio_url && <a href={v.foto_inicio_url} target="_blank" rel="noreferrer" className="text-xs underline self-center">Foto origem</a>}
          {v?.foto_carregamento_url && <a href={v.foto_carregamento_url} target="_blank" rel="noreferrer" className="text-xs underline self-center">Foto carregamento</a>}
          {v?.foto_fim_url && <a href={v.foto_fim_url} target="_blank" rel="noreferrer" className="text-xs underline self-center">Foto destino</a>}
        </div>
      </CardContent>
    </Card>
  );
}
