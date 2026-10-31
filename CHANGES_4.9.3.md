# 4.9.3 correction

Restored the exact .env from the original MoroShow_4.9.1_FIXED.zip. It was mistakenly excluded from the 4.9.2 deliverable. Removed duplicate Home error messages. DramaBox access-denied errors now display concise text rather than HTML; authentication refusals are not repeatedly retried. TLS certificate validation is enabled.

The original DramaBox token/signing/transport files were compared byte-for-byte before these error-handling changes: the integration had not changed their request implementation. A 403 is still an upstream rejection. GoodShort .env.example has an empty AUTH_TOKEN; ReelShort contains a placeholder. No tokens have been invented or substituted.

Anime/Shorts labels, compact layouts and removal of DramaTip remain.
