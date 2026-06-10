# Kesher — Marketing & Support Site

Static, single-page site that serves as Kesher's public support and waitlist page.

## Files

- `index.html` — Landing page (hero, features, about, waitlist, contact)
- `privacy.html` — Public-facing privacy policy
- `README.md` — This file

No build step. No dependencies. Open `index.html` directly in a browser, or deploy the whole `website/` folder to any static host.

## Quick local preview

```bash
cd website
python3 -m http.server 8080
# open http://localhost:8080
```

## Recommended Deploy: Firebase Hosting

This repo is now configured to deploy this folder through Firebase Hosting.

```bash
cd /Users/lielr/Python/shabbat_shalomv1
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use shabbat-shalom-8994d
npx -y firebase-tools@latest deploy --only hosting
```

After deploy, Firebase prints a temporary `web.app` / `firebaseapp.com` URL. Use that to confirm the site looks right before connecting the custom domain.

## Custom Domain: keshersocial.com

1. Open Firebase Console.
2. Go to project `shabbat-shalom-8994d`.
3. Open **Hosting**.
4. Click **Add custom domain**.
5. Add `keshersocial.com`.
6. Follow Firebase's DNS instructions at your domain registrar.
7. Repeat for `www.keshersocial.com` if you want the `www` version too.

Firebase will provision HTTPS automatically after DNS verifies. This can take minutes to several hours.

Use these final URLs:

- Support URL: `https://keshersocial.com`
- Privacy Policy URL: `https://keshersocial.com/privacy`
- Marketing URL: `https://keshersocial.com`

## Other Deploy Options

Any of these will work — pick whichever you already use.

### GitHub Pages

1. Push the repo to GitHub.
2. Settings → Pages → Source: `main` branch, folder `/website`.
3. Wait for the green check, then use the GitHub Pages URL (e.g. `https://<user>.github.io/<repo>/`) as your App Store support URL.

### Netlify

```bash
# from repo root
npx netlify deploy --dir=website --prod
```

### Vercel

```bash
npx vercel --cwd website --prod
```

## What to update before launch

- `keshersupport@gmail.com` — use this inbox for App Store and website support requests.
- Waitlist form — currently stores submissions in `localStorage` only. Wire it up to your email collector of choice (Mailchimp, ConvertKit, Buttondown, Formspree, etc.) by replacing the JS handler in `index.html`.
- Last-updated date in `privacy.html`.

## App Store / Play Store fields

- **Support URL:** `https://keshersocial.com`
- **Privacy Policy URL:** `https://keshersocial.com/privacy`
- **Marketing URL:** `https://keshersocial.com`
