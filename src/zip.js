/* Minimal ZIP writer (store/no-compression mode). Keeps EcoSurvey exports in one
   portable archive without a third-party dependency. */
const encoder = new TextEncoder();

let crcTable = null;
function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
}
function crc32(bytes) {
  if (!crcTable) crcTable = buildCrcTable();
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getSeconds() >> 1) | (date.getMinutes() << 5) | (date.getHours() << 11);
  const dosDate = date.getDate() | ((date.getMonth() + 1) << 5) | ((year - 1980) << 9);
  return { dosTime, dosDate };
}
function u16(value) { const out = new Uint8Array(2); new DataView(out.buffer).setUint16(0, value, true); return out; }
function u32(value) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value >>> 0, true); return out; }
function join(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function asBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return encoder.encode(String(content));
}

export function createZip(entries) {
  const localParts = []; const centralParts = []; let offset = 0; const stamp = dosDateTime();
  for (const entry of entries) {
    const name = encoder.encode(entry.name.replaceAll('\\', '/'));
    const data = asBytes(entry.content);
    const checksum = crc32(data);
    const local = join([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(stamp.dosTime), u16(stamp.dosDate),
      u32(checksum), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data
    ]);
    localParts.push(local);
    const central = join([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(stamp.dosTime), u16(stamp.dosDate),
      u32(checksum), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), name
    ]);
    centralParts.push(central);
    offset += local.length;
  }
  const centralDirectory = join(centralParts);
  const end = join([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralDirectory.length), u32(offset), u16(0)
  ]);
  return new Blob([join([...localParts, centralDirectory, end])], { type: 'application/zip' });
}
