# Respect explicit model choices and check access

The creator selects the provider, model and quality. Preserve those choices through reload and retry. Never substitute another model to work around a failure.

The bundled Codex 0.157.1 rejected an actual Sol High request with model_not_found. The same normal subscription-only provider adapter succeeded with official Codex 0.164.0, without changing sign-in, credentials, permissions or model. Pin that corrected helper in the downloadable app.

Before enabling Send or Retry, automatically verify the exact selected provider/model/quality with a tiny structured connection request through the existing provider lifecycle. Successful checks stay quiet, without an access-confirmed label or extra success action. Show checking or an actionable problem only. A static model catalog is not access proof. Cache successful checks briefly in the running server and browser, invalidate on sign-in or inference failure, and keep transient failure and concurrent requests honest. Rapid selection changes must not accept stale results or lose the saved project/draft. A failed check keeps the explicit selection and asks the creator to choose or retry.

Backend owns provider checks, local route and focused model-access regressions. UI owns the small selection/check coordinator, visible status and focused stale/busy/preservation checks. Root owns dependency/version/docs, one integrated suite, actual Sol High local UI acceptance, one independent exact-head review, public source/ZIP update and normal-server handoff. No KKY access, hosted backend, provider-account changes, generic fallback or unrelated refactor.

Acceptance: pre-fix native rejection and post-fix Sol High success; exact selection reaches the helper; unusable choices cannot send; stale checks cannot enable another selection; drafts and projects survive; normal endpoint validates the current selection; actual rendered Sol High preflight, a separate normal local interview request and creator-project reload work. Technical interview fixtures are not saved into the creator's project. Live Claude and macOS remain UNRUN where unavailable.
