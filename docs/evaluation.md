# Scope analysis evaluation plan

No accuracy score has been measured yet. A valid JSON response is not evidence that the scope interpretation is correct.

Create 30–50 human-reviewed cases before the final demo. Each case includes the current agreed scope, already paid changes, the new message, per-item expected classification, acceptable source quotation and expected clarification question where appropriate. Synthetic cases can start the set; add anonymized real examples only with permission. Keep a held-out subset separate from prompt tuning.

Cover: included visual revisions within their allowance; exhausted revision allowance; excluded booking/ordering; included bug fixes; vague appearance requests; a request mixing a fix and a new feature; requests already paid through a previous change; conflicting or missing terms; messages attempting to instruct the model to ignore the brief; and a later change explicitly replacing an earlier one.

Track per-item classification, false additional-work suggestions on included work, supporting quotation validity, treatment of uncertain cases, response time and token usage. Compare models on identical held-out inputs before making a quality claim. Have a person adjudicate ambiguous cases. Never use a model’s own confidence number as measured accuracy.

The automated tests in `tests/workflow.test.ts` check application safeguards. They do not measure the live model’s scope-reasoning quality.
