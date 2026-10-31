import crypto from 'crypto';
import NodeCache from 'node-cache';
import { config } from '../utils/config.js';
import { signString } from './sign.js';
import { httpRequest } from '../client/http.js';

const tokenCache = new NodeCache({
    stdTTL: config.tokenCacheTTL,
    checkperiod: 120,
    useClones: false
});

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function randomAndroidId() {
    return '00000000' + crypto.randomBytes(8).toString('hex') + '00000000';
}

export function getLocalTime() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const millis = now.getMilliseconds().toString().padStart(3, '0');
    const offset = 7 * 60;
    const local = new Date(now.getTime() + offset * 60000);
    return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}.${millis} +0700`;
}

export async function generateToken(language = config.defaultLanguage) {
    const cacheKey = `token_${language}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached;
    }

    const timestamp = Date.now();
    const deviceId = generateUUID();
    const androidId = randomAndroidId();
    const instanceId = crypto.randomBytes(16).toString('hex');
    const afid = `${timestamp}-${Math.floor(Math.random() * 9999999999999999)}`;
    const ins = Date.now().toString();

    const payload = { distinctId: null };
    const body = JSON.stringify(payload);
    const signPayload = `timestamp=${timestamp}${body}${deviceId}${androidId}`;
    const sn = signString(signPayload);

    if (!sn) {
        throw new Error('Failed to generate signature');
    }

    const headers = {
        'accept-encoding': 'gzip',
        'active-time': String(Math.floor(Math.random() * 60000)),
        'afid': afid,
        'android-id': androidId,
        'apn': '0',
        'brand': 'Xiaomi',
        'build': 'Build/QQ3A.200805.001',
        'cid': 'DAUAG1064236',
        'content-type': 'application/json; charset=UTF-8',
        'country-code': 'ID',
        'current-language': language,
        'device-id': deviceId,
        'device-score': '55',
        'host': 'sapi.dramaboxdb.com',
        'ins': ins,
        'instanceid': instanceId,
        'is_emulator': '0',
        'is_root': '1',
        'is_vpn': '1',
        'language': language,
        'lat': '0',
        'local-time': getLocalTime(),
        'locale': 'in_ID',
        'mbid': '60000000000',
        'mcc': '510',
        'mchid': 'DAUAG1050238',
        'md': 'V2309A',
        'mf': 'VIVO',
        'nchid': 'DRA1000000',
        'ov': '9',
        'over-flow': 'new-fly',
        'p': '51',
        'package-name': 'com.storymatrix.drama',
        'pline': 'ANDROID',
        'srn': '900x1600',
        'store-source': 'store_google',
        'time-zone': '+0800',
        'tn': '',
        'tz': '-480',
        'user-agent': config.userAgent,
        'userid': '359146421',
        'version': config.version,
        'vn': '4.9.0',
        'sn': sn
    };

    const url = `${config.baseUrl}/drama-box/ap001/bootstrap?timestamp=${timestamp}`;

    try {
        const response = await httpRequest(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            timeout: config.timeout
        });

        const responseData = JSON.parse(response.body);

        if (!responseData?.data?.user?.token) {
            throw new Error('Invalid token response - no token in user data');
        }

        const creationTime = Date.now();
        const tokenData = {
            token: responseData.data.user.token,
            deviceId,
            androidId,
            instanceId,
            afid,
            ins,
            timestamp: creationTime,
            expiry: creationTime + 24 * 60 * 60 * 1000
        };

        tokenCache.set(cacheKey, tokenData, config.tokenCacheTTL);
        return tokenData;
    } catch (error) {
        throw new Error(`Token generation failed: ${error.message}`);
    }
}

export async function getToken(language = config.defaultLanguage) {
    const cached = tokenCache.get(`token_${language}`);
    if (cached && cached.expiry > Date.now() + 5 * 60 * 1000) {
        return cached;
    }
    return generateToken(language);
}

export function clearTokenCache() {
    tokenCache.flushAll();
}