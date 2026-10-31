export const config = {
    baseUrl: 'https://sapi.dramaboxdb.com',
    webficUrl: 'https://www.webfic.com',
    // @deprecated - regexd.com no longer resolves and is not coming back.
    // Kept only so getConfig() / updateConfig() don't break for anyone
    // depending on this key existing. Nothing in this library calls it.
    regexdUrl: 'https://regexd.com/base.php',
    defaultLanguage: 'in',
    version: '490',
    userAgent: 'okhttp/4.10.0',
    timeout: 30000,
    maxRetries: 3,
    cacheTTL: 300,
    tokenCacheTTL: 3600,
    requestDelay: 1000
};

export function getConfig() {
    return { ...config };
}

export function updateConfig(newConfig) {
    Object.assign(config, newConfig);
}
