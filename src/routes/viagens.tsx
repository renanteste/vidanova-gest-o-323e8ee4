import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getRotasDoMotorista } from "@/lib/viagens.functions";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Camera, Check, PlayCircle, Truck } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/viagens")({
  component: () => (
    <RequireAuth allow={["motorista_autonomo", "motorista_vinculado"]}>
      <ViagensPage />
    </RequireAuth>
  ),
});

// Fluxo simplificado: Iniciar viagem -> Enviar foto -> Finalizar viagem.
// O enum do banco é preservado: usamos "indo_origem" como estado "em andamento"
// e "finalizada" como estado final. Viagens antigas com status intermediários
// continuam válidas e são tratadas como "Em andamento".
type StatusSimples = "pendente" | "em_andamento" | "finalizada";

const STAGE_LABEL: Record<StatusSimples, string> = {
  pendente: "Aguardando início",
  em_andamento: "Em andamento",
  finalizada: "Finalizada",
};

function simplify(raw: string | null | undefined): StatusSimples {
  if (!raw || raw === "pendente") return "pendente";
  if (raw === "finalizada") return "finalizada";
  return "em_andamento";
}

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
  const fetchRotas = useServerFn(getRotasDoMotorista);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Buscar interesses onde o motorista é o dono OU foi designado
      const { data: ints, error: intsError } = await (supabase as any)
        .from("interesses_rotas")
        .select("id, rota_id, veiculo_id, status, status_aprovacao_frota")
        .or(`motorista_id.eq.${user.id},motorista_designado_id.eq.${user.id}`);

      if (intsError) {
        console.error("Erro ao buscar interesses:", intsError);
        setItems([]);
        setLoading(false);
        return;
      }

      // 2. Filtrar interesses aprovados (pelo admin OU pelo dono da frota)
      const rows = (ints ?? []).filter(
        (i: any) => i.status === "aprovado" || i.status_aprovacao_frota === "aprovado"
      );

      if (!rows.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const rotaIds = rows.map((r: any) => r.rota_id);
      const vehIds = rows.map((r: any) => r.veiculo_id);

      // 3. Buscar rotas (via server fn, respeitando as permissões), veículos e viagens
      const [rotasRes, veiculosRes, viagensRes] = await Promise.all([
        fetchRotas({ data: { rotaIds } }).catch((e: any) => {
          console.error("Erro ao buscar obras:", e);
          return { rotas: [] as any[] };
        }),
        (supabase as any)
          .from("veiculos")
          .select("id, placa, modelo, capacidade_m3")
          .in("id", vehIds),
        (supabase as any)
          .from("viagens")
          .select("*")
          .eq("motorista_id", user.id)
          .in("rota_id", rotaIds),
      ]);

      // 4. Criar maps para acesso rápido
      const rotaMap = new Map(((rotasRes as any)?.rotas ?? []).map((x: any) => [x.id, x]));
      const veiculoMap = new Map((veiculosRes.data ?? []).map((x: any) => [x.id, x]));
      const viagensList = (viagensRes.data ?? []) as any[];

      // 5. Montar os items — uma linha por OBRA (evita cards duplicados da mesma obra)
      const porRota = new Map<string, any>();
      rows.forEach((it: any) => { if (!porRota.has(it.rota_id)) porRota.set(it.rota_id, it); });

      const newItems = [...porRota.values()].map((it: any) => {
        // Reutiliza a viagem já existente da obra: prioriza a ativa (sem fim_em),
        // senão a mais recente. Nunca cria uma nova ao recarregar a tela.
        const daRota = viagensList
          .filter((v: any) => v.rota_id === it.rota_id)
          .sort((a: any, b: any) => new Date(b.inicio_em).getTime() - new Date(a.inicio_em).getTime());
        const viagem = daRota.find((v: any) => !v.fim_em) ?? daRota[0] ?? null;
        return {
          interesse_id: it.id,
          rota_id: it.rota_id,
          veiculo_id: it.veiculo_id,
          rota: rotaMap.get(it.rota_id),
          veiculo: veiculoMap.get(it.veiculo_id),
          viagem,
        };
      });

      setItems(newItems);

    } catch (error) {
      console.error("Erro ao carregar viagens:", error);
      toast.error("Erro ao carregar viagens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const startTrip = async (it: Item) => {
    if (!user) return;
    // Guarda no estado local: já existe viagem carregada para esta obra
    if (it.viagem && !it.viagem.fim_em) { toast.info("Já existe uma viagem em andamento para esta obra."); return; }
    setBusy(it.interesse_id);
    try {
      // Guarda contra duplicação: revalida no banco antes de criar
      const { data: existentes } = await (supabase as any)
        .from("viagens")
        .select("id, fim_em")
        .eq("rota_id", it.rota_id)
        .is("fim_em", null)
        .limit(1);
      if (existentes && existentes.length > 0) {
        toast.info("Esta obra já possui uma viagem em andamento.");
        await load();
        return;
      }

      const pos = await getPosition();
      const precoM3 = Number(it.rota?.preco_por_m3 ?? 0);
      const capacidade = Number(it.veiculo?.capacidade_m3 ?? 0);
      const valor_frete = precoM3 * capacidade;
      const { error } = await (supabase as any).from("viagens").insert({
        rota_id: it.rota_id,
        veiculo_id: it.veiculo_id,
        motorista_id: user.id,
        status: "indo_origem",
        inicio_em: new Date().toISOString(),
        lat_inicio: pos.coords.latitude,
        lng_inicio: pos.coords.longitude,
        valor_frete,
      });
      if (error) throw error;
      toast.success("Viagem iniciada");
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(null); }
  };


  const uploadPhoto = async (it: Item, file: File) => {
    const path = `${user!.id}/${it.rota_id}/inicio_${Date.now()}.jpg`;
    const up = await supabase.storage.from("viagens").upload(path, file, { contentType: file.type || "image/jpeg" });
    if (up.error) throw up.error;
    return supabase.storage.from("viagens").getPublicUrl(path).data.publicUrl;
  };

  const enviarFoto = async (it: Item, file: File) => {
    if (!it.viagem) { toast.error("Inicie a viagem antes de enviar a foto"); return; }
    setBusy(it.interesse_id);
    try {
      const url = await uploadPhoto(it, file);
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await getPosition();
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch { /* GPS opcional no envio da foto */ }
      const { error } = await (supabase as any).from("viagens").update({
        foto_inicio_url: url,
        ...(lat != null ? { lat_carregamento: lat, lng_carregamento: lng } : {}),
      }).eq("id", it.viagem.id);
      if (error) throw error;
      toast.success("Foto enviada");
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); } finally { setBusy(null); }
  };

  const finalizar = async (it: Item) => {
    if (!it.viagem) { toast.error("Viagem não encontrada"); return; }
    setBusy(it.interesse_id);
    try {
      const pos = await getPosition();
      const { error } = await (supabase as any).from("viagens").update({
        status: "finalizada",
        fim_em: new Date().toISOString(),
        lat_fim: pos.coords.latitude,
        lng_fim: pos.coords.longitude,
      }).eq("id", it.viagem.id);
      if (error) throw error;
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
              onFoto={enviarFoto}
              onFinalizar={finalizar}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Timeline({ status, temFoto }: { status: StatusSimples; temFoto: boolean }) {
  const steps = [
    { label: "Iniciada", icon: PlayCircle, done: status !== "pendente" },
    { label: "Foto enviada", icon: Camera, done: temFoto },
    { label: "Finalizada", icon: Check, done: status === "finalizada" },
  ];
  return (
    <div className="flex items-center gap-2 py-2">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`flex flex-col items-center text-[11px] ${s.done ? "text-primary font-medium" : "text-muted-foreground"}`}>
              <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${s.done ? "border-primary bg-primary/10" : "border-muted"}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="mt-0.5">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 w-6 ${steps[i + 1].done ? "bg-primary" : "bg-muted"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function ViagemCard({ item, busy, onStart, onFoto, onFinalizar }: {
  item: Item; busy: boolean;
  onStart: (i: Item) => void;
  onFoto: (i: Item, f: File) => void;
  onFinalizar: (i: Item) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const v = item.viagem;
  const status = simplify(v?.status);
  const foto = v?.foto_inicio_url ?? v?.foto_carregamento_url ?? null;
  const precoM3 = Number(item.rota?.preco_por_m3 ?? 0);
  const capacidade = Number(item.veiculo?.capacidade_m3 ?? 0);
  const valor = precoM3 * capacidade;
  const dur = v?.inicio_em && v?.fim_em ? Math.round((new Date(v.fim_em).getTime() - new Date(v.inicio_em).getTime()) / 60000) : null;
  const join = (a?: string | null, b?: string | null) => [a, b].filter(Boolean).join(" — ") || "-";
  const origem = join(item.rota?.origem_endereco, item.rota?.origem_complemento);
  const destino = join(item.rota?.destino_endereco, item.rota?.destino_complemento);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{item.rota?.obra ?? "-"} — <span className="text-muted-foreground font-normal">{item.rota?.material ?? "-"}</span></span>
          <Badge variant={status === "finalizada" ? "default" : status === "pendente" ? "outline" : "secondary"}>
            {STAGE_LABEL[status]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Timeline status={status} temFoto={!!foto} />

        <div className="grid sm:grid-cols-2 gap-2">
          <div><strong>Obra:</strong> {item.rota?.obra || "-"}</div>
          <div><strong>Material:</strong> {item.rota?.material || "-"}</div>
          <div><strong>Tipo de escavação:</strong> {item.rota?.responsavel || "-"}</div>
          {item.rota?.construtora && <div><strong>Construtora:</strong> {item.rota.construtora}</div>}
          <div className="sm:col-span-2"><strong>Origem:</strong> {origem}</div>
          <div className="sm:col-span-2"><strong>Destino:</strong> {destino}</div>
          {item.rota?.distancia_km != null && (
            <div><strong>Distância:</strong> {Number(item.rota.distancia_km).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km</div>
          )}
          <div><strong>Preço por m³:</strong> {precoM3 ? formatBRL(precoM3) : "-"}</div>
          <div><strong>Veículo:</strong> {item.veiculo?.placa ?? "-"} — {item.veiculo?.modelo ?? "-"} ({Number(item.veiculo?.capacidade_m3 ?? 0).toLocaleString("pt-BR")} m³)</div>
          <div><strong>Frete:</strong> <span className="text-accent font-semibold">{formatBRL(valor)}</span></div>
          <div><strong>Status:</strong> {STAGE_LABEL[status]}</div>
        </div>

        {v && (
          <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
            {v.inicio_em && <div>Início: {new Date(v.inicio_em).toLocaleString("pt-BR")}</div>}
            {v.fim_em && <div>Fim: {new Date(v.fim_em).toLocaleString("pt-BR")}</div>}
            {dur != null && <div><strong>Duração total:</strong> {Math.floor(dur / 60)}h {dur % 60}min</div>}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFoto(item, f); e.currentTarget.value = ""; }} />

        <div className="flex flex-wrap gap-2 pt-1">
          {status === "pendente" && (
            <Button disabled={busy} onClick={() => onStart(item)} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <PlayCircle className="h-4 w-4 mr-1" /> Iniciar viagem
            </Button>
          )}
          {status === "em_andamento" && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1" /> {foto ? "Reenviar foto" : "Enviar foto"}
              </Button>
              <Button disabled={busy} onClick={() => onFinalizar(item)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Check className="h-4 w-4 mr-1" /> Finalizar viagem
              </Button>
            </>
          )}

          {foto && <a href={foto} target="_blank" rel="noreferrer" className="text-xs underline self-center">Ver foto</a>}
          {v?.foto_fim_url && <a href={v.foto_fim_url} target="_blank" rel="noreferrer" className="text-xs underline self-center">Foto destino</a>}
        </div>
      </CardContent>
    </Card>
  );
}
