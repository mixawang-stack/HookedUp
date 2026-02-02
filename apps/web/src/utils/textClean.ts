export function cleanNovelText(input: string) {
  if (!input) return input;

  return input
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00AD/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

export function dumpWeirdChars(s: string) {
  const weird: Array<{ index: number; code: string }> = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.codePointAt(i)!;
    const isWeird =
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x200b && code <= 0x200f) ||
      code === 0xfeff ||
      code === 0xfffd ||
      code === 0x00ad ||
      (code >= 0xe000 && code <= 0xf8ff);
    if (isWeird) {
      weird.push({ index: i, code: "U+" + code.toString(16).toUpperCase() });
    }
  }
  return weird;
}
