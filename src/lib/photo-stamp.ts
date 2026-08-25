// Composição visual (somente para exibição/exportação) da foto da viagem com
// as informações da viagem sobrepostas. O arquivo original no Storage NÃO é
// alterado — a composição é gerada em memória via canvas.

export type StampField = { label: string; value?: string | null };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = url;
  });
}

/**
 * Retorna um dataURL (JPEG) da foto com um painel de informações no topo.
 * Em caso de falha (CORS, imagem inválida), retorna null para que o chamador
 * use a imagem original normalmente.
 */
export async function stampPhoto(url: string, fields: StampField[]): Promise<string | null> {
  if (typeof document === "undefined" || !url) return null;
  const lines = fields
    .filter((f) => f.value != null && String(f.value).trim() !== "")
    .map((f) => `${f.label.toUpperCase()}: ${String(f.value).trim()}`);
  if (!lines.length) return null;

  try {
    const img = await loadImage(url);
    // Mantém a proporção original; apenas normaliza a largura para o texto ficar legível.
    const targetW = Math.min(1280, Math.max(720, img.naturalWidth || 1024));
    const scale = targetW / (img.naturalWidth || targetW);
    const w = Math.round(targetW);
    const h = Math.round((img.naturalHeight || targetW) * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    const pad = Math.round(w * 0.018);
    const fontSize = Math.max(13, Math.round(w * 0.021));
    const lineH = Math.round(fontSize * 1.45);
    ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = "top";

    // quebra de linha simples para caber na largura
    const maxTextW = w - pad * 4;
    const wrapped: string[] = [];
    for (const line of lines) {
      if (ctx.measureText(line).width <= maxTextW) { wrapped.push(line); continue; }
      let cur = "";
      for (const word of line.split(" ")) {
        const next = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(next).width > maxTextW && cur) { wrapped.push(cur); cur = word; }
        else cur = next;
      }
      if (cur) wrapped.push(cur);
    }

    const panelH = wrapped.length * lineH + pad * 2;
    ctx.fillStyle = "rgba(15, 23, 42, 0.68)";
    ctx.fillRect(0, 0, w, panelH);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(0, panelH, w, Math.max(2, Math.round(w * 0.003)));

    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 3;
    wrapped.forEach((line, i) => {
      ctx.fillText(line, pad * 2, pad + i * lineH);
    });
    ctx.shadowBlur = 0;

    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}
