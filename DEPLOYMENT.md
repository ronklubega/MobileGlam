# Deploying MobileGlam

Order matters: backend first (everything else needs its public URL), then Supabase hooks, then payments, then the mobile app.

## 0. Prerequisites
- Code in a Git repository on GitHub/GitLab (`git init`, commit, push). `.env*` files are already git-ignored.
- Accounts: Vercel, Supabase (already), Africa's Talking, MTN MoMo Developer, Airtel Developer, Expo (EAS).
- **Supabase region:** pick the one closest to Uganda (Africa/Cape Town) *before* going live; changing it later means a new project.

## 1. Database (Supabase)
Run in the SQL editor, in order: `migrations/0001` -> `0002` -> `0003` -> `0004`. Do NOT run `seed.sql` in production.
Enable extensions: `postgis`, `btree_gist`, `pg_cron`, `pg_net`.
Auth -> Providers -> Email: keep "Confirm email" ON in production.

## 2. Backend (Vercel)
1. New Project -> import the repo. **Root Directory: `apps/web`**. Leave "Include source files outside of the Root Directory" ON (shared packages live in `packages/`).
2. Environment variables (Production):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase -> Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret. Never in the mobile app |
| `DATABASE_URL` | **Session pooler** string, letters/numbers-only password |
| `APP_BASE_URL` | Your final https URL, e.g. `https://app.mobileglam.ug` (used for payment callbacks) |
| `CRON_SECRET` | 32+ random chars: `openssl rand -hex 24` |
| `PLATFORM_ADMIN_EMAILS` | Your email(s): enables Approvals and Refunds |
| `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` | Africa's Talking (live app, not `sandbox`) |
| `SEND_SMS_HOOK_SECRET` | From step 3 |
| `MTN_MOMO_*`, `AIRTEL_*` | From step 4 |

3. **Do NOT set `PAYMENTS_MODE`.** The mock provider refuses to run in production, so payments would error.
4. Deploy, then open `https://<domain>/api/health` -> must return `{"ok":true}`.
5. Function region: Vercel -> Settings -> Functions -> choose the region nearest your Supabase project.

## 3. Real SMS sign-in
Supabase -> Authentication -> Hooks -> **Send SMS** -> HTTPS -> `https://<domain>/api/auth/send-sms` -> Generate secret -> put it in Vercel as `SEND_SMS_HOOK_SECRET` -> redeploy.
Authentication -> URL Configuration: set Site URL to your domain.
Remove the test phone numbers from the Phone provider settings.

## 4. Mobile money (production)
- **MTN MoMo:** production Collection API access requires MTN merchant onboarding. Set `MTN_MOMO_BASE_URL` (production host), `MTN_MOMO_TARGET_ENV=mtnuganda`, and your subscription key / API user / API key. The callback URL is built automatically: `${APP_BASE_URL}/api/webhooks/mtn/${MTN_MOMO_CALLBACK_SECRET}`.
- **Airtel Money:** production credentials from Airtel Open API; register `${APP_BASE_URL}/api/webhooks/airtel/${AIRTEL_CALLBACK_SECRET}` as the callback.
- Run a UAT/sandbox end-to-end test first (deposit success, decline, timeout) before switching to production keys.

## 5. Scheduled jobs
Open `supabase/cron_reminders.sql`, replace the domain and `CRON_SECRET`, run it. Check `select * from cron.job;`.
(The hold-expiry job from `0003_cron.sql` is already scheduled.)

## 6. Mobile app (EAS)
```bash
npm i -g eas-cli && cd apps/mobile && eas login && eas init
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<domain>
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
eas build --platform android --profile preview     # installable APK to test with real users
eas build --platform all --profile production      # store builds
```
iOS TestFlight/App Store needs an Apple Developer account ($99/yr). Android Play Console is a one-off $25.

## 7. Go-live checklist
- [ ] `/api/health` is OK; a real SMS code arrives on a Ugandan number
- [ ] Register a test business -> approve it -> book a real small deposit with MTN and Airtel
- [ ] Callback received (payment turns Confirmed without opening the app) and the confirmation SMS arrives
- [ ] Reminder SMS arrives ~2h before a test booking
- [ ] Decline/timeout releases the slot; double-booking is rejected
- [ ] `PAYMENTS_MODE` is NOT set; service-role key only exists in Vercel
- [ ] Rate limits: enable Vercel Firewall rate limiting on `/api/bookings`, `/api/availability`; keep Supabase OTP limits on
- [ ] Supabase: PITR/backups enabled (Pro plan) before taking real money
- [ ] A named person monitors the Refunds queue
