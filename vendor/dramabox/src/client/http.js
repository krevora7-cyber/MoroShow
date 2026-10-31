import { config } from '../utils/config.js';

let lastRequestTime = 0;
const isBrowser = typeof window !== 'undefined' && typeof window.fetch === 'function';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

export async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function applyRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < config.requestDelay) {
        await delay(config.requestDelay - elapsed);
    }
    lastRequestTime = Date.now();
}

// The upstream API sits behind a WAF that fingerprints the TLS handshake.
// Node's default OpenSSL cipher list produces a fingerprint that this WAF
// treats as suspicious and intermittently blocks. This exact cipher suite /
// secureProtocol combo (matching the mobile client's TLS profile) is what a
// known-working reference implementation uses via Node's native `https`
// module, so requests go through `https` directly instead of a third-party
// client - avoids any mismatch in how another library applies these
// low-level TLS connect options.
let nodeHttpsAgent = null;
async function getNodeHttpsAgent() {
    if (nodeHttpsAgent) return nodeHttpsAgent;
    const https = await import('https');
    nodeHttpsAgent = new https.Agent({
        keepAlive: true,
        proxyEnv: process.env,
        rejectUnauthorized: true,
        ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
        secureProtocol: 'TLS_method'
    });
    return nodeHttpsAgent;
}

async function decodeBody(buffer, contentEncoding = '') {
    const encoding = String(contentEncoding || '').toLowerCase();
    const zlib = await import('zlib');
    try {
        if (encoding.includes('br')) return zlib.brotliDecompressSync(buffer).toString('utf8');
        if (encoding.includes('gzip')) return zlib.gunzipSync(buffer).toString('utf8');
        if (encoding.includes('deflate')) return zlib.inflateSync(buffer).toString('utf8');
    } catch (e) {
        // Some responses (e.g. WAF block pages) claim an encoding but
        // aren't actually compressed - fall back to raw text below.
    }
    return buffer.toString('utf8');
}

async function nodeHttpsRequest(url, options) {
    const https = await import('https');
    const agent = await getNodeHttpsAgent();
    const parsed = new URL(url);

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: `${parsed.pathname}${parsed.search}`,
            method: options.method,
            headers: options.headers,
            agent,
            timeout: options.timeout
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                const body = await decodeBody(buffer, res.headers['content-encoding']);
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body
                });
            });
            res.on('error', reject);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(Object.assign(new Error(`Request timeout after ${options.timeout}ms`), { name: 'AbortError' }));
        });

        const deadline = setTimeout(() => req.destroy(Object.assign(new Error('Request timeout'), {name:'AbortError'})), options.timeout);
        req.once('close', () => clearTimeout(deadline));
        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

export async function httpRequest(url, options = {}) {
    await applyRateLimit();

    const defaultOptions = {
        method: 'GET',
        headers: {},
        timeout: config.timeout
    };

    const mergedOptions = { ...defaultOptions, ...options };

    try {
        let response;
        let body;
        let statusCode;
        let headers;

        if (isBrowser) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), mergedOptions.timeout);

            const fetchOptions = {
                method: mergedOptions.method,
                headers: mergedOptions.headers,
                signal: controller.signal
            };

            if (mergedOptions.body) {
                fetchOptions.body = mergedOptions.body;
            }

            response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            body = await response.text();
            statusCode = response.status;
            headers = response.headers;
        } else if (isNode) {
            response = await nodeHttpsRequest(url, mergedOptions);
            body = response.body;
            statusCode = response.statusCode;
            headers = response.headers;
        } else {
            throw new Error('Unsupported environment');
        }

        if (statusCode >= 300 && statusCode < 400) {
            const location = (headers && (headers.location || headers.get?.('location'))) || '(no location header)';
            throw new Error(`HTTP ${statusCode} redirect to ${location} - request was likely intercepted before reaching the API`);
        }

        if (statusCode >= 400) {
            const preview = body ? body.substring(0, 200) : '(empty body)';
            throw new Error(`HTTP ${statusCode}: ${preview}`);
        }

        if (!body || body.trim().length === 0) {
            throw new Error(`HTTP ${statusCode}: empty response body (request may have been silently blocked)`);
        }

        return {
            statusCode,
            headers,
            body
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${mergedOptions.timeout}ms`);
        }
        if (error.statusCode) {
            throw new Error(`HTTP ${error.statusCode}: ${error.message}`);
        }
        throw error;
    }
}

export async function httpRequestWithRetry(url, options = {}, maxRetries = config.maxRetries) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await httpRequest(url, options);
        } catch (error) {
            lastError = error;
            if (/HTTP (401|403)/.test(error.message || '')) throw error;
            if (attempt < maxRetries) {
                const waitTime = 1000 * (attempt + 1);
                await delay(waitTime);
            }
        }
    }

    throw lastError || new Error('Max retries reached');
}
