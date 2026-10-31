# Shorts catalogue and vertical player

Removed the one-episode restriction and the temporary test screen. Use the native Arabic catalogue category paths (populer/newly-added), real search and pagination. Fetch each series episode list and bind playback to the exact current slug and episode. Start Shorts directly instead of showing a server picker.

The new portrait player includes a subtitles action in place of the reference image's star action, an episode drawer with direct episode selection, previous/next, swipe navigation, automatic next episode, mute, play/pause, seeking and fullscreen. Arabic captions remain the default. Normalize BOM-prefixed VTT and SRT into valid WebVTT before relaying. Missing Arabic files are shown as unavailable, not silently generated.

User-facing source labels and errors use generic Shorts wording. Backend provenance and technical names remain in source code and historical documentation. No third-party brand has been added to the new player.

The original .env is preserved byte-for-byte. Four live samples from three series passed media verification, including two MP4 episodes and two HLS episodes. Three had Arabic subtitle files; one did not provide a separate subtitle file. Browser rendering could not be verified in this execution environment.
