# ScopePay

**Stop doing extra work for free.** ScopePay helps freelance web designers turn "small extra" client requests into approved, paid and scheduled changes.

Built for the PayPal AI Hackathon with Groq, PayPal Checkout (Sandbox) and Bryntum Gantt.

## How it works

1. **Review a request.** Paste a client message. AI checks it against the agreed scope and marks each item **Included**, **Additional work** or **Needs clarity**, quoting the exact scope sentence it relied on.
2. **Send a proposal.** For extra work, set hours, price and extra days, then share a private link with the client.
3. **Client approves and pays.** The client reviews the price and new delivery date, approves, and pays with PayPal.
4. **Work unlocks on the timeline.** Until payment, the new task shows on the Gantt chart as locked behind a payment milestone. Once PayPal confirms payment, it is scheduled and the deadline moves.

No keys are needed to try it: without them ScopePay runs a clearly labelled demo (sample rules instead of AI, simulated payment).

## Quick start

Requires **Node.js 20.9+** (22 recommended).

```sh
git clone https://github.com/Etticx/ScopePay.git
cd ScopePay
npm install
npm run dev
```

Open http://127.0.0.1:3000. Sample projects are created on first launch and saved in `.data/workspace.json` (delete it to reset).

<details>
<summary>Port 3000 in use or blocked?</summary>

Run on another port and point `APP_URL` at it, so payment return links still match.

Windows (PowerShell):

```powershell
$env:PORT="3333"; $env:APP_URL="http://127.0.0.1:3333"; npm run dev
```

macOS / Linux:

```sh
PORT=3333 APP_URL=http://127.0.0.1:3333 npm run dev
```
</details>

## Try the demo (about 2 minutes)

In the demo you play both sides: **you** are a freelance web designer building a website for Bloom Bakery, and partway through you also act as **your client**, Sofia.

**1. Your client asks for something extra.**
Sofia messages you: *"Could we add a page where customers can book a cake tasting?"* Is that in the deal, or is it new paid work?
→ In ScopePay, go to **Client requests → New request**, pick **Bloom Bakery**, click the **Extra feature** example (or paste the message yourself) and review it.

**2. ScopePay checks it against your agreed scope.**
It marks the request **Additional work** and shows the exact scope sentence that proves it: booking was explicitly excluded.
→ Click **Prepare proposal**.

**3. You price the extra work.**
The hours and extra days are already filled in, and the price is worked out from your hourly rate. Adjust anything you disagree with.
→ Click **Save**, then go to **Proposals → Share with client**.

**4. You send Sofia a private link.**
In real life you'd email or message her this link. For the demo:
→ Click **Client link** to open her page.

**5. Now you're Sofia.**
She sees what the change is, what it costs and the new delivery date, plus a timeline with the new work **locked until payment**.
→ Tick the agreement box and click **Approve**.

**6. She pays.**
With PayPal connected, Sofia would pay through PayPal Checkout right here. In the demo:
→ Back in your **Proposals**, click **Simulate demo payment**.

**7. The work unlocks.**
→ Open **Timeline**. The paid change is now on the Gantt chart and the deadline has moved. You never started work you weren't paid for.

Want to see the other outcomes? Try the **Included revision** example (covered by the deal, so no charge) and **Needs clarity** (ScopePay drafts a question to send back to the client).

## Connect real services (optional)

Copy `.env.example` to `.env.local`, fill in what you need, and restart.

| Variable | For |
|---|---|
| `GROQ_API_KEY`, `GROQ_MODEL` | Real AI analysis via Groq |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_SELLER_EMAIL` | PayPal Sandbox checkout |
| `PAYPAL_WEBHOOK_ID` | Background payment updates (needs a public HTTPS URL) |
| `APP_PASSWORD`, `SESSION_SECRET` | Protect the freelancer dashboard (required when hosted) |
| `APP_URL` | The exact address the app is served from |

PayPal step by step: [docs/paypal-setup.md](docs/paypal-setup.md). Sandbox only; no real money is ever used.

## Safety built in

- **AI can't invent scope.** Every Included or Additional verdict must quote the scope word for word, or it is downgraded to Needs clarity.
- **Payment is verified with PayPal**, never trusted from the browser: order, amount, currency, seller and proposal version must all match. A payment is never counted twice.
- **Clients answer one exact version.** Revising a proposal replaces its link, and an out-of-date delivery date can't be approved.
- **Prices use whole cents.** Totals under $0.01 are refused.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

## Hosting

Runs as **one Node.js server with a persistent disk** (data is a JSON file, not a database). On Render: build `npm ci && npm run build`, start `npx next start --hostname 0.0.0.0 --port $PORT`, set `DATA_DIR` to a folder on the disk, and set `APP_PASSWORD`, `SESSION_SECRET` (32+ characters) and `APP_URL`. Serverless or multi-server hosting would lose data.

## Limits

- One freelancer per workspace; clients use private links instead of accounts.
- AI accuracy has not been formally measured yet ([docs/evaluation.md](docs/evaluation.md)).
- PayPal runs in Sandbox mode only.

## Tech and licences

Next.js 16, React 19, TypeScript, Zod, Radix UI Dialog (MIT), Lucide icons (ISC), Groq, PayPal Orders API.

ScopePay's own code is [MIT](LICENSE). **Bryntum Gantt is commercial software** used here through its public trial package: `npm install` copies it into the git-ignored `public/vendor/bryntum/`. Do not commit or relicense those files, and use a proper Bryntum licence for anything beyond evaluation.
