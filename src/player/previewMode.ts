export function previewEnabled(){return import.meta.env.PROD&&!import.meta.env.VITE_NETSHOW_API_BASE&&location.hostname.endsWith('.vercel.app');}
