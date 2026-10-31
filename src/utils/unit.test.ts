import test from 'node:test';
import assert from 'node:assert/strict';
import { fnv1a64, generateContentId } from './fnv1a64.ts';
import {
  generatePlaybackToken,
  verifyPlaybackToken,
  isAllowedStreamUrl,
  hashPin,
  generateSalt,
  verifyPinWithRateLimit
} from './security.ts';
import { parseM3U, detectStreamType, isContentKidFriendly } from './m3uParser.ts';

test('FNV-1a 64-bit produces 16-character hex hash deterministically', () => {
  const hash1 = fnv1a64('https://stream.example.com/live/ch1.m3u8');
  const hash2 = fnv1a64('https://stream.example.com/live/ch1.m3u8');
  const hashDiff = fnv1a64('https://stream.example.com/live/ch2.m3u8');

  assert.equal(hash1.length, 16);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hashDiff);
});

test('generateContentId produces stable prefixed ID', () => {
  const id1 = generateContentId({
    streamUrl: 'https://cdn.example.com/nasa.m3u8',
    name: 'NASA TV HD',
    tvgId: 'nasa.us',
    groupTitle: 'Science'
  });
  const id2 = generateContentId({
    streamUrl: 'https://cdn.example.com/nasa.m3u8',
    name: 'NASA TV HD',
    tvgId: 'nasa.us',
    groupTitle: 'Science'
  });
  assert.match(id1, /^ns-[0-9a-f]{16}$/);
  assert.equal(id1, id2);
});

test('Playback security: HMAC-SHA256 token generation and validation', () => {
  const token = generatePlaybackToken({
    contentId: 'ns-1234567890abcdef',
    profileId: 'prof-adult',
    streamUrl: 'https://live.nasa.gov/hls/stream.m3u8',
    streamType: 'hls',
    isKidProfile: false
  }, 3600, 'test-secret-key-12345');

  assert.ok(token.includes('.'));
  const verification = verifyPlaybackToken(token, 'test-secret-key-12345');
  assert.equal(verification.valid, true);
  assert.equal(verification.payload?.contentId, 'ns-1234567890abcdef');
  assert.equal(verification.payload?.streamType, 'hls');

  // Tampering detection
  const tamperedToken = token.slice(0, -4) + 'abcd';
  const tamperedResult = verifyPlaybackToken(tamperedToken, 'test-secret-key-12345');
  assert.equal(tamperedResult.valid, false);

  // Wrong secret detection
  const wrongSecretResult = verifyPlaybackToken(token, 'wrong-secret-key');
  assert.equal(wrongSecretResult.valid, false);
});

test('SSRF Protection: Blocks loopback, private ranges, metadata, and non-http', () => {
  // Prohibited URLs
  assert.equal(isAllowedStreamUrl('http://127.0.0.1:8080/stream').allowed, false);
  assert.equal(isAllowedStreamUrl('http://localhost:3000/api').allowed, false);
  assert.equal(isAllowedStreamUrl('http://10.0.0.5/stream.ts').allowed, false);
  assert.equal(isAllowedStreamUrl('http://192.168.1.100/video.mp4').allowed, false);
  assert.equal(isAllowedStreamUrl('http://172.16.1.1/stream.m3u8').allowed, false);
  assert.equal(isAllowedStreamUrl('http://169.254.169.254/latest/meta-data/').allowed, false);
  assert.equal(isAllowedStreamUrl('file:///etc/passwd').allowed, false);
  assert.equal(isAllowedStreamUrl('gopher://example.com/').allowed, false);
  assert.equal(isAllowedStreamUrl('http://example.com:22/stream').allowed, false); // Port 22 restricted

  // Allowed public URLs
  assert.equal(isAllowedStreamUrl('https://live.nasa.gov/stream.m3u8').allowed, true);
  assert.equal(isAllowedStreamUrl('https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8').allowed, true);
  assert.equal(isAllowedStreamUrl('http://iptv.example.com:8080/live/user/pass/1234.ts').allowed, true);
});

test('PIN security: Salted SHA-256 and rate-limited lockout', () => {
  const salt = generateSalt();
  const pin = '4321';
  const hashed = hashPin(pin, salt);

  assert.equal(hashPin(pin, salt), hashed);
  assert.notEqual(hashPin('9999', salt), hashed);

  // Rate limiting test
  const profileId = 'test-prof-' + Date.now();
  // Try 4 wrong attempts
  for (let i = 0; i < 4; i++) {
    const attempt = verifyPinWithRateLimit(profileId, '0000', hashed, salt);
    assert.equal(attempt.success, false);
  }
  // 5th wrong attempt should trigger lockout
  const fifthAttempt = verifyPinWithRateLimit(profileId, '0000', hashed, salt);
  assert.equal(fifthAttempt.success, false);
  assert.ok(fifthAttempt.lockedSeconds !== undefined && fifthAttempt.lockedSeconds > 0);

  // Even correct PIN during lockout should be rejected
  const lockedAttempt = verifyPinWithRateLimit(profileId, pin, hashed, salt);
  assert.equal(lockedAttempt.success, false);
  assert.ok(lockedAttempt.error?.includes('wait'));
});

test('M3U Plus parsing, stream types, and classification', () => {
  const sampleM3U = `#EXTM3U
#EXTINF:-1 tvg-id="nasa.us" tvg-name="NASA TV" tvg-logo="https://example.com/nasa.png" group-title="Science & Tech",NASA TV HD
https://nasa.example.com/master.m3u8
#EXTINF:-1 tvg-id="disney.us" tvg-name="Disney Junior" group-title="Kids Animation",Disney Junior
https://disney.example.com/stream.ts
#EXTINF:-1 group-title="Movies VOD",Big Buck Bunny (2008)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
#EXTINF:-1 group-title="TV Series",Stranger Things S01E03
https://series.example.com/st/s01e03.mp4
`;

  const parsed = parseM3U(sampleM3U);
  assert.equal(parsed.items.length, 4);
  assert.equal(parsed.liveCount, 2);
  assert.equal(parsed.movieCount, 1);
  assert.equal(parsed.seriesCount, 1);

  // Check item 0: NASA TV HD
  const nasa = parsed.items[0];
  assert.equal(nasa.name, 'NASA TV HD');
  assert.equal(nasa.streamType, 'hls');
  assert.equal(nasa.kind, 'live');
  assert.equal(nasa.tvgId, 'nasa.us');
  assert.equal(nasa.category, 'Science & Tech');

  // Check item 1: Disney Junior (MPEG-TS & Kids)
  const disney = parsed.items[1];
  assert.equal(disney.streamType, 'mpegts');
  assert.equal(disney.isKidFriendly, true);

  // Check item 2: Big Buck Bunny (Movie, MP4)
  const bbb = parsed.items[2];
  assert.equal(bbb.kind, 'movie');
  assert.equal(bbb.streamType, 'mp4');
  assert.equal(bbb.year, 2008);

  // Check item 3: Stranger Things S01E03 (Series)
  const st = parsed.items[3];
  assert.equal(st.kind, 'series');
  assert.equal(st.season, 1);
  assert.equal(st.episode, 3);
  assert.equal(st.seriesTitle, 'Stranger Things');
});
