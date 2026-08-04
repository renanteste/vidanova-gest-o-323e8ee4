import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Inbox, Check, X, RotateCcw, MapPin, Building2, Calendar, IdCard, Truck } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/interesses")({
  component: () => (
    <RequireAuth allow={["admin", "frota"]}>
      <InteressesPage />
    </RequireAuth>
  ),
});

type Status = "pendente" | "aprovado" | "rejeitado";

type Item = {
  id: string;
  rota_id: string;
  motorista_id: string;
  veiculo_id: string;
  status: Status;
  created_at: string;
  rota?: {
    obra: string; material: string; construtora: string | null;
    origem_endereco: string; origem_complemento: string | null;
    destino_endereco: string; destino_complemento: string | null;
  };
  veiculo?: { placa: string; modelo: string; capacidade_m3: number };
  motorista?: { nome: string; cnh: string | null; foto_url: string | null; perfil: string };
};

function InteressesPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.perfil === "admin";
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("interesses_rotas")
      .select("id, rota_id, motorista_id, veiculo_id, status, created_at")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }

    const rows = (data ?? []) as Item[];
    if (rows.length === 0) { setItems([]); setLoading(false); return; }

    const rotaIds = [...new Set(rows.map((r) => r.rota_id))];
    const vehIds = [...new Set(rows.map((r) => r.veiculo_id))];
    const motIds = [...new Set(rows.map((r) => r.motorista_id))];

    const [rotasRes, vehRes, motRes] = await Promise.all([
      supabase.from("rotas").select("id, obra, material, construtora, preco_por_m3, horario_previsto, origem_endereco, origem_complemento, destino_endereco, destino_complemento").in("id", rotaIds),
      supabase.from("veiculos").select("id, placa, modelo, capacidade_m3").in("id", vehIds),
      supabase.from("profiles").select("user_id, nome, cnh, foto_url, perfil").in("user_id", motIds),
    ]);

    const rotaMap = new Map((rotasRes.data ?? []).map((x: any) => [x.id, x]));
    const vehMap = new Map((vehRes.data ?? []).map((x: any) => [x.id, x]));
    const motMap = new Map((motRes.data ?? []).map((x: any) => [x.user_id, x]));

    let enriched = rows.map((r) => ({
      ...r,
      rota: rotaMap.get(r.rota_id) as any,
      veiculo: vehMap.get(r.veiculo_id) as any,
      motorista: motMap.get(r.motorista_id) as any,
    }));

    // Admin: ocultar interesses de motoristas vinculados (regra de negócio)
    if (isAdmin) {
      enriched = enriched.filter((r) => r.motorista?.perfil !== "motorista_vinculado");
    }

    setItems(enriched);
    setLoading(false);
  };

  useEffect(() => { if (user && profile) load(); }, [user, profile]);

  const setStatus = async (it: Item, novo: Status) => {
    const { error } = await supabase.from("interesses_rotas").update({ status: novo }).eq("id", it.id);
    if (error) { toast.error(error.message); return; }

    // Sincronizar status da rota
    if (novo === "aprovado") {
      await supabase.from("rotas").update({ status: "finalizada" }).eq("id", it.rota_id);
      toast.success("Interesse aprovado e rota atribuída");
    } else if (novo === "pendente" && it.status === "aprovado") {
      await supabase.from("rotas").update({ status: "disponivel" }).eq("id", it.rota_id);
      toast.success("Aprovação cancelada — rota reaberta");
    } else if (novo === "rejeitado") {
      toast.success("Interesse recusado");
    }
    load();
  };

  const statusVariant = (s: Status) =>
    s === "aprovado" ? "default" : s === "rejeitado" ? "destructive" : "secondary";
  const statusLabel = (s: Status) =>
    s === "aprovado" ? "Aprovado" : s === "rejeitado" ? "Recusado" : "Pendente";

  return (
    <AppShell title="Interesses em rotas">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Nenhum interesse registrado.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const cap = Number(it.veiculo?.capacidade_m3 ?? 0);
            const valorTotal = it.rota && cap ? Number(it.rota.preco_por_m3) * cap : null;
            const nome = it.motorista?.nome ?? "—";
            const initials = nome.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            return (
              <Card key={it.id} className="overflow-hidden">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <Avatar className="h-14 w-14">
                      {it.motorista?.foto_url && <AvatarImage src={it.motorista.foto_url} alt={nome} />}
                      <AvatarFallback>{initials || "—"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-base">{nome}</div>
                        <Badge variant={statusVariant(it.status)}>{statusLabel(it.status)}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        {it.motorista?.cnh && <span className="flex items-center gap-1"><IdCard className="h-3 w-3" /> CNH {it.motorista.cnh}</span>}
                        {it.rota?.construtora && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {it.rota.construtora}</span>}
                      </div>
                      <div className="text-sm font-medium mt-1">{it.rota?.obra} <span className="text-muted-foreground font-normal">— {it.rota?.material}</span></div>
                    </div>
                  </div>

                  <div className="text-sm space-y-1 border-t pt-3">
                    <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" /><div><strong>Origem:</strong> {it.rota?.origem_endereco}{it.rota?.origem_complemento && ` — ${it.rota.origem_complemento}`}</div></div>
                    <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" /><div><strong>Destino:</strong> {it.rota?.destino_endereco}{it.rota?.destino_complemento && ` — ${it.rota.destino_complemento}`}</div></div>
                    <div className="flex gap-2"><Truck className="h-4 w-4 text-accent shrink-0 mt-0.5" /><div><strong>Veículo:</strong> {it.veiculo?.placa} — {it.veiculo?.modelo} · {cap.toLocaleString("pt-BR")} m³</div></div>
                    {valorTotal != null && (
                      <div className="text-sm pt-1"><strong>Frete total:</strong> <span className="text-accent font-semibold">{formatBRL(valorTotal)}</span></div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {it.status === "pendente" && (
                      <>
                        <Button size="sm" onClick={() => setStatus(it, "aprovado")} className="bg-accent text-accent-foreground hover:bg-accent/90">
                          <Check className="h-4 w-4 mr-1" /> Aprovar
                        </Button>
                        <ConfirmRecusar onConfirm={() => setStatus(it, "rejeitado")} />
                      </>
                    )}
                    {it.status === "aprovado" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(it, "pendente")}>
                        <RotateCcw className="h-4 w-4 mr-1" /> Cancelar aprovação
                      </Button>
                    )}
                    {it.status === "rejeitado" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(it, "pendente")}>
                        <RotateCcw className="h-4 w-4 mr-1" /> Reabrir
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function ConfirmRecusar({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          <X className="h-4 w-4 mr-1" /> Recusar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recusar interesse?</AlertDialogTitle>
          <AlertDialogDescription>
            O motorista será notificado de que não foi selecionado para esta rota.
            Você poderá reabrir depois se necessário.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Recusar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
