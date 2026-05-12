---
title: Forgot password
---

# Forgot password

If you've forgotten your password, Fulkruma can issue a reset link via email. The link sends you to Huudis to set a new password, then back to Fulkruma to sign in.

The whole flow takes about a minute.

## When to use this

Use **Forgot password** if:

- You signed up with email + password and don't remember the password.
- A password manager autofilled the wrong password and now the right one isn't loading.
- You've been locked out by too many failed sign-in attempts (this bypasses the lockout).

If you signed up with Google or Apple, **you don't have a Fulkruma password to reset.** Sign in via the same social provider you used to sign up &mdash; the [**Sign in**](/docs/auth/signin) page has the button.

## The flow

1. **Click "Forgot password?"** on the sign-in screen.
2. **Enter your email.** We send a reset link.
3. **Click the link** in your inbox.
4. **Set a new password.**
5. **Sign in** with the new password.

## Step-by-step

### 1. Click Forgot password

On `fulkruma.com/login`, scroll to the email/password form and click **Forgot your password?** below the password field.

You're now on `fulkruma.com/forgot-password`. The page shows a single email field.

### 2. Enter your email

Enter the email you used at sign-up. Click **Send reset link**.

Fulkruma tells Huudis to send a reset email regardless of whether the email exists in our system. This is intentional &mdash; we don't want to confirm or deny account existence by responding differently.

What you'll see:

> If `you@example.com` has a Huudis account, we sent a reset link. It expires in 1 hour.

If the email isn't on file, no email gets sent. If it is, you'll get one within a minute.

### 3. Click the link

Check your inbox for an email from `no-reply@huudis.com`. Subject: "Reset your Forjio password."

Click the link. It opens `fulkruma.com/reset-password?token=…`.

<blockquote class="callout-warn">

**The link expires in one hour.** If you wait too long, request a new one. We deliberately short-window reset links because they're sensitive &mdash; a long-lived link in your inbox is a phishing target.

</blockquote>

### 4. Set a new password

The reset page shows two fields:

- **New password** &mdash; minimum 10 characters. Same rules as sign-up.
- **Confirm new password** &mdash; type it again.

Click **Update password**.

The page updates your password on Huudis. Your old password stops working immediately across **every** Forjio product &mdash; Fulkruma, Plugipay, Storlaunch, and the rest. That's the trade-off of shared identity: one password to remember, one password to rotate.

### 5. Sign in

The reset page redirects to `fulkruma.com/login` with a banner: "Password updated. Sign in to continue."

Sign in normally with the new password.

If you had any open Fulkruma sessions in other browsers or tabs, they'll keep working until they expire naturally (up to 30 days of inactivity).

## What if you don't receive the email?

The reset email comes from `no-reply@huudis.com`. Things to try:

1. **Check spam/junk.** Many corporate filters quarantine first-time senders.
2. **Check the right inbox.** If you have multiple emails, sign-up may have been with a different one.
3. **Wait 5 minutes.** Most arrive within seconds, but rare delivery delays happen.
4. **Whitelist `@huudis.com`.** Your IT team can do this.

If after all that you still can't receive email, contact hello@fulkruma.com from the same email address. We can verify you and reset manually.

## Multi-factor authentication and password reset

If you have MFA enabled, resetting your password **does not** disable MFA. The next sign-in will still ask for your TOTP code or WebAuthn key.

If you've also lost your MFA factor:

1. Use a **backup code** (one of the codes you saved at MFA enrollment).
2. Or ask a workspace admin to disable MFA on your account.
3. Or, if you're the only admin, contact hello@fulkruma.com.

## Common errors

### "Reset link expired"

The link is older than one hour. Request a new one.

### "Reset link invalid"

The token has been used already, or someone has modified the URL. Request a new link.

### "Password too short"

Minimum 10 characters. Same as sign-up.

### "Password the same as before"

Huudis doesn't allow reusing the previous password. Pick something different.

## Next

- [**Sign in**](/docs/auth/signin) &mdash; sign in with your new password.
- [**Authentication overview**](/docs/auth/overview) &mdash; the protocol-level picture.
