import {supabase} from '../auth/client';
import {previewEnabled} from './previewMode';
import {isVodPreview,isXtreamPreview} from './vodPreview';
/** Keep one API origin across browser and installed iOS app.
 * In a browser the API is same-origin; a bundled native build MUST configure
 * VITE_NETSHOW_API_BASE=https://your-netshow-backend.example when building.
 * No provider credentials are stored in app bundles.
 */
import { Capacitor } from '@capacitor/core';

export function getApiBase(): string {
  if (!Capacitor.isNativePlatform() && isVodPreview()) return window.location.origin;
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
  if (isXtreamPreview() && !Capacitor.isNativePlatform()) {
    const series = /^\/api\/(?:series\/([^/]+)\/episodes|media\/([^/]+)\/artwork)(\?.*)?$/.exec(path);
    const id = series?.[1] || series?.[2];
    if (id && decodeURIComponent(id).startsWith('drama:freereels-')) {
      const params = new URLSearchParams(series?.[3]);
      try {
        if (localStorage.getItem('moroshow-freereels-language') === 'ar') params.set('lang', 'ar');
      } catch {}
      path = '/api/shorts-router/series/' + id + '?' + params;
    } else if (path === '/api/stream/token' && typeof init?.body === 'string' &&
      String(JSON.parse(init.body).contentId).startsWith('drama:freereels-')) {
      path = '/api/shorts-router/play';
    }
  }

  const headers=new Headers(init?.headers);
  if(supabase){const {data}=await supabase.auth.getSession();if(data.session)headers.set('Authorization',`Bearer ${data.session.access_token}`);}
  if(!isVodPreview()&&previewEnabled()&&!supabase)return (await import('./frontendPreview')).previewFetch(path,init);
  let response=await fetch(apiUrl(path),{...init,headers});
  // A revision conflict means the transaction made no changes; reload and retry once.
  if(supabase&&response.status===409&&typeof init?.body==='string')response=await fetch(apiUrl(path),{...init,headers});
  if (response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    throw new Error('The MoroShow server returned a web page instead of an API response. Try again in a moment.');
  }
  return response;
}
