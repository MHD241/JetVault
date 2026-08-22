# Scottish.aero

A static aviation photography website built for GitHub Pages. No framework, no build step, no dependencies.

## Upload to GitHub Pages

1. Create a new GitHub repository.
2. Upload **everything inside this folder** to the repository root.
3. In GitHub open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose your main branch and `/ (root)`, then save.

## Replace the sample photographs

The sample images are in:

`assets/images/photos/`

They are intentionally obvious placeholders. The easiest method is to export your real photos as JPG or WEBP files and then edit `assets/js/data.js`. For each photo, change `src` to your filename and update the registration, aircraft, airline, airport, date and photographer.

Example:

```js
{
  id: 10,
  src: 'assets/images/photos/my-a380-photo.webp',
  alt: 'Emirates Airbus A380 landing at Edinburgh',
  reg: 'A6-EVN',
  aircraft: 'Airbus A380-842',
  airline: 'Emirates',
  airport: 'EDI',
  date: '22 Aug 2026',
  photographer: 'jamie',
  ratio: 'wide',
  caption: 'Your caption here.'
}
```

Use `ratio: 'wide'`, `'standard'`, or `'tall'` to control the gallery shape.

## Change the photographers

Open `assets/js/data.js` and edit the `photographers` array. Make sure each photographer has a unique `id`. Photos refer to that `id`.

## Change airports

Edit the `airports` array in `assets/js/data.js`.

## Connect Scottish.aero later

After GitHub Pages works on the default GitHub URL, add the custom domain from **Settings → Pages → Custom domain**. GitHub will tell you the DNS records to add with your domain provider. Do this only after the normal GitHub Pages site is working.

## Suggested image sizes

- Gallery photos: 1800–2400px on the long edge
- Hero photo: 2400px+ wide
- Prefer WEBP at roughly 75–85% quality for faster loading
- Do not upload the full uncompressed camera originals

## Files

- `index.html` — homepage
- `gallery.html` — searchable/filterable masonry gallery + lightbox
- `airports.html` — airport landing page
- `photographers.html` — group member profiles
- `about.html` — group story
- `404.html` — GitHub Pages error page
- `assets/css/styles.css` — all site styling
- `assets/js/data.js` — the main content database

## Before the surprise

Replace the placeholder names, Instagram handles, email address and sample photographs. The fictional sample names are there only so the design looks complete before you add the real group information.
