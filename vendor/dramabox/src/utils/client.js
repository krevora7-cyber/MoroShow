import { config } from './config.js';
import { getToken } from './token.js';
import { signString } from './sign.js';
import { getLocalTime } from './token.js';

export function buildHeaders(tokenData, timestamp, payload, language = config.defaultLanguage) {
    const body = JSON.stringify(payload);
    const tnValue = `Bearer ${tokenData.token}`;
    const signPayload = `timestamp=${timestamp}${body}${tokenData.deviceId}${tokenData.androidId}${tnValue}`;
    const sn = signString(signPayload);

    if (!sn) {
        throw new Error('Failed to generate signature for request');
    }

    return {
        'accept-encoding': 'gzip',
        'active-time': String(Math.floor(Math.random() * 60000)),
        'afid': tokenData.afid,
        'android-id': tokenData.androidId,
        'apn': '0',
        'brand': 'Xiaomi',
        'build': 'Build/QQ3A.200805.001',
        'cid': 'DAUAG1064236',
        'content-type': 'application/json; charset=UTF-8',
        'country-code': 'ID',
        'current-language': language,
        'device-id': tokenData.deviceId,
        'device-score': '55',
        'host': 'sapi.dramaboxdb.com',
        'ins': tokenData.ins,
        'instanceid': tokenData.instanceId,
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
        'tn': tnValue,
        'tz': '-480',
        'user-agent': config.userAgent,
        'userid': '359146421',
        'version': config.version,
        'vn': '4.9.0',
        'sn': sn
    };
}

export function buildWebficHeaders(language = config.defaultLanguage) {
    return {
        'Content-Type': 'application/json',
        pline: 'DRAMABOX',
        language: language
    };
}
