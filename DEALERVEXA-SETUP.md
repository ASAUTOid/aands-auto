# DealerVexa: switches to turn on

Everything below is optional. Without a key the feature stays off and the manual way keeps working.
Add the keys in **Netlify → Site configuration → Environment variables**, then redeploy. HQ → Plans & wallets shows what is on.

| Feature | Variables | Where to get them |
|---|---|---|
| Automatic e-mails | `RESEND_API_KEY` (optional `MAIL_FROM`, default `DealerVexa <hello@dealervexa.com>`) | resend.com → verify the domain dealervexa.com → API Keys |
| Automatic crypto payments | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | nowpayments.io → Settings → API keys and Instant payment notifications. Set your payout wallet there. The IPN address is `https://dealervexa.com/api/pay/ipn` (sent with every payment). |
| AI scene photos | `GEMINI_API_KEY` (optional `GEMINI_IMAGE_MODEL`, default `gemini-2.5-flash-image`) | aistudio.google.com/apikey (billing must be on for image models) |
| Links in e-mails and payments | `DVX_URL` (default `https://dealervexa.com`) | only if DealerVexa runs on another address |
| Automatic dealer domains | `NETLIFY_TOKEN`, `NETLIFY_SITE_ID` | Netlify → User settings → Applications → Personal access tokens |

AI photo limits per month: Starter 20, Pro 100, Dealer Plus 300 (HQ password has no limit).
Never paste keys into chats, e-mails or the code.
