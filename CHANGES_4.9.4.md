# Episode 21 experiment

Added a single dedicated Shorts card for the user-supplied Arabic DramaTip episode. Arabic series identifiers now survive URL encoding. Playback reads the sourceFirst associated with currentSerial=21 and the exact slug, never the next episode. MP4 is passed through as MP4; NetShort CDN HTTPS origins are allowed by the bounded media relay. The relay streams MP4 and preserves byte ranges for seeking. Signed video URLs are resolved at playback time and not shipped in the bundle.

No catalogue-wide rollout. Other Shorts episode IDs are explicitly rejected by this build. The original .env is preserved byte-for-byte. Six-platform work is not part of this test.
