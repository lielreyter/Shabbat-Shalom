# keshersocial.com Launch Checklist

Use this checklist to publish the Kesher support website and connect the `keshersocial.com` domain.

## 1. Deploy Firebase Hosting

From the repo root:

```bash
cd /Users/lielr/Python/shabbat_shalomv1
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use shabbat-shalom-8994d
npx -y firebase-tools@latest deploy --only hosting
```

The site content is served from `website/`, as configured in `firebase.json`.

## 2. Connect the Custom Domain

In Firebase Console:

1. Open project `shabbat-shalom-8994d`.
2. Go to **Hosting**.
3. Click **Add custom domain**.
4. Enter `keshersocial.com`.
5. Add the DNS records Firebase gives you at the domain registrar.
6. Add `www.keshersocial.com` too if you want the `www` version.

Firebase will automatically issue an SSL certificate after DNS verifies.

## 3. Set App Store URLs

After DNS and SSL are live:

- Support URL: `https://keshersocial.com`
- Privacy Policy URL: `https://keshersocial.com/privacy`
- Marketing URL: `https://keshersocial.com`

## 4. Set Up Email

Create or forward:

- `keshersupport@gmail.com`

The website and privacy policy now use this address.

## 5. Finish the Waitlist

The current waitlist form is a front-end placeholder that stores emails in the visitor's browser only. Before launch, connect it to a real collector such as:

- Formspree
- Mailchimp
- ConvertKit
- Buttondown
- Firebase Functions + Firestore

## 6. Final Browser Checks

Check these URLs after deploy:

- `https://keshersocial.com`
- `https://keshersocial.com/privacy`
- `https://keshersocial.com/favicon.svg`

Also verify the footer email link opens a compose window to `keshersupport@gmail.com`.
