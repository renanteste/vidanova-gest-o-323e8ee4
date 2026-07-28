const KEY = "vn:last-path";

export function recordLastPath(path: string) {
  if (typeof window === "undefined") return;
  if (path.startsWith("/enviar-sugestao")) return;
  try {
    window.sessionStorage.setItem(KEY, path);
  } catch {
    /* ignore */
  }
}

export function getLastPath(): string {
  if (typeof window === "undefined") return "/";
  try {
    return window.sessionStorage.getItem(KEY) ?? "/";
  } catch {
    return "/";
  }
}
