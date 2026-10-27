---
name: product-page-design
description: Shape an approved digital-product manuscript into purposeful guide pages, workbook exercises or presentation slides for the local designed preview and file exporter.
---

# Design the reader's task

Keep brief.productDraft as the complete reader-facing manuscript. Design metadata never replaces, abbreviates or silently removes approved teaching, examples, exercise instructions or source URLs. Preserve the creator's wording unless they request revision. Use the current creator as the author.

Choose a visual purpose for each main section. Teaching explains a judgment, examples show its application, steps express a real sequence, exercises support a concrete action, checklists test observable criteria, and summaries identify the next useful action. Use diagrams only for relationships or ordered steps actually present in the text. Do not invent chart values, results or evidence for decoration.

Put optional metadata in brief.designPlan as a JSON string:

```json
{"sections":[{"heading":"Exact manuscript section heading","layout":"steps","purpose":"Follow the actual process"}]}
```

Allowed layouts are teaching, steps, example, exercise, checklist and summary. Match existing headings and use a short purpose. Invalid or unknown metadata falls back to safe layout inference. Add no backstage layout instructions to productDraft. The cover is automatic.

Read the format reference that matches the creator's deliverable: [guides and PDF](references/guides-pdf.md), [presentation slides](references/presentation-slides.md), or [Google Docs and editable text](references/word-text.md).

Use native editable lines, checkboxes, circles and text for suitable process and review graphics. An optional creator-supplied PNG or JPEG is separate from the manuscript and preference profile. Canva is the presentation destination and Google Docs the written-document destination. Do not claim image generation, a Canva design or its notes, a Google Workspace file, video or other native output was produced without actual evidence. Local PDF and Markdown are fallbacks, not completed native cloud files. Do not offer Microsoft Office downloads.

Before expanding a representative sample, use actual verified Canva or Google Docs links for review when connected, or the local PDF/Markdown fallback. Draft sample files are visibly marked DRAFT SAMPLE — for review and have -sample filenames. They require substantive current sample content but do not imply final approval, sale readiness or an actual native cloud upload. Bring the creator's feedback back into the current project before continuing.
