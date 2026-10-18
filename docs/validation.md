# Validation record

Date: 18 October 2026. Local development prototype; not a deployed production service.

## Confirmed

- Next.js production build and strict TypeScript checks pass.
- Fourteen automated tests cover money rounding, approval prerequisites, duplicate activation, stale and conflicting delivery dates, invented quotations, payment matching, demo branches, bounded network retries, and sanitized PayPal errors. Checkout tests also cover proposal/version/seller matching, incomplete captures, return/cancel URLs, forged order IDs, order reuse, concurrent return processing, and recovery after a lost capture response.
- Browser walkthrough: create a request, review its classification and citation, prepare and share a proposal, approve it from the client page, simulate a demo payment, and see the added task in the actual Bryntum Gantt.
- Real Groq API smoke test through the app: the fixed fictional request combining a first heading-colour revision and appointment booking was split into included and additional work, with verbatim citations. This is one smoke test, not a measured model accuracy score.
- PayPal Sandbox OAuth authentication succeeds using locally configured credentials. Credentials are not included in source or this record.
- After enabling Invoicing on the sandbox app and refreshing its cached OAuth grant, invoice access succeeds. The existing approved $1 USD sandbox proposal successfully created and sent its invoice.
- The user completed the $1 USD sandbox checkout. ScopePay verified the invoice against PayPal, recorded the proposal as paid, and activated its timeline change without a schedule conflict.
- Environment files, private workspace records, generated vendor files and node_modules are ignored by Git.

## Sandbox checkout completed

A separate $1 USD sandbox proposal was approved and paid by the user with a generated Personal sandbox buyer. The owner payment check matched the invoice ID, proposal reference, currency, full amount, paid status, and PayPal payment transaction. No real-money endpoint was used. Previously issued invoices retain the hosted invoice flow; return to ScopePay and refresh payment status, or use the owner's Check payment action.

## Checkout return flow pending user test

New payments use PayPal Checkout Orders with a return/cancel URL to the private proposal. On return, a POST captures the bound approved order and verifies the completed final capture before scheduling. Cancellation does not trigger capture. Client status refresh now checks PayPal directly. Existing invoice records are preserved and never receive a second checkout order. TypeScript, fourteen automated tests (with mocked PayPal Checkout responses), and the production build pass. A fresh $1 sandbox proposal is shared and awaiting the user's approval and checkout. Live Checkout creation, return navigation and capture still require that user test; the earlier successful invoice payment does not prove the new Checkout flow. Background notifications require a public webhook endpoint and configured webhook ID, which remain unconfigured locally.

## Local test-data recovery

An initial checkout test imported the file store before setting its temporary DATA_DIR and accidentally replaced the local sandbox workspace with its fixture. The test now imports the store only after selecting a temporary directory. The full suite was rerun with a SHA256 check confirming that it leaves the local workspace unchanged. Both original $1 sandbox invoices were retrieved from PayPal and verified as PAID; their proposal IDs, private links and invoice IDs were restored. Associated project/request records and the fictional demo/Groq history were reconstructed, rather than recovered byte-for-byte; historical local timestamps are not an exact original audit trail. The newly shared return-test link was retained without approving it. Recovery copies remain in the ignored local data directory. No real-money endpoint was used.

## Remaining submission work

Public source publication, hosted deployment, appropriately licensed Bryntum access through judging, a broader human-reviewed model evaluation set, submission text and demonstration video remain separate tasks. Mobile CSS breakpoints are implemented; the available in-app browser did not apply a requested narrow viewport override, so mobile-device visual verification is not claimed.
