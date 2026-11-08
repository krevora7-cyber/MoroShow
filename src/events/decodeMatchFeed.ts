// Decodes the match feed format currently used by the public Yacinews page.
const keyBase64 = "vqW3n/yB1R+GwSPc4kJs2dCkV7kRmXaNy3lQ/3XkHJI=";
const ordinaryAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const feedAlphabet = "MiljRIn9PX1o63wGBYTtFsKmEkSur-pC_U02cvzAdy5e8ZqLDgJ4OhVN7QbHxfWa";

export async function decodeMatchFeed(raw: string): Promise<any> {
  if (!raw.startsWith('k1')) return JSON.parse(raw);
  const mapped = [...raw.slice(2)].reverse().map(char => {
    const position = feedAlphabet.indexOf(char);
    if (position < 0) throw new Error('Unsupported match feed format');
    return ordinaryAlphabet[position];
  }).join('').replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(mapped.padEnd(Math.ceil(mapped.length / 4) * 4, '='));
  const payload = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (payload.length < 29) throw new Error('Incomplete match feed');
  const rawKey = Uint8Array.from(atob(keyBase64), char => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({name:'AES-GCM', iv:payload.slice(0,12)}, key, payload.slice(12));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
