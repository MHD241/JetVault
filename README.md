# JetVault V12 Rewrite

This package is a clean rewrite of the JetVault frontend while preserving the existing Supabase project and database tables.

Core performance changes:
- 24-photo database pagination instead of loading the whole archive.
- Real WebP full + thumbnail generation before upload.
- Thumbnails in gallery, full resolution only in the lightbox.
- No body-wide MutationObserver.
- Lightweight social count queries only when needed.
- Manager Studio automatically repairs missing legacy thumbnails.
- Works on Supabase Free; no Image Transformations subscription is required.

Important:
Do not delete the existing `assets/images/photos` folder when deploying this package, because several legacy database rows still reference those bundled files.
