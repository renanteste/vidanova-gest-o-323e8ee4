import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, perfilLabel } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, Save } from "lucide-react";
import { maskTelefone, maskCNH, unmask } from "@/lib/masks";

export const Route = createFileRoute("/perfil")({
  component: () => (
    <RequireAuth>
      <PerfilPage />
    </RequireAuth>
  ),
});

const profileSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(120),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  cnh: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255),
});

function initials(nome?: string | null) {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function PerfilPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cnh, setCnh] = useState("");
  const [email, setEmail] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setTelefone(maskTelefone(profile.telefone ?? ""));
      setCnh(maskCNH(profile.cnh ?? ""));
      setFoto(((profile as any).foto_url as string) ?? null);
    }
    if (user) setEmail(user.email ?? "");
  }, [profile, user]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = profileSchema.safeParse({ nome, telefone, cnh, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSavingProfile(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          nome: parsed.data.nome,
          telefone: unmask(parsed.data.telefone || "") || null,
          cnh: unmask(parsed.data.cnh || "") || null,
        })
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      if (parsed.data.email && parsed.data.email !== user.email) {
        const { error: eErr } = await supabase.auth.updateUser({ email: parsed.data.email });
        if (eErr) throw eErr;
        toast.success("Verifique seu novo e-mail para confirmar a alteração.");
      } else {
        toast.success("Perfil atualizado!");
      }
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("Senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("Senhas não conferem");
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha alterada com sucesso!");
      setPwd("");
      setPwd2("");
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5 MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/profile.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ foto_url: url })
        .eq("user_id", user.id);
      if (dbErr) throw dbErr;
      setFoto(url);
      await refreshProfile();
      toast.success("Foto atualizada!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  if (!profile) return null;

  return (
    <AppShell title="Meu perfil">
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foto de perfil</CardTitle>
            <CardDescription>JPG ou PNG, até 5 MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="h-32 w-32 border">
              {foto ? <AvatarImage src={foto} alt={profile.nome} /> : null}
              <AvatarFallback className="text-2xl font-semibold bg-muted">
                {initials(profile.nome)}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPickFile}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…</>
              ) : (
                <><Camera className="h-4 w-4 mr-2" /> Alterar foto</>
              )}
            </Button>
            <div className="w-full text-center">
              <div className="text-sm font-medium">{profile.nome}</div>
              <div className="text-xs text-muted-foreground">{perfilLabel[profile.perfil]}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurações da conta</CardTitle>
            <CardDescription>Atualize seus dados e segurança.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="dados">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="dados">Dados pessoais</TabsTrigger>
                <TabsTrigger value="seguranca">Segurança</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="pt-6">
                <form onSubmit={onSaveProfile} className="space-y-4 max-w-xl">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tel">Telefone</Label>
                      <Input
                        id="tel"
                        value={telefone}
                        onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                        placeholder="(99) 9 9999-9999"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnh">CNH</Label>
                      <Input
                        id="cnh"
                        value={cnh}
                        onChange={(e) => setCnh(maskCNH(e.target.value))}
                        placeholder="99999999999"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Ao trocar o e-mail, será necessário confirmá-lo pelo link enviado.
                    </p>
                  </div>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Salvar alterações</>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="seguranca" className="pt-6">
                <form onSubmit={onChangePassword} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="pwd">Nova senha</Label>
                    <Input
                      id="pwd"
                      type="password"
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pwd2">Confirmar senha</Label>
                    <Input
                      id="pwd2"
                      type="password"
                      value={pwd2}
                      onChange={(e) => setPwd2(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={savingPwd}>
                    {savingPwd ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Atualizando…</>
                    ) : (
                      "Alterar senha"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
