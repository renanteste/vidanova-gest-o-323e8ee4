
CREATE TYPE public.rota_status AS ENUM ('disponivel', 'finalizada');
CREATE TYPE public.interesse_status AS ENUM ('pendente', 'aprovado', 'rejeitado');

CREATE TABLE public.rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra TEXT NOT NULL,
  material TEXT NOT NULL,
  origem_endereco TEXT NOT NULL,
  origem_complemento TEXT,
  destino_endereco TEXT NOT NULL,
  destino_complemento TEXT,
  preco_por_m3 NUMERIC(10,2) NOT NULL CHECK (preco_por_m3 > 0),
  horario_previsto TIMESTAMPTZ NOT NULL,
  distancia_km NUMERIC(10,2),
  status public.rota_status NOT NULL DEFAULT 'disponivel',
  criada_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages all routes" ON public.rotas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "frota creates own routes" ON public.rotas
  FOR INSERT TO authenticated
  WITH CHECK (criada_por = auth.uid() AND has_role(auth.uid(), 'frota'::app_role));

CREATE POLICY "creator reads own routes" ON public.rotas
  FOR SELECT TO authenticated
  USING (criada_por = auth.uid());

CREATE POLICY "creator updates own routes" ON public.rotas
  FOR UPDATE TO authenticated
  USING (criada_por = auth.uid())
  WITH CHECK (criada_por = auth.uid());

CREATE POLICY "drivers read available routes" ON public.rotas
  FOR SELECT TO authenticated
  USING (
    status = 'disponivel' AND (
      has_role(auth.uid(), 'motorista_autonomo'::app_role)
      OR has_role(auth.uid(), 'motorista_vinculado'::app_role)
    )
  );

CREATE TRIGGER trg_rotas_updated_at
  BEFORE UPDATE ON public.rotas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.interesses_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  motorista_id UUID NOT NULL,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  status public.interesse_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rota_id, motorista_id)
);

ALTER TABLE public.interesses_rotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages all interests" ON public.interesses_rotas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "driver creates own interest" ON public.interesses_rotas
  FOR INSERT TO authenticated
  WITH CHECK (
    motorista_id = auth.uid() AND (
      has_role(auth.uid(), 'motorista_autonomo'::app_role)
      OR has_role(auth.uid(), 'motorista_vinculado'::app_role)
    )
  );

CREATE POLICY "driver reads own interests" ON public.interesses_rotas
  FOR SELECT TO authenticated
  USING (motorista_id = auth.uid());

CREATE POLICY "route creator reads interests" ON public.interesses_rotas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.criada_por = auth.uid()));

CREATE POLICY "route creator updates interests" ON public.interesses_rotas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.criada_por = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.criada_por = auth.uid()));

CREATE POLICY "driver cancels own pending interest" ON public.interesses_rotas
  FOR DELETE TO authenticated
  USING (motorista_id = auth.uid() AND status = 'pendente');

CREATE TRIGGER trg_interesses_updated_at
  BEFORE UPDATE ON public.interesses_rotas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_rotas_status ON public.rotas(status);
CREATE INDEX idx_interesses_rota ON public.interesses_rotas(rota_id);
CREATE INDEX idx_interesses_motorista ON public.interesses_rotas(motorista_id);
