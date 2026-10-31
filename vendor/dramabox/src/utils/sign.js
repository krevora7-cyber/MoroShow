import crypto from 'crypto';

export function getPrivateKey() {
    const key = process.env.DRAMABOX_PRIVATE_KEY;
    if (!key) throw new Error('Legacy provider signing key is not configured');
    return key.replace(/\\n/g, '\n');
}

export function signString(str) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(str, 'utf-8'));
    return sign.sign(getPrivateKey(), 'base64');
}
