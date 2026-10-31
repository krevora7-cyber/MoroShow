import NodeCache from 'node-cache';
import { config } from '../utils/config.js';
import { sapiRequest, webficRequest, regexdRequest } from '../client/request.js';
import { getToken as getTokenUtil, clearTokenCache } from '../utils/token.js';

export class BaseClient {
    constructor(options = {}) {
        this.language = options.language || config.defaultLanguage;
        this.timeout = options.timeout || config.timeout;
        this.maxRetries = options.maxRetries || config.maxRetries;
        this.requestDelay = options.requestDelay || config.requestDelay;

        this.cache = new NodeCache({
            stdTTL: options.cacheTTL || config.cacheTTL,
            checkperiod: 60,
            useClones: false
        });
    }

    async getToken() {
        return getTokenUtil(this.language);
    }

    async sapiRequest(endpoint, payload) {
        return sapiRequest(endpoint, payload, this.language);
    }

    async webficRequest(endpoint, payload, method = 'POST') {
        return webficRequest(endpoint, payload, method, this.language);
    }

    /**
     * @deprecated regexd.com no longer resolves and is not coming back.
     * Calling this will always throw. Kept for backward compatibility only.
     */
    async regexdRequest(bookId, episode) {
        return regexdRequest(bookId, episode, this.language);
    }

    getCacheKey(prefix, ...parts) {
        return `${prefix}_${parts.join('_')}_${this.language}`;
    }

    getCached(key) {
        return this.cache.get(key);
    }

    setCached(key, data, ttl = config.cacheTTL) {
        this.cache.set(key, data, ttl);
    }

    clearCache() {
        this.cache.flushAll();
        clearTokenCache();
    }

    getCacheStats() {
        return this.cache.getStats();
    }

    buildResponse(success, data = null, message = null, metadata = {}) {
        return {
            success,
            creator: 'zhadevv',
            data,
            metadata,
            message
        };
    }

    handleError(error, context) {
        let message = `Failed to ${context}`;
        if (error.statusCode) {
            message = `HTTP ${error.statusCode}: ${context}`;
        } else if (error.message) {
            message = `${context}: ${error.message}`;
        }
        return this.buildResponse(false, null, message);
    }
}
