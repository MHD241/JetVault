# Scottish.aero

A responsive aviation photography website for Mohammed Shnina, Ellis Martin and Arran Gordon.

## What is included

- cinematic animated homepage;
- masonry aviation gallery + full-screen lightbox;
- photographer portfolios;
- airport browsing;
- seven real starter photographs credited to Arran Gordon;
- private three-account crew dashboard;
- automatic upload attribution;
- editable aircraft/photo metadata;
- basic privacy-light visit and photo-view analytics;
- Supabase Row Level Security and Storage policies;
- GitHub Pages-compatible front end.

## Before the dashboard becomes live

Read `SUPABASE-SETUP.md`. The public gallery works immediately from the local starter data, but secure accounts, persistent uploads and analytics require Supabase.

## Important security rule

Never commit a Supabase `service_role` key. The only key placed in `assets/js/config.js` is the browser-safe publishable/anon key. Security is enforced by Supabase Row Level Security and the crew allow-list in `supabase/schema.sql`.
