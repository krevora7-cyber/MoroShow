# Browser playback compatibility

The standard source selection and backend engine are unchanged. The browser
player is rendered in a body portal so animated/filtered app ancestors cannot
clip its fixed video surface. Its viewport sizing is scoped to embedded movies
and series; Shorts, live TV and installed-player code are unchanged.

Playback mode is session-local and resets when the title/source changes:

- Standard: existing URL, referrer policy and permissions.
- Compatibility: origin-only referrer; VidLink additionally uses its documented
  `player=jw` alternative. Other providers keep their original URL.
- CineSrc trial: derives the same TMDB movie or season/episode from an approved
  source URL. It requests 720p, manual playback and no automatic next episode.
  Sandbox excludes popup and top-navigation permissions. It may be rejected by
  the provider and is never an automatic fallback. Select Standard to return.

The trial does not save watch progress because its events have not been validated
against real playback. Existing standard-source progress validation is preserved.
No extension, native installation, external viewer or backend restart is required
for the frontend deployment. Browser permissions cannot force a provider codec,
modify a cross-origin video's playsinline flag or remove all in-player ads.

Validation: typecheck, production build, URL/security and existing engine tests.
Browser fixture checks verify UI behavior, not third-party video decoding.
Real iPhone Safari picture/audio, subtitles and fullscreen still need verification.
Neither the black-picture cause nor universal ad removal is claimed solved.

References: https://cinesrc.st/docs and https://vidlink.pro/.
