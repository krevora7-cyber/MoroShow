import type { CapacitorConfig } from '@capacitor/cli';
// Installed iOS app has bundled UI; it is NOT a Safari website wrapper.
// REST API origin is set at build time via VITE_NETSHOW_API_BASE (https only).
const config: CapacitorConfig = {
  appId: 'com.netshow.app',
  appName: 'MoroShow',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  ios: { contentInset: 'never' }
};
export default config;
