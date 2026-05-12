---
title: Sign in
---

# Sign in

This page walks through what happens when you sign in to Fulkruma, what each screen does, and how to recover from the common things that go wrong.

If you're new to Fulkruma and don't have an account yet, head to the [**Quickstart**](/docs/quickstart) &mdash; sign-up is the first step.

## The flow

Sign-in has up to four screens, depending on your account state:

1. **Fulkruma landing page** &mdash; you click *Sign in*.
2. **Huudis email/password screen** &mdash; you enter your credentials (or click Google/Apple).
3. **MFA prompt** *(if enabled)* &mdash; you enter a TOTP code or biometric.
4. **Fulkruma dashboard** &mdash; you're in.

Steps 1 and 4 are on fulkruma.com. Steps 2 and 3 are on huudis.com &mdash; you'll see the domain change in your address bar. That's intentional: Huudis owns identity, Fulkruma owns fulfilment data.

## Step-by-step

### 1. Click Sign in

The **Sign in** button is in the top-right of every fulkruma.com page. Clicking it sends you to `fulkruma.com/login`. From there you can choose:

- **Continue with email** &mdash; the standard flow.
- **Continue with Google** &mdash; available if your Huudis instance has Google OAuth configured.
- **Continue with Apple** &mdash; same condition as Google.

The social provider buttons are gated on Huudis instance configuration &mdash; if a provider isn't wired, its button is hidden.

If you've signed in to fulkruma.com before in this browser, you'll skip the chooser and go straight to Huudis.

### 2. Enter credentials

On huudis.com, you'll see a form for **Email** and **Password**.

- Email is case-insensitive.
- Password is case-sensitive. Spaces matter.
- Fulkruma doesn't impose a length limit on passwords beyond what Huudis enforces (minimum 10 characters).

After you submit, Huudis validates the credentials. Three possible outcomes:

- **Success, no MFA** &mdash; you skip to step 4.
- **Success, MFA enrolled** &mdash; you go to step 3.
- **Failure** &mdash; you see "Invalid email or password" with no information about which one is wrong (this is intentional, to prevent account enumeration).

### 3. MFA challenge (if enabled)

If you've enrolled in multi-factor authentication, Huudis prompts you for a code. Supported factors:

- **TOTP** &mdash; from Google Authenticator, Authy, 1Password, etc. Six-digit codes.
- **WebAuthn** &mdash; hardware security keys (YubiKey) or platform authenticators (Touch ID, Windows Hello).
- **Backup code** &mdash; one of the codes you saved when you enrolled. Each code works once.

Enter the code. Huudis verifies it and proceeds.

<blockquote class="callout-tip">

**Lost your second factor?** Use a backup code. If you've used them all, contact your workspace admin &mdash; they can disable MFA on your account from the dashboard. If you're the only admin and you've locked yourself out, email hello@fulkruma.com from a recognized email address.

</blockquote>

### 4. Back to Fulkruma

Huudis redirects your browser to `fulkruma.com/callback?code=…`. The callback page POSTs that code to Fulkruma's backend, which:

1. Exchanges the code for tokens at Huudis.
2. Validates the PKCE challenge it stored before redirecting you out.
3. Signs a session cookie and sets it on your browser.
4. Redirects you to `/dashboard`.

You're in. The whole thing usually takes under a second.

## Workspace selection

If your Huudis identity belongs to multiple Fulkruma workspaces &mdash; for instance, a direct sign-up workspace plus one provisioned by Storlaunch &mdash; the first sign-in to a new browser lands you in your last-used workspace. If we can't determine that, we land you in the most recently created one.

The workspace switcher lives in the top-left of the dashboard. Switching is instant; we don't reload the page, just refetch the data.

## "Remember me"

We don't have a "remember me" checkbox because we do it by default. Session cookies last 30 days of inactivity &mdash; you don't need to re-sign-in unless you've been away.

The cookie is `httpOnly`, `Secure`, `SameSite=Lax`, and HMAC-signed. It's safe to leave the browser open.

## Common errors

### "Invalid email or password"

The email or password you entered didn't match. We don't tell you which one for security reasons. Things to check:

- Caps Lock is off.
- The email is the one you used at sign-up &mdash; not an alias or another address you've added later.
- You haven't recently changed your password (then logged in with the old one).

If you genuinely don't remember, use [**Forgot password**](/docs/auth/forgot-password).

### "Email not verified"

You signed up but never clicked the verification link in the welcome email. Fulkruma won't let you sign in until you've verified.

Click **Resend verification** on the sign-in error page. The email comes from `no-reply@huudis.com` &mdash; check spam if you don't see it within a minute.

### "Account locked"

After too many failed attempts (we cap at 10 per 15 minutes), Huudis temporarily locks your account. Wait 15 minutes and try again. If you've genuinely forgotten your password, request a reset &mdash; that bypasses the lock.

### "Apple/Google sign-in failed"

The most common cause is that the social provider isn't actually configured on this Huudis instance &mdash; the buttons should be hidden in that case but a stale browser tab can show them. Refresh the page; if the button disappears, fall back to email/password.

## Behind the scenes

If you want to understand the protocol-level details &mdash; PKCE, state, nonce, refresh token rotation &mdash; the [**Authentication overview**](/docs/auth/overview) has the longer version.

## Next

- [**Forgot password**](/docs/auth/forgot-password) &mdash; reset your password.
- [**Authentication overview**](/docs/auth/overview) &mdash; the protocol-level picture.
- [**Portal tour**](/docs/portal) &mdash; what to do after you sign in.
