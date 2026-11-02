# Final Quality Review Implementation Plan

**Goal:** Complete each product with a concise format-aware buyer-use review, automatic obvious in-scope fixes and at most three grounded optional improvements with reasons, without another interview, approval gate or AI round trip.

**Approved design:** Reuse the existing full-draft and native creation turns and existing review workspace. Review source while drafting; review the actual native file during production. Preserve approved wording, facts, formulas, artwork and notes. Source checks cannot claim native visual or calculation proof. Apply safe layout/formatting corrections only within the existing job's authority; hold unknown writes and respect read-only recovery. Suggestions never become automatic product expansion.

**Approaches:** A separate reviewer agent/request would add latency; a new approval stage would lengthen the process. The selected approach embeds the check in existing generation/production, with bounded result metadata and existing Save/Open persistence.

**Architecture:** Shared final-review contract and existing format routing; source-bound review metadata on projects/native jobs; a compact review section in Your product and Files. No dependencies or hosting changes. Separate from KKY.

- [x] Prove missing full-draft review/persistence and native-report behavior with focused failing tests.
- [x] Add bounded shared review metadata/instructions; retain exact manuscript-edit and approval guards, max three grounded optional improvements.
- [x] Add short format-specific final-review sections to the existing skills; preserve planning/slide constraints and pacing.
- [x] Integrate review/fixes/reporting into existing Google/Canva production turns; preserve native proof and read-only/no-duplicate guards.
- [x] Show and persist only current-source reviews, safely escape text and retain older projects; no new primary action or approval gate.
- [x] Run focused checks, one independent review and one combined live acceptance with actual output; inspect normal UI and Save/Open. Record precise limitations; no automatic broad rewrite or public release.
