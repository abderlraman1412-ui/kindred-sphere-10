import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.taipingmedia',
  appName: 'TAIPING MEDIA',
  webDir: 'dist',
  server: {
    url: 'https://4c6c002b-578c-4a8d-bbed-bb33983a67f4.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
