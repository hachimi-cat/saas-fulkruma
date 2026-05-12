---
title: Authentication overview
---

# Authentication overview

Fulkruma doesn't have its own login system. We use **Huudis** &mdash; Forjio's shared identity provider &mdash; so you can use the same email and password (or Google, or Apple account) across Fulkruma, Plugipay, Storlaunch, LinkSnap, Pawpado, Catentio, and any other Forjio product.

If you've signed up for a Forjio product before, you can sign in to Fulkruma with that same account.

<blockquote class="callout-tip">

**One identity, many products.** Your Huudis account is yours, not Fulkruma's. We don't store your password &mdash; Huudis does. We just trust the bearer tokens Huudis issues us when you sign in.

</blockquote>

## How it works (the short version)

Sign-in is a standard **OpenID Connect (OIDC)** flow. The five steps are:

1. You click **Sign in** on fulkruma.com.
2. Fulkruma redirects you to `huudis.com/api/v1/oidc/authorize` with a request to authenticate.
3. You enter your email and password (or click Google/Apple) on Huudis.
4. Huudis redirects you back to `fulkruma.com/callback` with a one-time `code`.
5. Fulkruma's backend exchanges the code for a session token, sets a secure cookie on your browser, and you're in.

You never see steps 2-4 visually; they happen in two HTTP redirects.

## How it works (the longer version)

Fulkruma uses the **OIDC authorization code flow with PKCE**:

1. **Authorization request** &mdash; Fulkruma's `/api/v1/auth/start` endpoint generates a random `code_verifier`, derives a `code_challenge`, stores both in an HTTP-only cookie, and redirects you to Huudis with the challenge.
2. **User authentication** &mdash; Huudis prompts you for credentials (or detects an active Huudis session). When you successfully authenticate, Huudis generates a one-time authorization code.
3. **Redirect with code** &mdash; Huudis redirects you to `fulkruma.com/callback?code=…&state=…`.
4. **Token exchange** &mdash; The callback page POSTs the code (and the original `code_verifier`) to Fulkruma's backend. The backend forwards both to Huudis's token endpoint. Huudis validates the PKCE pair and returns access and refresh tokens.
5. **Session cookie** &mdash; Fulkruma's backend HMAC-signs a session payload containing the Huudis tokens and sets it as an `httpOnly`, `Secure` cookie. The browser presents that cookie on every subsequent request.

The refresh token rotates on every use, with reuse detection: if Huudis sees the same refresh token presented twice, it treats it as a stolen-token signal and revokes the whole token family. Fulkruma implements a single-flight refresh cache to prevent this from triggering during normal browser polling.

## Who uses this flow?

| Audience | Auth path |
|---|---|
| Merchant signing into the portal | OIDC flow above. Cookie session in the browser. |
| You, calling the API server-to-server | **Not OIDC**. Use an [**HMAC API key**](/docs/api/authentication) you mint in the dashboard. |
| You, using the CLI on your terminal | OIDC **device flow** &mdash; same Huudis identity, different transport. |
| Storlaunch acting as a partner | Platform-admin HMAC key + `X-Fulkruma-On-Behalf-Of` header (Pattern 2 partner billing). |

The portal cookie and the API key are independent. Revoking one doesn't affect the other.

## Workspace namespaces

Fulkruma workspaces (technically `accountId` values) come in two flavors:

- **Direct workspaces** &mdash; namespaced `usr_<huudisUserId>`. Created when you sign in through fulkruma.com directly.
- **Partner-provisioned workspaces** &mdash; namespaced `acc_<workspaceId>`. Created when Storlaunch (or another Forjio partner) provisions a workspace on your behalf.

The two namespaces never cross-scope. If Storlaunch provisions you a workspace and you also sign in to fulkruma.com directly, you'll see *two* workspaces &mdash; the partner one (with Storlaunch's data) and your own (empty until you fill it). This is intentional: it prevents partners and direct sign-ups from accidentally seeing each other's data.

## What goes in the cookie

The Fulkruma session cookie (`fulkruma_session`) is a base64url payload signed with HMAC-SHA256 by Fulkruma's backend. It contains:

- `huudisAccessToken` &mdash; the active access token, used to call Huudis APIs on your behalf.
- `huudisRefreshToken` &mdash; used to mint new access tokens when the current one expires.
- `huudisUserId` &mdash; your Huudis user ID, used as the durable identifier.
- `accessExpAt` &mdash; epoch millis when the access token expires (triggers proactive refresh).

The cookie is `httpOnly` (no JavaScript can read it) and `Secure` (HTTPS-only). It can't be inspected from the browser console.

## Single sign-on across products

Because every Forjio product points at the same Huudis instance, you're already signed in to all of them once Huudis has an active session for you. Visit Plugipay after signing into Fulkruma &mdash; you skip the password screen.

You can sign out of one product without signing out of the others: each product owns its own session cookie.

## What can go wrong

- **Email not verified.** If you signed up via email and didn't click the verification link, you can't sign in. Re-request the link from **Sign in &rarr; Resend verification**.
- **Social provider not enabled.** The Google and Apple buttons only appear when the Huudis instance has those providers configured. If you see an error after clicking, the provider isn't wired &mdash; fall back to email/password.
- **Forgot password.** Fulkruma can't reset it &mdash; Huudis owns passwords. Follow the [**Forgot password**](/docs/auth/forgot-password) flow.
- **Session expired.** Cookies live for 30 days of inactivity. After that, you'll be sent back through the OIDC flow on your next page load. No data is lost &mdash; this is just a re-auth.

## Next

- [**Sign in**](/docs/auth/signin) &mdash; the user-facing flow with screenshots.
- [**Forgot password**](/docs/auth/forgot-password) &mdash; password reset.
- [**API authentication**](/docs/api/authentication) &mdash; server-to-server HMAC.
