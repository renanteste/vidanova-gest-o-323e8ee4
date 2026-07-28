CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usuario_id UUID NOT NULL,
  nome_usuario TEXT,
  email_usuario TEXT,
  perfil_usuario TEXT,
  pagina TEXT,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Novo',
  resolucao TEXT
);

GRANT SELECT, INSERT, UPDATE ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated creates own feedback"
ON public.feedbacks FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "user reads own feedback"
ON public.feedbacks FOR SELECT TO authenticated
USING (usuario_id = auth.uid());

CREATE POLICY "admin reads all feedbacks"
ON public.feedbacks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin updates feedbacks"
ON public.feedbacks FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_feedbacks_updated_at
BEFORE UPDATE ON public.feedbacks
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();