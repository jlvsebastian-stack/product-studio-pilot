# Design references: findings and application

Reviewed 28 October 2026 for the independent local Digital Product Creator. These sources inform a proposed presentation workflow; they are not instructions to copy their architecture, deploy a service or change the creator's selected model.

## Video review and access

This was transcript reading and sampled still-frame inspection, not a full watching/listening pass. No audio was heard. Native caption requests returned empty responses. Griffin's public transcript mirror and creator-written companion were readable; the other three videos' spoken content remained unavailable. Observations from frames are distinguished from our presentation-specific adaptations.

| Reference | Material reviewed | Useful application |
| --- | --- | --- |
| [Kaiyan Ali: How to Create Interactive Presentations with AI](https://www.youtube.com/watch?v=ki_N7mu-PD0) | Creator metadata/chapters and sampled original YouTube preview sheets; [27:00](https://www.youtube.com/watch?v=ki_N7mu-PD0&t=1620s) shows reference browsing, [68:10](https://www.youtube.com/watch?v=ki_N7mu-PD0&t=4090s) shows a sequence of different visual compositions. | Use concrete references and purposeful visual roles. Review the finished sequence, rather than one renderer feature at a time. The website/publishing workflow is outside our local-app scope. |
| [Griffin Wooldridge: How to Use Codex as a Designer](https://www.youtube.com/watch?v=GOtHFZnagO0) | [Public transcript mirror](https://moderncreator.app/2026-06-08-griffin-wooldridge-how-to-use-codex-as-a-designer), sampled visuals and [creator's written companion](https://griffinwooldridge.com/blog/codex-for-designers). | Persist specific references, style decisions and exclusions. Resolve conflicts between the image reference and written brief. Give targeted visible corrections and inspect the resulting screen; adapt that to actual slide viewing size. |
| [AI LABS: How To Use Codex To Build Insanely Beautiful Websites Using GPT 5.6 Sol](https://www.youtube.com/watch?v=pHstb0JGGhE) | Creator description/chapters and sampled original preview sheets; [16:50](https://www.youtube.com/watch?v=pHstb0JGGhE&t=1010s) onward shows asset planning and coordinated illustrations integrated into compositions. | Plan a coherent asset set and inspect it in the real layout. Transfer hierarchy, image treatment and reference-led composition; do not copy a website stack, hosting or personal brand. |
| [Tutorials by Manizha & Ryan: How to Use Codex for Design](https://www.youtube.com/watch?v=k3FXyDFXdXk) | Creator metadata/description and sampled original preview sheets; [06:00](https://www.youtube.com/watch?v=k3FXyDFXdXk&t=360s) shows a structured app brief and [08:00](https://www.youtube.com/watch?v=k3FXyDFXdXk&t=480s) a coordinated mobile mockup. | A clear brief and rendered concept help establish direction. A mockup is not proof of implemented interaction, editable slides, correct notes or export quality. |

Do not attribute inaccessible narration to a video or treat the sampled frames as a full visual-quality audit. These are useful references, not evidence that our rejected sample met the requested standard.

## Gemini suggestion: apply, modify or reject

| Suggestion | Decision for this project |
| --- | --- |
| Strong title/body hierarchy and weight contrast | Apply. Test actual sizes and viewing conditions rather than requiring a universal 2.5× ratio. |
| Muted body text or 60% opacity everywhere | Modify. Secondary text may be quieter, but contrast is measured on the actual background; do not make teaching copy faint. |
| Left-aligned body copy and grouped spacing | Apply as defaults. A short centered statement or another intentional composition remains valid. |
| At least 40% empty space on every slide | Apply. The creator explicitly retained this minimum on 28 October. Judge the entire composition as well: empty space alone does not establish good design. |
| Exactly three colors; no saturated primaries | Replace with a coherent system of color roles suited to the concept and audience. Restrained and vivid directions can both work. |
| Rotate three slide archetypes | Replace with a broader family selected by teaching purpose; arbitrary rotation is not meaningful variety. |
| Separate structured content from a native Canva master | Apply. This is the most useful production idea. A good master must exist before data filling can preserve its quality. |
| One global five-column table with Accent_Metric | Use only as a simple example. Real comparisons/processes need layout-specific fields; metrics are optional and must be source-backed. Never use the example's invented figures in the creator's product. |
| Bulk Create produces dozens of designed slides | Qualify. It fills prepared placeholders; it does not invent three art directions, create arbitrary diagrams or attach native notes from those columns. Preview a small fill first. |

The role should be a presentation designer for this creator's audience, not a fixed executive-minimalist persona for every product.

## Canva facts and boundaries

[Canva Bulk Create](https://www.canva.com/en_gb/help/bulk-create/) accepts data from Canva Sheets, supported spreadsheet uploads and manual tables, linking columns to prepared text/image placeholders. CSV or Canva Sheets is sufficient for this no-Office workflow. A Markdown table in chat is not automatically an uploaded CSV.

The same help page lists eligible paid/organizational/education plans rather than Canva Free. [Current MCP Autofill documentation](https://www.canva.dev/docs/apps/mcp/tools/autofill-design/) lists Pro, Business and Enterprise and supports a selected existing design or Brand Template after its exact dataset is inspected. Do not assume every tester is eligible, or that this chat's connection is available inside the local app.

Native presenter notes require their own supported writing step and page-by-page readback. A Speaker_Notes column mapped to ordinary text would put notes on the canvas. Placed raster assets remain images; native editability of the deck does not make every image's internal content editable. No native Autofill or Bulk Create run was performed during this research.

## Recommended next implementation

Use three native concept families, each showing the same real lesson content. Let the creator choose, then map the approved slide plan into that concept's actual fields and prove the harder content page before expanding. Keep photos/illustrations separate from editable text and preserve native notes.

AGENTS.md holds the short mandatory workflow. DESIGN.md holds the visual/production contract. The runtime skills and application state must enforce concept selection and sample approval; writing Markdown files alone cannot provide missing graphics, typography, Canva access or chooser controls. The existing rejected renderer must not be presented as the implementation of this contract.

## Readability reference

[W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) specifies 4.5:1 for normal text and 3:1 for large text, measured against the actual background. This is a useful minimum readability check, not a numerical measure of beauty.
