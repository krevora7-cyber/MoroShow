export function previewEnabled() {
  return import.meta.env.PROD &&
    import.meta.env.VITE_MOROSHOW_INTERFACE_PREVIEW === 'true' &&
    !import.meta.env.VITE_NETSHOW_API_BASE;
}
