import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Trash2, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/meus-interesses")({
  component: () => (
    <RequireAuth allow={["motorista_autonomo", "motorista_vinculado"]}>
      <MeusInteressesPage />
    </RequireAuth>
  ),
});

type Item = {
  id: string; rota_id: string; veiculo_id: string; status: "pendente" | "aprovado" | "rejeitado"; created_at: string;
  rota?: {
    obra: string;
    material: string;
    preco_por_m3: number;
    horario_previsto: string;
    origem_endereco?: string;
    destino_endereco?: string;
    construtora?: string;
    distancia_km?: number;
  };
  veiculo?: { placa: string; modelo: string; capacidade_m3: number };
};

function MeusInteressesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("interesses_rotas")
      .select("id, rota_id, veiculo_id, status, created_at")
      .eq("motorista_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as Item[];
    if (!rows.length) { setItems([]); setLoading(false); return; }
    const [r, v] = await Promise.all([
      supabase
        .from("rotas")
        .select("id, obra, material, preco_por_m3, horario_previsto, origem_endereco, destino_endereco, distancia_km, construtora")
        .in("id", rows.map((x) => x.rota_id)),

      supabase
        .from("veiculos")
        .select("id, placa, modelo, capacidade_m3")
        .in("id", rows.map((x) => x.veiculo_id)),
    ]);
    const rm = new Map((r.data ?? []).map((x: any) => [x.id, x]));
    const vm = new Map((v.data ?? []).map((x: any) => [x.id, x]));
    setItems(rows.map((x) => ({ ...x, rota: rm.get(x.rota_id) as any, veiculo: vm.get(x.veiculo_id) as any })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (user) {
      const channel = supabase
        .channel('interesses_updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'interesses_rotas', filter: `motorista_id=eq.${user.id}` }, () => load())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interesses_rotas', filter: `motorista_id=eq.${user.id}` }, () => load())
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const cancelarInteresse = async (it: Item) => {
    if (!confirm("Cancelar este interesse?")) return;
    const { error } = await supabase.from("interesses_rotas").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else { toast.success("Interesse cancelado"); load(); }
  };

  return (
    <AppShell title="Meus interesses">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
          Você ainda não demonstrou interesse em rotas.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const total = it.rota && it.veiculo ? Number(it.rota.preco_por_m3) * Number(it.veiculo.capacidade_m3) : null;
            return (
              <Card
                key={it.id}
                className="overflow-hidden max-w-md"
              >
                <div className="bg-orange-50 px-5 py-4 border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {it.rota?.material}
                      </div>

                      <h3 className="text-2xl font-semibold">
                        {it.rota?.obra}
                      </h3>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge className="bg-orange-500 hover:bg-orange-500 text-white">
                        R$ {Number(it.rota?.preco_por_m3 ?? 0).toFixed(2)}/m³
                      </Badge>

                      <Badge
                        variant={
                          it.status === "aprovado"
                            ? "default"
                            : it.status === "rejeitado"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {it.status === "aprovado"
                          ? "Aprovado ✅"
                          : it.status === "rejeitado"
                            ? "Rejeitado ❌"
                            : "Pendente ⏳"}
                      </Badge>
{it.status === "pendente" && (
  <Button
    variant="destructive"
    size="sm"
    onClick={() => cancelarInteresse(it)}
    className="mt-2"
  >
    ❌ Cancelar solicitação
  </Button>
)}
                    </div>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <MapPin className="h-4 w-4 text-orange-500 mt-1 shrink-0" />
                      <div className="line-clamp-1">
                        <strong>De:</strong> {it.rota?.origem_endereco}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <MapPin className="h-4 w-4 text-orange-500 mt-1 shrink-0" />
                      <div className="line-clamp-1">
                        <strong>Para:</strong> {it.rota?.destino_endereco}
                      </div>
                    </div>

                  </div>

                  {it.rota?.distancia_km && (
                    <div className="text-muted-foreground">
                      Distância estimada:{" "}
                      <strong>{it.rota.distancia_km} km</strong>
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <div className="text-sm text-muted-foreground">
                      Valor estimado
                      {it.veiculo?.capacidade_m3 && (
                        <> (veículo de {it.veiculo.capacidade_m3} m³)</>
                      )}
                    </div>

                    <div className="text-3xl font-bold text-orange-500">
                      {total != null ? formatBRL(total) : "-"}
                    </div>
                  </div>

                  <div className="text-sm">
                    <strong>Veículo:</strong>{" "}
                    {it.veiculo?.placa}
                    {" • "}
                    {it.veiculo?.capacidade_m3} m³
                  </div>

                  {it.status === "pendente" ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => cancelarInteresse(it)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cancelar interesse
                    </Button>
                  ) : (
                    <Button
                      disabled
                      className="w-full"
                    >
                      Interesse {it.status}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
