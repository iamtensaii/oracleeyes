/**
 * Decode CSV bytes — MetaTrader 5 often exports UTF-16 LE with BOM.
 */
export function decodeCsvText(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let text: string;
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(buf);
  } else if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(buf);
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  }
  return text.replace(/^\uFEFF/, "");
}
