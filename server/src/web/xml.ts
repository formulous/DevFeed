const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export function xmlText(value: string): string {
  return value.replace(INVALID_XML, '').replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
