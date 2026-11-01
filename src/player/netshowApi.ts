import {supabase} from '../auth/client';
import {previewEnabled,previewFetch} from './frontendPreview';
/** Keep one API origin across browser and installed iOS app.
 * In a browser the API is same-origin; a bundled native build MUST configure
 * VITE_NETSHOW_API_BASE=https://your-netshow-backend.example when building.
 * No provider credentials are stored in app bundles.
 */
import { Capacitor } from '@capacitor/core';

export function getApiBase(): string {
  const specified = (import.meta.env.VITE_NETSHOW_API_BASE || '').trim().replace(/\/+$/, '');
  if (specified) {
    const parsed = new URL(specified);
    if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.hostname === 'localhost')) {
      throw new Error('NetShow API must use HTTPS on installed devices.');
    }
    return parsed.origin + parsed.pathname.replace(/\/$/, '');
  }
  if (Capacitor.isNativePlatform()) {
    throw new Error('Installed app needs VITE_NETSHOW_API_BASE pointing to your HTTPS NetShow backend.');
  }
  return window.location.origin;
}

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) throw new Error('API paths must start with /');
  return `${getApiBase()}${path}`;
}

export function resolveMediaUrl(value: string): string {
  if (value.startsWith('/')) return apiUrl(value);
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(import.meta.env.DEV && url.hostname === 'localhost')) {
    throw new Error('Playback requires a secure HTTPS stream on installed devices.');
  }
  return url.href;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers=new Headers(init?.headers);
  if(supabase){const {data}=await supabase.auth.getSession();if(data.session)headers.set('Authorization',`Bearer ${data.session.access_token}`);}
  if(previewEnabled()&&!supabase)return previewFetch(path,init);
  const response=await fetch(apiUrl(path),{...init,headers});
  // A revision conflict means the transaction made no changes; reload and retry once.
  if(supabase&&response.status===409&&typeof init?.body==='string')return fetch(apiUrl(path),{...init,headers});
  return response;
}
