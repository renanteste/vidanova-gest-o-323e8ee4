import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardPathFor, type Perfil } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { maskTelefone, maskCNH, unmask } from "@/lib/masks";

export const Route = createFileRoute("/login")({ component: LoginPage });

const signupSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  cnh: z.string().trim().max(20).optional().or(z.literal("")),
  perfil: z.enum(["frota", "motorista_autonomo"]),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Senhas não conferem", path: ["confirm"] });

function LoginPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && profile) router.navigate({ to: dashboardPathFor(profile.perfil) });
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-1/2 bg-primary text-primary-foreground p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Truck className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">VidaNova <span className="text-accent">Terraplenagem</span></span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">A plataforma das rotas de terraplenagem.</h1>
          <p className="mt-4 text-primary-foreground/70 max-w-md">
            Conectamos donos de frota, motoristas autônomos e motoristas vinculados para gerir
            viagens e veículos em um único lugar.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/50">© VidaNova Terraplenagem</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm /></TabsContent>
            <TabsContent value="signup"><SignupForm /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Bem-vindo!");
  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="li-email">E-mail</Label>
        <Input id="li-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="li-pwd">Senha</Label>
        <Input id="li-pwd" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy}>
        {busy ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

function SignupForm() {
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", cnh: "",
    perfil: "motorista_autonomo" as Perfil,
    password: "", confirm: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: parsed.data.nome,
          telefone: unmask(parsed.data.telefone || "") || null,
          cnh: unmask(parsed.data.cnh || "") || null,
          perfil: parsed.data.perfil,
        },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Conta criada! Faça login.");
  };

  return (
    <form onSubmit={submit} className="space-y-3 mt-4">
      <div className="space-y-1">
        <Label>Tipo de conta</Label>
        <Select value={form.perfil} onValueChange={(v) => setForm({ ...form, perfil: v as Perfil })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="frota">Dono de Frota</SelectItem>
            <SelectItem value="motorista_autonomo">Motorista Autônomo</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Motoristas vinculados são cadastrados pelo dono da frota.
        </p>
      </div>
      <div className="space-y-1">
        <Label>Nome completo</Label>
        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
      </div>
      <div className="space-y-1">
        <Label>E-mail</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Telefone</Label>
          <Input
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
            placeholder="(99) 9 9999-9999"
          />
        </div>
        <div className="space-y-1">
          <Label>CNH</Label>
          <Input
            value={form.cnh}
            onChange={(e) => setForm({ ...form, cnh: maskCNH(e.target.value) })}
            placeholder="99999999999"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Senha</Label>
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label>Confirmar senha</Label>
          <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
        </div>
      </div>
      <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy}>
        {busy ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
