# ScopePay

A friendly workspace for freelance web designers to turn extra client requests into reviewed, approved, paid and scheduled changes.

## Run locally

Requires Node.js 20.9+ (Node 22 recommended) and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. The development server binds to loopback.

If Windows reports `listen EACCES` on port 3000, the port is in a range reserved by Windows. Use another port, and point `APP_URL` at it so origin checks and PayPal return links still match:

```powershell
$env:PORT="3333"; $env:APP_URL="http://127.0.0.1:3333"; npm run dev
```

On macOS or Linux:

```sh
PORT=3333 APP_URL=http://127.0.0.1:3333 npm run dev
```
 Demo data is created on first access and persists in `.data/workspace.json`. This file is private and ignored by Git.

## Try the complete demo

1. Open **Review a request** and select Bloom Bakery.
2. Choose the **Extra feature** example and review it. Without a Groq key, the result explicitly says **Sample rules · not AI**.
3. Prepare a proposal, confirm hours, price and additional calendar days, and save the draft.
4. Open **Proposals**, share the proposal, and use **Open**.
5. In the client view, check the agreement checkbox and approve. This is a local demonstration, not an actual client agreement.
6. Refresh the owner’s Proposals view and choose **Simulate demo payment**.
7. Open **Timeline**. The paid addition appears in the actual Bryntum Gantt component, linked to the last existing task. Before payment, both the client and the owner see it locked behind a payment milestone. Try **Included revision** and **Needs clarity** for other branches.

Simulation is separate from PayPal Sandbox and is never represented as a real payment or live AI output. API failures do not silently fall back to fake success.

## Connect Groq

Copy `.env.example` to `.env.local` and set `GROQ_API_KEY`. `GROQ_MODEL` defaults to `qwen/qwen3.8-27b`; select a currently available model supporting Groq strict JSON-schema outputs. Restart the app. Keys are only read on the server.

The app supplies the current project scope and previously paid additions to the model. Structured output is validated with Zod and supporting quotations must match the supplied scope verbatim. Missing, fabricated or very short citations are downgraded to clarification, and unverified quotations are never displayed. The freelancer reviews suggestions and confirms estimates. Prices are calculated in integer cents by ordinary code.

Optional live smoke check (sends only the fixed fictional Bloom Bakery scope and message to Groq, using your API key): `node --env-file=.env.local --import tsx scripts/check-groq.ts`. Run only when you intend to make that external API call. It checks a mixed visual-revision / booking request; it is not a benchmark.

There is no custom model training or vector database in this version. Agreements are short and sent as direct context. Larger document collections could justify RAG later. See `docs/evaluation.md` for the proposed evaluation set; model accuracy has not yet been measured.

## Connect PayPal Sandbox

1. Create a sandbox REST app in PayPal Developer. Use sandbox credentials only.
2. Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_SELLER_EMAIL` (sandbox business seller).
3. Create a project with your **sandbox personal buyer’s email**. The seeded example addresses are fictional.
4. Create a **new** proposal after enabling credentials; its mode will be PayPal Sandbox. Existing demo proposals remain demo records.
5. On client approval, ScopePay creates a PayPal Checkout order with return and cancel URLs pointing to the private proposal. If preparation fails, approval is retained; the owner can retry **Prepare checkout**. If PayPal has expired an unpaid order, **Prepare checkout** replaces it.
6. Pay through the sandbox checkout link using the sandbox buyer. PayPal returns the buyer to ScopePay, which captures the approved order server-side, verifies the full payment, and activates the agreed addition. Cancelling returns to the approved proposal without capturing. If the buyer lost the return page, **Refresh** on the client page finishes the capture of an approved order; the owner can also use **Check payment**, which only reads the status. Local return processing works without webhooks.
7. For background updates, expose the app through your own public HTTPS deployment, register `/api/paypal/webhook` for `PAYMENT.CAPTURE.COMPLETED`, and set `PAYPAL_WEBHOOK_ID` and `APP_URL` to that deployment’s exact origin.

Verification checks webhook signatures (when using webhooks), the authoritative order, proposal reference/version, amount, USD currency, and completed payment status. Orders require the configured seller and a completed final capture. A return URL alone never proves payment. Capture request IDs and workflow activation are idempotent. Repeated callbacks and webhook events do not add duplicate work. Capture only runs from the client page, after the buyer has approved checkout on PayPal.

Approvals are tied to an exact proposal version. Shared/approved proposals are locked. A client requesting revisions permits a new draft; saving it rotates the private link and increments the version. If the schedule has moved since a proposal was priced, the client cannot approve it and is asked to request a revision. If a payment still arrives after the schedule moved (for example, two changes approved together), it is recorded but held for review rather than silently changing an accepted date; the owner can then use **Add to end of timeline** to schedule it after the current deadline.

## Bryntum and open-source design

The interface uses original light-theme CSS, Radix UI Dialog (MIT), and Lucide icons (ISC). Our application source is MIT licensed.

Bryntum Gantt is a **commercial dependency**, not covered by our MIT license. This prototype uses its public evaluation package. `npm install` copies the trial bundle, theme and fonts into ignored `public/vendor/bryntum/` for on-demand browser loading; these generated vendor files must not be committed or relicensed. Retain Bryntum’s evaluation notices. Confirm an appropriate Bryntum license and evaluation period before publishing a hosted submission, and ensure the demo remains available throughout judging. Replace the trial package with an appropriately licensed distribution when required. The timeline loads on demand, on the owner timeline and the client proposal page, and is read-only; schedule data is controlled by verified workflow actions.

## Storage, authentication and hosting

To keep the first single-freelancer version small, it uses a JSON store rather than requiring Supabase. Changes are serialized and written atomically in **one Node.js process**. This is suitable for a local prototype or one server with a persistent volume. It is not suitable for multiple replicas or ephemeral/serverless filesystems. Back up `.data/`; deleting it resets the demo.

For Render, use one Node web service, a persistent disk, `DATA_DIR` pointing inside that disk, build command `npm ci && npm run build`, and start command `npx next start --hostname 0.0.0.0 --port $PORT` (Render’s Linux shell expands `$PORT`). A stateless free service would lose local records on restart; use persistent storage or replace the repository with a database before hosting there.

Before any hosted deployment, set a long `APP_PASSWORD`, a separate random `SESSION_SECRET` of at least 32 characters, and the correct `APP_URL`. Production denies access without configured authentication. The signed owner cookie is HttpOnly, SameSite=Lax and Secure in production. This is one owner workspace, not a multi-tenant SaaS product. API keys and service credentials must remain server-side. Client links are bearer secrets: only share them with the intended client. Pages use no-referrer and noindex policies.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests cover money rounding, approval prerequisites, payment matching, replay protection, stale scheduling, invented citations, demo classification branches, session and origin checks, owner and client routes, webhook signatures and login limits. Live Groq and PayPal validation requires your credentials and sandbox accounts; those results must be reported separately from the local demo checks.

## Hackathon deliverables

- A functioning local prototype with account-free walkthrough and optional live Groq / PayPal Sandbox adapters.
- Public source repository with this README and top-level license (publish when ready).
- Hosted URL or complete local setup instructions, plus a public YouTube demonstration under three minutes.
- Disclose Groq, selected model, PayPal APIs, Bryntum, Radix, Lucide and AI development tools in the submission.

The app is not deployed, this project is only for Paypal AI Hackathon, and no live payment is enabled by default.
