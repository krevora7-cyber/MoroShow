# MoroShow 4.12.7 — TV update

Extract into Downloads. Stop the old app terminal with Ctrl+C, then run:

```bash
cd ~/Downloads/MoroShow_4.12.7 && bash START_MOROSHOW.command
```

On the Mac open http://localhost:3000. On the phone use the mobile address printed by the launcher. Keep the Mac and Terminal running on the same Wi-Fi.

Keep your previous MoroShow_4.12.0 folder next to the new folder until its first launch: the launcher imports its profiles, My List and Continue Watching only when the new installation has no data.

In TV, beIN opens the Arabic feeds. Other countries remain available through the country categories and All channels. Select a channel; if the first feed is unavailable, MoroShow checks another rendition of that same channel. A difficult connection can take up to about a minute before the app reports that no reachable source was found. If playback starts muted, tap the sound button. Tap Play if the browser blocks autoplay entirely.

beIN Sports 1–9 Arabic HD each decoded successfully at least once during verification. The included reports also retain earlier failures. This is not a guarantee that every channel is continuously available, and real iPhone testing is still required. See CHANGES_4.12.7.md and verification/tv-summary-4121.json.

VYPN is not built into this update. The backend's network access still determines which external hosts are reachable. Opening a website in VYPN does not automatically route the Mac's Express requests through VYPN.

.env is unchanged. Existing Home, Shorts, 28 avatars, profiles and Kids restrictions are preserved.
