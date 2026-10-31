import { config } from '../utils/config.js';
import { getToken } from '../utils/token.js';
import { buildHeaders, buildWebficHeaders } from '../utils/client.js';
import { httpRequestWithRetry, delay } from './http.js';

export async function sapiRequest(endpoint, payload = {}, language = config.defaultLanguage, attempt = 0) {
    const timestamp = Date.now();

    let tokenData;
    try {
        tokenData = await getToken(language);
    } catch (error) {
        if (attempt < config.maxRetries && !/HTTP (401|403)/.test(error.message || '')) {
            await delay(1000 * (attempt + 1));
            return sapiRequest(endpoint, payload, language, attempt + 1);
        }
        throw error;
    }

    const headers = buildHeaders(tokenData, timestamp, payload, language);
    const url = `${config.baseUrl}${endpoint}?timestamp=${timestamp}`;

    try {
        const response = await httpRequestWithRetry(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        const responseData = JSON.parse(response.body);

        if (responseData && responseData.success === false) {
            if (responseData.code === 401 || responseData.message?.includes('token')) {
                if (attempt === 0) {
                    const tokenCache = await import('../utils/token.js');
                    tokenCache.clearTokenCache();
                    await delay(1000);
                    return sapiRequest(endpoint, payload, language, 1);
                }
            }
            throw new Error(responseData.message || 'API request failed');
        }

        return responseData;
    } catch (error) {
        if (attempt < config.maxRetries && !/HTTP (401|403)/.test(error.message || '')) {
            await delay(1000 * (attempt + 1));
            return sapiRequest(endpoint, payload, language, attempt + 1);
        }
        throw error;
    }
}

export async function webficRequest(endpoint, payload = {}, method = 'POST', language = config.defaultLanguage) {
    const headers = buildWebficHeaders(language);
    const url = `${config.webficUrl}${endpoint}`;

    const options = {
        method: method,
        headers: headers
    };

    if (method.toUpperCase() !== 'GET') {
        options.body = JSON.stringify(payload);
    }

    const response = await httpRequestWithRetry(url, options);
    return JSON.parse(response.body);
}

/**
 * @deprecated regexd.com no longer resolves (DNS failure) and is not coming
 * back. This function will always throw. It's kept only so it doesn't break
 * anyone importing it directly; it is not used anywhere else in this
 * library anymore (see getStreamUrl in core/dramabox.js, which now sources
 * video data from the chapters endpoint instead). Do not build new features
 * on top of this - it will be removed in a future major version.
 */
export async function regexdRequest(bookId, episode, language = config.defaultLanguage) {
    const url = config.regexdUrl;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${url}?bookId=${bookId}`
    };

    const queryParams = new URLSearchParams({
        ajax: '1',
        bookId: bookId,
        lang: language,
        episode: episode
    });

    const fullUrl = `${url}?${queryParams.toString()}`;

    const response = await httpRequestWithRetry(fullUrl, {
        method: 'GET',
        headers: headers
    });

    return JSON.parse(response.body);
}