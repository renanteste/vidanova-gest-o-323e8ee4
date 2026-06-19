import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MapPin, Calendar, Building2, HandHeart, Check, X, RotateCcw, Inbox } from "lucide-react";
import { formatBRL } from "@/lib/geo";

export const Route = createFileRoute("/interesses-frota")({
  component: () => (
    <RequireAuth allow={["frota"]}>
      <InteressesFrotaPage />
    </RequireAuth>
  ),
});

type Rota = {
  id: string; obra: string; material: string; construtora: string | null;
  origem_endereco: string; destino_endereco: string;
  preco_por_m3: number; horario_previsto: string; status: string;
};
type Interesse = {
  id: string; rota_id: string; motorista_id: string; veiculo_id: string;
  status: "pendente" | "aprovado" | "rejeitado";
  status_aprovacao_frota: string;
  motorista_designado_id: string | null;
  veiculo_designado_id: string | null;
  aprovado_frota_em: string | null;
};
type Driver = { user_id: string; nome: string; ativo: boolean };
type Veiculo = { id: string; placa: string; modelo: string; capacidade_m3: number; ativa: boolean };

function InteressesFrotaPage() {
  const { user } = useAuth();
  const [rotasDisp, setRotasDisp] = useState<Rota[]>([]);
  const [meusInteresses, setMeusInteresses] = useState<Interesse[]>([]);
  const [rotasMap, setRotasMap] = useState<Map<string, Rota>>(new Map());
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [distrib, setDistrib] = useState<Interesse | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [rDisp, mInt, ds, vs] = await Promise.all([
      supabase.from("rotas").select("*").eq("status", "disponivel").order("horario_previsto"),
      supabase.from("interesses_rotas").select("*").eq("motorista_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, nome, ativo").eq("fk_frota_id", user.id),
      supabase.from("veiculos").select("id, placa, modelo, capacidade_m3, ativa").eq("proprietario_id", user.id),
    ]);
    setRotasDisp((rDisp.data as Rota[]) ?? []);
    setDrivers((ds.data as Driver[]) ?? []);
    setVehicles((vs.data as Veiculo[]) ?? []);
    const ints = (mInt.data as Interesse[]) ?? [];
    setMeusInteresses(ints);
    const ids = [...new Set(ints.map((i) => i.rota_id))];
    if (ids.length) {
      const { data: rs } = await supabase.from("rotas").select("*").in("id", ids);
      setRotasMap(new Map(((rs as Rota[]) ?? []).map((r) => [r.id, r])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const solicitar = async (rotaId: string) => {
    if (!user) return;
    if (vehicles.length === 0) {
      toast.error("Cadastre pelo menos um veículo antes de solicitar rota.");
      return;
    }
    // veiculo_id é NOT NULL — usamos um placeholder; o real é definido no momento da distribuição
    const { error } = await supabase.from("interesses_rotas").insert({
      rota_id: rotaId,
      motorista_id: user.id,
      veiculo_id: vehicles[0].id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Solicitação enviada para aprovação do administrador"); load(); }
  };

  const setFrotaStatus = async (it: Interesse, novo: string, extra?: Partial<Interesse>) => {
    const payload: any = { status_aprovacao_frota: novo, ...(extra ?? {}) };
    if (novo === "aprovado") payload.aprovado_frota_em = new Date().toISOString();
    if (novo === "pendente") { payload.aprovado_frota_em = null; payload.motorista_designado_id = null; payload.veiculo_designado_id = null; }
    const { error } = await supabase.from("interesses_rotas").update(payload).eq("id", it.id);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); load(); }
  };

  const aprovadosAdmin = meusInteresses.filter((i) => i.status === "aprovado");
  const pendentesAdmin = meusInteresses.filter((i) => i.status === "pendente");
  const recusados = meusInteresses.filter((i) => i.status === "rejeitado");
  const interessadosIds = new Set(meusInteresses.map((i) => i.rota_id));
  const naoSolicitadas = rotasDisp.filter((r) => !interessadosIds.has(r.id));

  return (
    <AppShell title="Solicitações">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <Tabs defaultValue="aprovadas">
          <TabsList>
            <TabsTrigger value="aprovadas">Aprovadas <Badge variant="secondary" className="ml-2">{aprovadosAdmin.length}</Badge></TabsTrigger>
            <TabsTrigger value="pendentes">Aguardando admin <Badge variant="secondary" className="ml-2">{pendentesAdmin.length}</Badge></TabsTrigger>
            <TabsTrigger value="disponiveis">Disponíveis <Badge variant="secondary" className="ml-2">{naoSolicitadas.length}</Badge></TabsTrigger>
            <TabsTrigger value="recusadas">Recusadas <Badge variant="secondary" className="ml-2">{recusados.length}</Badge></TabsTrigger>
          </TabsList>

          <TabsContent value="aprovadas" className="mt-4">
            {aprovadosAdmin.length === 0 ? (
              <Empty msg="Nenhuma rota aprovada pelo administrador no momento." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {aprovadosAdmin.map((it) => {
                  const r = rotasMap.get(it.rota_id);

                  const motDesignado = drivers.find(
                    (d) => d.user_id === it.motorista_designado_id
                  );

                  const vehDesignado = vehicles.find(
                    (v) => v.id === it.veiculo_designado_id
                  );

                  const valorTotal =
                    r && vehDesignado
                      ? Number(r.preco_por_m3) *
                      Number(vehDesignado.capacidade_m3)
                      : null;

                  return (
                    <Card key={it.id} className="overflow-hidden">
                      <div className="bg-accent/10 px-5 py-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">
                            {r?.material ?? "Material não disponível"}
                          </div>

                          <div className="text-lg font-semibold truncate">
                            {r?.obra ?? "Dados da rota indisponíveis"}
                          </div>
                        </div>

                        <Badge className="bg-green-600 text-white shrink-0">
                          Admin Aprovou
                        </Badge>
                      </div>

                      <CardContent className="pt-4 space-y-3 text-sm">
                        {r?.construtora && (
                          <div className="flex gap-2">
                            <Building2 className="h-4 w-4 text-accent shrink-0" />
                            <div>{r.construtora}</div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <div>
                            <strong>Origem:</strong>{" "}
                            {r?.origem_endereco ?? "Não disponível"}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <div>
                            <strong>Destino:</strong>{" "}
                            {r?.destino_endereco ?? "Não disponível"}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Calendar className="h-4 w-4 text-accent shrink-0" />
                          <div>
                            {r
                              ? new Date(r.horario_previsto).toLocaleString("pt-BR")
                              : "Data não disponível"}
                          </div>
                        </div>

                        <div className="border-t pt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              Status da Frota:
                            </span>

                            <Badge
                              variant={
                                it.status_aprovacao_frota === "aprovado"
                                  ? "default"
                                  : it.status_aprovacao_frota === "recusado"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {it.status_aprovacao_frota === "aprovado"
                                ? "Distribuído"
                                : it.status_aprovacao_frota === "recusado"
                                  ? "Recusado"
                                  : "Pendente"}
                            </Badge>
                          </div>

                          {it.status_aprovacao_frota === "aprovado" && (
                            <div className="rounded-md bg-accent/10 p-3 space-y-1">
                              <div>
                                <strong>Motorista:</strong>{" "}
                                {motDesignado?.nome ?? "Não definido"}
                              </div>

                              <div>
                                <strong>Veículo:</strong>{" "}
                                {vehDesignado
                                  ? `${vehDesignado.placa} — ${vehDesignado.modelo}`
                                  : "Não definido"}
                              </div>

                              {vehDesignado && (
                                <div>
                                  <strong>Capacidade:</strong>{" "}
                                  {Number(
                                    vehDesignado.capacidade_m3
                                  ).toLocaleString("pt-BR")}{" "}
                                  m³
                                </div>
                              )}

                              {valorTotal != null && (
                                <div className="pt-2">
                                  <div className="text-xs text-muted-foreground">
                                    Valor estimado do frete
                                  </div>

                                  <div className="text-xl font-bold text-accent">
                                    {formatBRL(valorTotal)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          {it.status_aprovacao_frota === "pendente" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-accent text-accent-foreground hover:bg-accent/90"
                                onClick={() => setDistrib(it)}
                              >
                                <HandHeart className="h-4 w-4 mr-1" />
                                Distribuir
                              </Button>

                              <ConfirmRecusar
                                onConfirm={() =>
                                  setFrotaStatus(it, "recusado")
                                }
                              />
                            </>
                          )}

                          {it.status_aprovacao_frota === "aprovado" && (
                            <ConfirmCancelar
                              onConfirm={() =>
                                setFrotaStatus(it, "pendente")
                              }
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pendentes" className="mt-4">
            {pendentesAdmin.length === 0 ? (
              <Empty msg="Nenhuma solicitação aguardando admin." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {pendentesAdmin.map((it) => {
                  const r = rotasMap.get(it.rota_id);

                  return (
                    <Card key={it.id} className="overflow-hidden">
                      <div className="bg-accent/10 px-5 py-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">
                            {r?.material}
                          </div>
                          <div className="text-lg font-semibold truncate">
                            {r?.obra}
                          </div>
                        </div>

                        <Badge className="bg-yellow-500 text-white shrink-0">
                          Aguardando Admin
                        </Badge>
                      </div>

                      <CardContent className="pt-4 space-y-2 text-sm">
                        {r?.construtora && (
                          <div className="flex gap-2">
                            <Building2 className="h-4 w-4 text-accent shrink-0" />
                            <div>{r.construtora}</div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <div className="line-clamp-1">
                            <strong>De:</strong> {r?.origem_endereco}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <div className="line-clamp-1">
                            <strong>Para:</strong> {r?.destino_endereco}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Calendar className="h-4 w-4 text-accent shrink-0" />
                          <div>
                            {r
                              ? new Date(r.horario_previsto).toLocaleString("pt-BR")
                              : "—"}
                          </div>
                        </div>

                        <div className="pt-2">
                          <ConfirmCancelarSolicitacao
                            onConfirm={async () => {
                              const { error } = await supabase
                                .from("interesses_rotas")
                                .delete()
                                .eq("id", it.id);

                              if (error) {
                                toast.error(error.message);
                              } else {
                                toast.success("Solicitação cancelada.");
                                load();
                              }
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="disponiveis" className="mt-4">
            {naoSolicitadas.length === 0 ? <Empty msg="Nenhuma rota disponível no momento." /> : (
              <div className="grid sm:grid-cols-2 gap-4">
                {naoSolicitadas.map((r) => (
                  <Card key={r.id} className="overflow-hidden">
                    <div className="bg-accent/10 px-5 py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">{r.material}</div>
                        <div className="text-lg font-semibold truncate">{r.obra}</div>
                      </div>
                      <Badge className="bg-accent text-accent-foreground shrink-0">{formatBRL(Number(r.preco_por_m3))}/m³</Badge>
                    </div>
                    <CardContent className="pt-4 space-y-2 text-sm">
                      {r.construtora && <div className="flex gap-2"><Building2 className="h-4 w-4 text-accent shrink-0" />{r.construtora}</div>}
                      <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" /><div className="line-clamp-1"><strong>De:</strong> {r.origem_endereco}</div></div>
                      <div className="flex gap-2"><MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" /><div className="line-clamp-1"><strong>Para:</strong> {r.destino_endereco}</div></div>
                      <div className="flex gap-2"><Calendar className="h-4 w-4 text-accent shrink-0" /><div>{new Date(r.horario_previsto).toLocaleString("pt-BR")}</div></div>
                      <div className="pt-2">
                        <Button size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => solicitar(r.id)}>
                          <HandHeart className="h-4 w-4 mr-1" /> Solicitar rota
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recusadas" className="mt-4">
            {recusados.length === 0 ? (
              <Empty msg="Nenhuma solicitação recusada." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {recusados.map((it) => {
                  const r = rotasMap.get(it.rota_id);

                  return (
                    <Card key={it.id} className="overflow-hidden">
                      <div className="bg-accent/10 px-5 py-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">
                            {r?.material}
                          </div>
                          <div className="text-lg font-semibold truncate">
                            {r?.obra}
                          </div>
                        </div>

                        <Badge variant="destructive">
                          Recusada
                        </Badge>
                      </div>

                      <CardContent className="pt-4 space-y-2 text-sm">
                        {r?.construtora && (
                          <div className="flex gap-2">
                            <Building2 className="h-4 w-4 text-accent shrink-0" />
                            <div>{r.construtora}</div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <div className="line-clamp-1">
                            <strong>De:</strong> {r?.origem_endereco}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <div className="line-clamp-1">
                            <strong>Para:</strong> {r?.destino_endereco}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Calendar className="h-4 w-4 text-accent shrink-0" />
                          <div>
                            {r
                              ? new Date(r.horario_previsto).toLocaleString("pt-BR")
                              : "—"}
                          </div>
                        </div>

                        <div className="border-t pt-3 mt-3">
                          <div className="text-xs text-muted-foreground">
                            Esta rota não foi aprovada pelo administrador.
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {distrib && (
        <DistribDialog
          interesse={distrib}
          rota={rotasMap.get(distrib.rota_id)}
          drivers={drivers.filter((d) => d.ativo)}
          vehicles={vehicles.filter((v) => v.ativa)}
          onClose={(reload) => { setDistrib(null); if (reload) load(); }}
          onConfirm={async (motId, vehId) => {
            await setFrotaStatus(distrib, "aprovado", {
              motorista_designado_id: motId, veiculo_designado_id: vehId,
            });
          }}
        />
      )}
    </AppShell>
  );
}
function ConfirmCancelarSolicitacao({
  onConfirm,
}: {
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <X className="h-4 w-4 mr-1" />
          Cancelar solicitação
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Cancelar solicitação?
          </AlertDialogTitle>

          <AlertDialogDescription>
            Esta manifestação de interesse será removida e a rota
            voltará para a lista de disponíveis.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>
            Voltar
          </AlertDialogCancel>

          <AlertDialogAction onClick={onConfirm}>
            Cancelar solicitação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <Card><CardContent className="pt-6 text-center text-muted-foreground">
      <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
      {msg}
    </CardContent></Card>
  );
}

function ConfirmRecusar({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline"><X className="h-4 w-4 mr-1" /> Recusar</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recusar esta rota?</AlertDialogTitle>
          <AlertDialogDescription>A rota ficará marcada como recusada pela frota.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Recusar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmCancelar({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline"><RotateCcw className="h-4 w-4 mr-1" /> Cancelar distribuição</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar distribuição?</AlertDialogTitle>
          <AlertDialogDescription>O motorista vinculado perderá o acesso a esta rota.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancelar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DistribDialog({
  interesse, rota, drivers, vehicles, onClose, onConfirm,
}: {
  interesse: Interesse; rota: Rota | undefined; drivers: Driver[]; vehicles: Veiculo[];
  onClose: (reload?: boolean) => void;
  onConfirm: (motoristaId: string, veiculoId: string) => Promise<void>;
}) {
  const [motId, setMotId] = useState(interesse.motorista_designado_id ?? "");
  const [vehId, setVehId] = useState(interesse.veiculo_designado_id ?? "");
  const [busy, setBusy] = useState(false);

  const veiculoEscolhido = vehicles.find((v) => v.id === vehId);
  const valorTotal = rota && veiculoEscolhido ? Number(rota.preco_por_m3) * Number(veiculoEscolhido.capacidade_m3) : null;

  const submit = async () => {
    if (!motId || !vehId) { toast.error("Selecione motorista e veículo"); return; }
    setBusy(true);
    await onConfirm(motId, vehId);
    setBusy(false);
    onClose(true);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Distribuir rota — {rota?.obra}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum motorista ativo na sua frota.</p>
          ) : (
            <div className="space-y-1">
              <label className="text-sm font-medium">Motorista vinculado</label>
              <Select value={motId} onValueChange={setMotId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => <SelectItem key={d.user_id} value={d.user_id}>{d.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum veículo ativo na sua frota.</p>
          ) : (
            <div className="space-y-1">
              <label className="text-sm font-medium">Veículo</label>
              <Select value={vehId} onValueChange={setVehId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.modelo} ({Number(v.capacidade_m3).toLocaleString("pt-BR")} m³)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {valorTotal != null && (
            <div className="rounded-md bg-accent/10 p-3">
              <div className="text-xs text-muted-foreground">Valor total do frete</div>
              <div className="text-2xl font-bold text-accent">{formatBRL(valorTotal)}</div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={submit} disabled={busy || !motId || !vehId}>
            {busy ? "Salvando…" : <><Check className="h-4 w-4 mr-1" /> Confirmar distribuição</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
