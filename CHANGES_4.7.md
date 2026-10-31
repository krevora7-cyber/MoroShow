# 4.7.0-preview

Replaces Events navigation with AniZone; keeps the existing TV source explicitly marked
as pending migration. Adds isolated web source routes, metadata configuration helper,
three validated Watch32 embed builders, embedded player overlay, source pagination/search,
and paginated AniZone episodes using the site's ordinary Livewire session flow.

All third-party JSON is decoded without eval. Remote executable server.js is not loaded
into MoroShow. Embed origins are allowlisted and top-level navigation/popups sandboxed.
HTTP fetches have deadlines; caches/sessions are bounded. Kids playback checks rating
metadata rather than assuming all animation is suitable for children.

Production build included. See START_HERE.md for outstanding setup and verification.
