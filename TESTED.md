# Local pilot evidence — 27 October 2026

PASS:12 focused tests cover subscription-only provider status; credential-environment and tool isolation; explicit vendor sign-in; correct JSON parsing; process termination confirmed before release (including an actual owned background process); held ownership when termination is unconfirmed; skill-driven interviews; local Host/Origin and source-file boundaries; review-gated ZIP/download behavior; and port reuse/fallback.

PASS: actual official Codex0.157.1 and Claude Code2.1.311 package binaries resolve on Windows. Existing ChatGPT subscription status is connected. Claude is installed but not signed in locally; no eligible Claude Code connection or live Claude reply was tested. Product Studio reads neither provider's credential file.

PASS: real subscribed ChatGPT inference through localhost. A vague marketing/everyone answer produced a specific follow-up and stageReady false. A separate real UI test with an explicitly illustrative craft-fair scenario asked about checklist selection decisions, preserved that detail in the brief, and did not invent results or advance automatically.

PASS: isolated browser DOM checks for provider selection, signed-out Claude state without starting sign-in, optional-app instructions, actual conversation/brief update, Save/Open project and reload, rejection of stage13 imports without replacing work, fresh review after edits, stale-link removal, and unsent answer preservation across workspace tabs. No desktop controls or local Office apps were used.

PASS: actual PDF and Markdown downloads through the current browser interface from a labeled content-complete fixture. The PDF has two pages and preserves the final paragraph and literal underscores; the text file preserves the final paragraph. This is an export fixture, not a completed real-creator trial. The unchanged DOCX/PPTX exporter retains earlier accepted native-text/content evidence.

PASS: clean extracted ZIP on Windows ran Start.cmd, installed pinned dependencies, and started its own server on a separate test port. The test instance was stopped afterward. Start.command is tracked executable and passed Bash syntax checking; actual macOS execution is not available here. The source uses platform-specific official helper binaries.

Independent review found unsent-composer loss and early process-release defects. Both have focused fixes and regression checks; final correction-only review is recorded in the task evidence.

UNRUN: actual Mac launch/sign-in; live Claude inference; native Canva/Docs/Sheets creation; another person's subscription installation; and an independent complete twelve-stage creator product. These are not established by source or simulated-provider checks.

The hosted MCP experiment was replaced with this local app. No Vercel or shared AI backend is required. PDF/text are default; Canva and Workspace are optional, with setup instructions and an honest unverified-native-creation label.

PASS: final correction-only independent review at runtime source e5792890988ac68fee8e9592aa1dfa169ccbe5e7 resolved both demonstrated findings; lifecycle regressions2/2 and actual composer checks passed. Later evidence-only documentation changes do not alter that reviewed runtime.

## Simple installation and launch

PASS: combined suite20/20 after the launcher change: the original12 checks plus8 installation/launch checks. Isolated installation records the real app/runtime and writes matching Codex/Claude launcher skills; repeat setup is idempotent and unrelated existing files are preserved. Actual detached-server health, same-instance reuse and health after the launching command exits are verified. Missing installs, missing runtime, early process exit and hung startup fail truthfully. The official skill validator accepted the launcher skill.

PASS: the actual Windows launcher command returned the existing local app URL, its OS browser-open command completed successfully, and the app health endpoint remained available after the launch command exited. The resulting external default-browser tab was not observable through the attached browser controls; visual proof of that automatic opening remains UNRUN. Unit coverage verifies the exact ready URL passed to the opener.

UNRUN: fresh-chat automatic skill selection; installation on another person's computer; actual macOS execution. The installation guide requires local execution tools and never claims that a cloud-only chatbot can install on the user's computer.
