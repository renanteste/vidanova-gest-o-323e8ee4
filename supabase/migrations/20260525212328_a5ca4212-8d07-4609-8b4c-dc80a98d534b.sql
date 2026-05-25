
-- Adiciona coluna ativo em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Tabela viagens
CREATE TABLE public.viagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id),
  motorista_id uuid NOT NULL,
  inicio_em timestamptz NOT NULL DEFAULT now(),
  fim_em timestamptz,
  foto_inicio_url text NOT NULL,
  foto_fim_url text,
  lat_inicio numeric NOT NULL,
  lng_inicio numeric NOT NULL,
  lat_fim numeric,
  lng_fim numeric,
  valor_frete numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_viagens_updated_at
BEFORE UPDATE ON public.viagens
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.viagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages all viagens" ON public.viagens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "motorista creates own viagem" ON public.viagens
  FOR INSERT TO authenticated
  WITH CHECK (motorista_id = auth.uid());

CREATE POLICY "motorista updates own viagem" ON public.viagens
  FOR UPDATE TO authenticated
  USING (motorista_id = auth.uid())
  WITH CHECK (motorista_id = auth.uid());

CREATE POLICY "motorista reads own viagens" ON public.viagens
  FOR SELECT TO authenticated
  USING (motorista_id = auth.uid());

CREATE POLICY "rota creator reads viagens" ON public.viagens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = viagens.rota_id AND r.criada_por = auth.uid()));

-- Bucket viagens
INSERT INTO storage.buckets (id, name, public) VALUES ('viagens', 'viagens', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "viagens fotos publicas leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'viagens');

CREATE POLICY "motoristas enviam fotos viagens" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'viagens');

CREATE POLICY "motoristas atualizam fotos viagens" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'viagens');
