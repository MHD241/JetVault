# JetVault: project state

Last updated: 2026-11-08

## Done (all local, NOT pushed)
- Cloned MHD241/jetvault (main, commit 99de3ff) read-only into /home/claude/mhd241/jetvault.
- Redesign: `assets/css/jetvault-redesign.css` (loads last), Google Fonts (Saira Condensed, Barlow), linked on index, about, account, gallery, gallery-2, gallery-3, photographers, profile.
- Flight Sim: `flight-sim.html`, homepage ticker + feature card, `assets/js/jetvault-countdown.js` (live countdown to 2027-02-25T00:00:00Z), "Flight Sim Soon" nav link on all public pages (also in the nav list inside `assets/js/footer-credit-v7-5.js`) and a footer link.
- Early access rule is now: 150 approved photos solo, OR partner route (one invite link, one partner, each needs 75 of their own, both must reach 75 before either unlocks).
- Team-up: `partner.html` + `assets/js/early-access.js` (shows server state, create/copy/cancel link, accept link). Copy updated from 50 to 150 / 75 on flight-sim.html and index.html.
- `supabase/flight-sim-early-access.sql`: table `early_access_pairs` + functions fs_early_access_status, fs_create_invite, fs_accept_invite, fs_revoke_invite. Rules live here, not in the browser. NOT yet run on the live Supabase.
- Team-up is LOCKED (visible, animated padlock + hazard tape on partner.html, lock icons on the Team up links). Two locks: display flag `assets/js/feature-flags.js` (`teamUp:false`, page makes no backend calls and ignores ?ref while locked) and DB switch `early_access_settings.teamup_open` (default false; create/accept raise `teamup_locked`). To open: set `teamUp: true` AND run `update public.early_access_settings set teamup_open = true;` — only after Flight Sim reads `fs_early_access_status`.
- Preview artifact (private) republished at the same link; Supabase disabled in the preview copy, so Team-up shows labelled sample data there.

## Testing done
- SQL run in a throwaway local Postgres 16 (stand-in auth/photos/profiles tables): 61 rule checks passed (incl. lock on/off) (solo 149/150, 75+74 vs 75+75, 300+0 leaves the partner locked, used/own/revoked/unknown links, one pair per person, locked after pairing, signed-out refusal, table and anon permissions, DB-level constraints) plus a 25-round race where two people accept the same link at once: exactly one wins every time.
- Team-up page: 23 page-flow checks (incl. locked state: no RPC calls, ref not saved, inert ghost, lock icons) against a scripted backend, plus screenshots of every state (desktop and phone).
- NOT tested: the SQL against the real Supabase project, or the page talking to it. The real `photos`/`profiles` columns were taken from backend-v7.js (owner_id, status, registration; profiles id, username, display_name).

## Decisions
- 25 Feb 2027 is treated as the Flight Sim launch date (midnight, UK time).
- Only approved photos count; profile/post marker rows (`__SA_PROFILE__`, `__SA_POST__`) are ignored.
- Rollback: delete feature-flags.js, jetvault-redesign.css, jetvault-countdown.js, early-access.js, flight-sim.html, partner.html, supabase/flight-sim-early-access.sql; revert the added links and the footer-credit-v7-5.js nav change.

## Open issues
- Run the SQL on Supabase (review first), then test with two real accounts.
- Known limit: one person with two accounts and 75 real approved photos on each gets both unlocked (same photo cost as the solo 150, no way to stop it without ID checks).
- Early access is only shown, nothing grants it in Flight Sim itself yet; the sim must call fs_early_access_status.
- Inner pages only get shared restyling, not reviewed one by one.

## Next step
- User reviews the preview. Push only after the user says so (repo must be attached with write access).
