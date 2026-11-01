# MoroShow installed playback protection

Movie/series embeds open in a separate native WebView inside MoroShow on Android,
Android TV and iPhone/iPad. The player has no Capacitor/account bridge. Native
Back, Reload and source-switch controls remain inside the app. Popup creation and
navigation away from approved HTTPS player origins are denied.

Android filters advertising hosts using WebViewClient; iOS compiles matching
WKContentRuleList rules before loading the player. App Settings has a blocking
switch and manual list update. Popup blocking stays on even when filtering is off.

A curated domain list ships with the app. Validated JSON updates come only from
https://moro-show.vercel.app/playback-blocklist.json, at most once per day (or
manually). Invalid updates, version downgrades and network errors retain the last
good list or bundled defaults. No executable code is downloaded. To publish an
update, edit public/playback-blocklist.json and increase its integer version.

## Build Android / Android TV

Requires Android Studio, Android SDK 35 and JDK 21 for Capacitor 7.
Use the current HTTPS backend URL, not an expired Quick Tunnel address:

```bash
export VITE_NETSHOW_API_BASE=https://YOUR_CURRENT_BACKEND
bash scripts/prepare-android.sh
```

Android Studio opens. Build > Build App Bundle(s) / APK(s) > Build APK(s).
Or after preparation: `cd android && ./gradlew assembleDebug`.
APK output: android/app/build/outputs/apk/debug/app-debug.apk.
The same APK has phone and TV launcher entries. Debug APKs are for testing;
release signing is separate. Focusable native controls support the TV remote.

## Build iPhone / iPad

```bash
export VITE_NETSHOW_API_BASE=https://YOUR_CURRENT_BACKEND
bash scripts/prepare-ios.sh
```

Open the generated Xcode project. Include all three Swift files in the App target:
NetShowNativePlayerPlugin.swift, MoroProtectedPlayerPlugin.swift and
NetShowBridgeViewController.swift. The preparation script sets the storyboard
host. Select your development team and device, then Run.

Native builds use native-dist separately from the Mac website's dist. Capacitor
uses JSON configuration to avoid the Capacitor 7 / TypeScript 7 loader issue.
A website deployment alone does not activate native blocking. Existing installed
apps must be rebuilt and reinstalled. Shorts and live-TV playback are unchanged.

## Verification and limits

Automated checks cover domain matching, provider/account-host protection, cache,
invalid updates, offline fallback and Android preparation idempotency. TypeScript
and production build are separate checks. Native SDK compilation and real-device
playback are required before calling this a tested APK/IPA; neither Android SDK
nor Xcode/real-device playback was available in the implementation environment.

The list is a curated domain matcher, not a full EasyList/cosmetic/scriptlet engine.
Ads from unknown domains or the video's own domain may remain. Android request
interception has redirect/blob limitations. Some providers may detect filtering
or need other navigation hosts; try another source or disable filtering. No
complete ad-removal or provider-availability guarantee is made. Audio-only Cinezo
playback is not proven fixed by ad blocking. Validate picture, audio, fullscreen,
subtitles, source switching and popup prevention on each target device.
