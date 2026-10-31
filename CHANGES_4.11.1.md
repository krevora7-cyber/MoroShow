# MoroShow 4.11.1 — mobile presentation

- Home: cinematic horizontal hero, real catalogue artwork, pill actions and compact pagination. Shorts retains the existing Skiper card transition.
- Mobile: floating translucent bottom navigation, rounded poster cards, compact in-card Top 10 ranks, system typography and larger collection headings.
- Details: large poster, centred title/play/save, expandable synopsis and real metadata only. Actual episodes appear in horizontal artwork cards with watch progress and season selection. Shorts uses compact episode cards.
- Real TMDB trailers are listed as cards and play inline. No invented bonus content, quality badges or episode durations.
- Hero trailers now use the official YouTube IFrame API instead of a manual message handshake. Muted autoplay, explicit blocked-autoplay action, mute changes without reload, and destruction on scroll/visibility/details/profile transitions. Posters remain visible if a trailer cannot load. External YouTube availability and Safari autoplay still require a real-device check.
- Source playback, Kids protections, profiles, supplied 28 avatars, history and favourites retained. .env unchanged. The previously audited 240 source failures remain as requested.

Validation: TypeScript and production build passed; 57 existing Node checks passed. Mobile browser evidence is recorded in verification/mobile-style-4111.json (fixture catalogue and YouTube API simulation, not live YouTube/iPhone playback).

Live YouTube probe: the official API created an iframe through the test network, but actual video playback was not confirmed. See verification/trailer-live-4111.json. Real Safari/iPhone verification remains required.
