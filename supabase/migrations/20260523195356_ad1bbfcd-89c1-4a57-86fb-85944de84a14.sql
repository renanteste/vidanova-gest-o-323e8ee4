
-- Enum for roles/perfil
CREATE TYPE public.app_role AS ENUM ('admin', 'frota', 'motorista_autonomo', 'motorista_vinculado');

-- profiles table
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil public.app_role NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  cnh TEXT,
  fk_frota_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  veiculo_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles table (separate, for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- veiculos table
CREATE TABLE public.veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placa TEXT NOT NULL UNIQUE,
  modelo TEXT NOT NULL,
  capacidade_m3 NUMERIC(10,2) NOT NULL CHECK (capacidade_m3 > 0),
  tipo_cacamba TEXT NOT NULL,
  foto_url TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper to read current user's perfil from profiles (no recursion: profiles has no role-based policy that needs perfil)
CREATE OR REPLACE FUNCTION public.get_perfil(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil FROM public.profiles WHERE user_id = _user_id
$$;

-- Helper: fk_frota_id of a user
CREATE OR REPLACE FUNCTION public.get_frota_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fk_frota_id FROM public.profiles WHERE user_id = _user_id
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_veiculos_updated_at BEFORE UPDATE ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup based on user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil public.app_role;
BEGIN
  v_perfil := COALESCE((NEW.raw_user_meta_data->>'perfil')::public.app_role, 'motorista_autonomo');

  INSERT INTO public.profiles (user_id, perfil, nome, telefone, cnh, fk_frota_id)
  VALUES (
    NEW.id,
    v_perfil,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.raw_user_meta_data->>'telefone',
    NEW.raw_user_meta_data->>'cnh',
    NULLIF(NEW.raw_user_meta_data->>'fk_frota_id', '')::UUID
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_perfil);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fleet owners read their drivers" ON public.profiles
  FOR SELECT TO authenticated
  USING (fk_frota_id = auth.uid());

CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin updates any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only fleet owner can insert vinculado motorista rows (besides the trigger which uses SECURITY DEFINER)
CREATE POLICY "fleet owner can insert linked drivers" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    perfil = 'motorista_vinculado'
    AND fk_frota_id = auth.uid()
    AND public.has_role(auth.uid(), 'frota')
  );

-- user_roles policies
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- veiculos policies
CREATE POLICY "admin reads all vehicles" ON public.veiculos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owner reads own vehicles" ON public.veiculos
  FOR SELECT TO authenticated
  USING (proprietario_id = auth.uid());

CREATE POLICY "linked driver reads fleet vehicles" ON public.veiculos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'motorista_vinculado')
    AND proprietario_id = public.get_frota_id(auth.uid())
  );

CREATE POLICY "fleet owner inserts vehicle" ON public.veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    proprietario_id = auth.uid()
    AND public.has_role(auth.uid(), 'frota')
  );

CREATE POLICY "autonomous driver inserts one vehicle" ON public.veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    proprietario_id = auth.uid()
    AND public.has_role(auth.uid(), 'motorista_autonomo')
    AND NOT EXISTS (SELECT 1 FROM public.veiculos WHERE proprietario_id = auth.uid())
  );

CREATE POLICY "owner updates own vehicle" ON public.veiculos
  FOR UPDATE TO authenticated
  USING (proprietario_id = auth.uid())
  WITH CHECK (proprietario_id = auth.uid());

CREATE POLICY "owner deletes own vehicle" ON public.veiculos
  FOR DELETE TO authenticated
  USING (proprietario_id = auth.uid());

-- Storage bucket for vehicle photos
INSERT INTO storage.buckets (id, name, public) VALUES ('veiculos', 'veiculos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read vehicle photos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'veiculos');

CREATE POLICY "Authenticated upload vehicle photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'veiculos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner updates vehicle photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'veiculos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner deletes vehicle photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'veiculos' AND (storage.foldername(name))[1] = auth.uid()::text);
