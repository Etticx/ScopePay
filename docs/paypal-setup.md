# PayPal Sandbox setup, step by step

Your real PayPal email signs you into the Developer Dashboard. It is not the test buyer we need for checkout.

There are two separate generated test accounts:

- **Business (seller):** receives sandbox payments. Its email goes in `PAYPAL_SELLER_EMAIL`. The REST app must be linked to this business account.
- **Personal (buyer):** pays the sandbox invoice with pretend funds. Its generated email goes in the ScopePay project's **Client email** field. Keep its password for your own sandbox checkout login.

## Find or create a test buyer

1. Open https://developer.paypal.com/dashboard/accounts and sign in to the Developer Dashboard.
2. Under Testing Tools → Sandbox Accounts, look for a row with Type **Personal**.
3. Open that account's details to see its generated email and sandbox password. An automatically generated buyer email often looks like `sb-xxxxx@personal.example.com`.
4. If there is no Personal account, choose Create Account, select Personal, choose a supported country, and create the account.
5. Use this generated buyer email in a new ScopePay test project. Do not use the business seller email as the client.

## Configure the app

Apps & Credentials → Sandbox → Create App. Choose Merchant, select the sandbox business seller, and create the app yourself. Its display name can differ from ScopePay.

Store the Client ID, Secret, and linked business email locally in `.env.local`. Never share credentials in chat, source control, screenshots, or the public repository. A webhook is optional for the local prototype; the owner can verify payment with **Check payment**.

Under the sandbox app's Features, enable **Invoicing** and save. OAuth authentication alone does not prove invoice access. Run `node --env-file=.env.local --import tsx scripts/diagnose-paypal.ts` to check the invoicing scope and invoice API permission without printing credentials. If permissions were just changed but the token still lacks the scope, run the same command with `--fresh-token` once to refresh PayPal's cached grant. Retry the existing approved proposal so its invoice and approval are preserved.

## End-to-end checkout

Create a small test proposal (e.g. $1 USD), review and share it, then approve it from the client page. ScopePay creates a sandbox Checkout order. Open its PayPal Sandbox payment link and sign in using the generated Personal test account. You complete checkout yourself using pretend funds. PayPal redirects back to the private ScopePay proposal; the app captures and verifies payment server-side before showing confirmation and updating the plan. Cancelling checkout returns to the approved proposal without capture. If verification needs a retry, use **Refresh payment status**. No real-money endpoint is configured in the code.

Set `APP_URL` to the exact address serving ScopePay (locally, `http://127.0.0.1:3000`; hosted, your HTTPS origin). Local callback processing does not require a webhook. For background capture notifications after hosting, subscribe the configured webhook to `PAYMENT.CAPTURE.COMPLETED`. Keep `INVOICING.INVOICE.PAID` for previously issued invoices.

Existing invoice proposals keep the invoice flow: PayPal's hosted invoice page stays open after payment. Return to that proposal and use **Refresh payment status**, or the owner's **Check payment**. Checkout is used for proposals that do not already have an invoice; paid records are never reset for testing.

Keep fictional demo records separate from sandbox invoices. Existing demo proposals do not become PayPal transactions when credentials are added.
