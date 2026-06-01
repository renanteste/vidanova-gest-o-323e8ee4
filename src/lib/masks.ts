// Máscaras simples para telefone e CNH brasileiros.

export function maskTelefone(value: string): string {
  const d = (value || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

export function maskCNH(value: string): string {
  return (value || "").replace(/\D/g, "").slice(0, 11);
}

export function unmask(value: string): string {
  return (value || "").replace(/\D/g, "");
}
