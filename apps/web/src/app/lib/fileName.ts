export const toSafeFileName = (name: string) => {
  const extMatch = name.match(/\.([^.]+)$/);
  const ext = extMatch ? `.${extMatch[1]}` : "";
  const base = name.replace(/\.[^.]+$/, "");
  const safeBase = base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safeExt = ext.replace(/[^\w.]+/g, "");
  return `${safeBase || "file"}${safeExt}`;
};
