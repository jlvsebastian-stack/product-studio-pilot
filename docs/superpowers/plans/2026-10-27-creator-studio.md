# Creator Studio Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development. Root coordinates one independent review and one combined acceptance; avoid duplicate audits.

**Goal:** Deliver the approved branded local studio, personal learning, controlled creation, explicit model choice and visibly designed product exports.

**Architecture:** Extend the current vanilla browser app and Node server. Browser-local project/profile storage is separated; approved preferences are supplied to every bounded AI call. Keep existing subscription isolation and download contracts; add one designed-preview endpoint using the same layout as export.

**Tech Stack:** Existing Node22+, vanilla browser modules, Zod, pdf-lib, docx, pptxgenjs; reuse libraries and install footprint.

**Spec:** ../specs/2026-10-27-creator-studio.md

## Global constraints
- Separate app/repo, no KKY platform access, hosting or shared AI account.
- Read-only/DOM browser controls in fresh isolated tabs; never open desktop Office applications or take over the user's tab.
- Windows implementation proof; actual Mac and paid Claude inference remain UNRUN unless available.
- Explicit preferences remembered, inferred ones confirmed; exported files contain only intended product content, not private preference profiles.
- Root owns Git index, server wiring, package scripts/docs and integrated verification. Workers do not commit or push.

## Shared interfaces
- Existing brief string fields retained. Backend worker adds `designPlan` and `listingCopy` strings (default empty). Image asset is separate request `coverImage` data URL, max1MB PNG/JPEG, not an AI-produced brief fact.
- Interview request extends existing payload with `model` string, `reasoningEffort` (`medium`/`high`/`xhigh`), `preferences` [{id,text,category,source}], `approvedDraft` string, `revisionIntent` boolean. Existing requests remain valid via defaults.
- Interview response retains message/stageReady/summary/brief; adds `suggestions` [{title,why,basis}], `preferenceUpdates` [{text,category,source,evidence}], `companions` [{title,format,why}] with bounded arrays/defaults. Preference categories voice/design/workflow. Sources explicit/inferred. Explicit updates must quote evidence from current creator input; inferred never auto-saved. UI may edit remembered preferences as explicit instructions.
- Backend `src/models.js` exports `modelCatalog` object keyed chatgpt/claude, lists of {id,label,recommended}; root serves GET/api/models. Model/effort validated by provider, no silent fallback. Explicit model is passed to official CLI. UI labels Selected model, not unverified actual inference metadata.
- Design `previewProduct(project, {coverImage}={})` returns {pages:[{svg,title,purpose}],pageCount}. `exportProduct(project, {coverImage}={})` keeps existing {files,pages}. Root POST/api/preview-product accepts {brief,coverImage}; export endpoint includes same asset. Design plan maps section headings to layout/purpose; default or invalid plan falls back safely without omitting manuscript.
- Static UI module `public/studio-store.js` if needed; root serves explicit static allowlist and fonts if provided by design worker. UI requests preview after draft changes with stale-response protection and displays SVG as image/data, not unsanitized HTML.

## Review focus
- Old browser project/checkpoint migration, unsent answers, multiple-project retention, storage failures.
- Explicit vs inferred preference evidence; forgetting must not be undone by resending old transcript.
- Approved text changed/erased by AI, revision/undo, stage gates, suggestions lacking creator grounding.
- Model parameters actually reach the CLI; unavailable accounts/models fail truthfully without API fallback.
- Long content, graphic/text overflow, literal symbols, sample images, editable source parity and stale preview/export.

### Task1: UI, projects and creator preferences
**Owned:** public/index.html, public/app.js, new public/studio-store.js and test/studio-store.test.js. Own UI alone; coordinate schemas above with backend/design peers.
- [ ] Add focused failing tests for retained projects/migration, explicit preference evidence vs inferred confirmation, edit/forget/pause and storage failure.
- [ ] Implement minimal local state/profile helpers; build branded header/buttons, project picker/backup, preferences panel and selected-model controls.
- [ ] Add approve sample/section, explicit revise and previous-approved undo; show changes and grounded suggestions. Use backend schema; last approved draft remains separate from AI proposal.
- [ ] Request and display actual designed previews, optional image upload, companion choices and listing copy. Preview/exports must reflect current edits and approvals.
- [ ] Verify focused tests and one bounded desktop/mobile browser pass after root runtime handoff; preserve existing work. Report completion/blocker to root with evidence.

### Task2: Enforced interview, models and skills
**Owned:** src/product.js, src/interview.js, src/providers.js, src/models.js, test/harness.test.js; existing creator-interview/product-craft/workbook-craft skills. No local-server.js or public files.
- [ ] Add meaningful pre-fix failing tests for preference provenance, stage/data gates, preserved approved text, explicit model/effort arguments and relevant companion outputs.
- [ ] Implement shared request/response defaults. Stage/craft instructions separate confirmed facts from suggestions; protect approved prefix except explicit revision; constrain early drafting and request feedback.
- [ ] Add small validated model catalog and explicit official CLI parameters. Preserve token/environment/tool/process isolation. No automatic model/provider fallback or test-account resets.
- [ ] Ground explicit memory updates to quoted current input; remove guesses from auto-save. Suggestions explain basis; completion offers companions/listing support without fabricated proof.
- [ ] Run focused harness/provider checks, notify UI/root of completed contract, report complete/blocker.

### Task3: Purposeful previews and real exports
**Owned:** src/exports.js, new src/page-design.js/helpers, fonts and scripts/prepare-fonts.js if needed, test/design.test.js and design fixtures, new format/design skills. No product.js/public/local-server.js changes.
- [ ] Add failing checks for real preview pages, purposeful layouts, retained complete text, graphics, optional image safety and editable exports.
- [ ] Build a small shared layout pipeline for PDF/SVG preview/PPTX. Use existing manuscript as authority and optional designPlan metadata; prevent clipping and omissions. Prefer native vector shapes/diagrams and readable typography; no arbitrary generated assets or false native claims.
- [ ] Add format-specific design instructions and appropriate font assets with license/provenance. Retain text export/project checkpoint contract and correct author.
- [ ] Produce content-complete illustrative sample with realistic useful content through root's normal UI; inspect actual rendered PDF and editable text. Report complete/blocker with actual evidence; Mac/cloud remain clearly UNRUN.

### Task4: Root integration, review, acceptance and distribution
**Owned:** src/local-server.js, package.json/lock only if needed, docs, README/TESTED, artifacts and Git.
- [ ] Wire explicit static routes, model catalog, designed preview and coverImage export. Retain local Host/Origin boundaries, body/download limits and truthful errors.
- [ ] Update package test script with meaningful suites; run one combined test pass once workers complete. Correct only demonstrated failures.
- [ ] Freeze candidate and obtain one independent exact-head review; correction-only re-review where needed.
- [ ] Start reviewed runtime locally without extra browser takeover, preserve old browser work, run combined UI/provider/export acceptance and inspect complete rendered pages.
- [ ] Publish reviewed source to existing public GitHub repository, refresh source ZIP, show actual local app and concise limits.
