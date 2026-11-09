# Community and player work in progress — do not deploy

This branch is a draft, not a production release. It must not be merged or deployed before the checks below are complete.

- The community migration has **not** been applied. Validate RLS with separate accounts, anonymity, all friend-request states, delete/report behavior and policies before applying; arrange active moderation, reporting and abuse controls before opening public posting.
- Test profile creation, post sharing, comments, requests, profile feed and failure states against an isolated database. The first 50 posts are shown; add pagination before presenting profiles as complete.
- Protected iframes may block or impair video. Test each selected provider, multiple movies and series, subtitles/audio and playback progress, on real desktop/mobile browsers; verify origin-checked progress and resume with the current session. Third-party player UI may show ads and cannot be guaranteed ad-free by iframe sandboxing.
- Verify rights and provider terms, including advertising/revenue arrangements, before deployment.
- Watch progress is limited to providers that publish compatible progress events. Guest progress is local to the browser and account progress remains private.
- Check responsive navigation/visual design and regressions in home, shorts and events before release. This draft has not been tested end-to-end with Supabase or production playback.
