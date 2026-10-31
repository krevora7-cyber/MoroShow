# Clips resolution correction

The user diagnostic returned descriptor:null for episode 1, language ar, bookId 49179. This proves the failure occurred before decryption. It does not by itself prove whether the ID or the language caused the null source.

4.9.1 corrects both resolver assumptions: select a series-scoped internal ID when present and explicitly fall back to the page language on a null response. It also reads initial episode sources and preserves precise error codes.

Validation: source tests cover internal vs provider IDs, Next.js serialized props, null Arabic response then valid original-language response for the same episode, inline first-episode fallback, decryption errors and host restrictions. Live playback of the failing title remains unverified due to Cloudflare in this environment.
