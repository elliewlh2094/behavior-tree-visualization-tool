// Append `.png` unless the name already ends in a lowercase `.png`. The check
// is case-sensitive by design (per v1.9 spec §106): `MyTree.PNG` becomes
// `MyTree.PNG.png` so the download always carries a canonical lowercase
// extension. Empty-name rejection lives in the modal (Export stays disabled).
export function ensurePngExtension(name: string): string {
  return name.endsWith('.png') ? name : `${name}.png`;
}
