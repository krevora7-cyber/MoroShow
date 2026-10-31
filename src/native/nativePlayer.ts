import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface NativePlayerPlugin {
  play(options: { url: string; title?: string; startAt?: number; isLive?: boolean }): Promise<{ opened: boolean }>;
  stop(): Promise<void>;
  addListener(event: 'closed' | 'progress' | 'playerError', callback: (detail: any) => void): Promise<PluginListenerHandle>;
}

const nativePlayer = registerPlugin<NativePlayerPlugin>('NetShowNativePlayer');

export function isNativeIOS(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function playNative(options: { url: string; title?: string; startAt?: number; isLive?: boolean }) {
  if (!isNativeIOS()) throw new Error('The NetShow native player only runs inside the installed iPhone app.');
  return nativePlayer.play(options);
}

export const nativePlayerEvents = nativePlayer;
