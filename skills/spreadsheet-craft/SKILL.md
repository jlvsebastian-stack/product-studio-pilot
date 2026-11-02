---
name: spreadsheet-craft
description: Create practical spreadsheets with clear input and output structure, useful native formulas and realistic worked examples.
---

# Spreadsheet Craft

## Planning Contract

For outline planning only, preserve the approved model and units. Identify its editable inputs, meaningful calculations, outputs, worked example and relevant missing or invalid input cases. Describe the usable native workbook, not just a report; do not draft cell formulas or add tabs outside scope.

## Production Contract

Define the buyer's task, each tab's purpose and what one row represents. Distinguish editable inputs from calculated outputs. Specify units, field types, validation, references and formulas needed for the approved task.

Provide a labeled filled example and concise instructions for replacing its values. Keep headings readable, freeze useful headers, choose appropriate widths and number formats, and make warnings understandable. Use summaries only when they answer an actual user question.

Native production must create editable cells and real formulas, then read back values and test meaningful input changes. Blank or zero handling must match the field's meaning. Restore starting inputs after tests and keep internal QA logs out of the buyer's workbook. Follow the existing Google Sheets creation and verification action; a text specification or PDF is not a working spreadsheet. Retain all approved scope and source.

Build a small, coherent model: raw inputs feed calculations, and calculations feed the buyer's decision. State the row grain, units and period so amounts from different bases are not mixed. Reference input cells rather than repeating assumptions as hardcoded constants. Explain a non-obvious formula in ordinary language near its output. Use Google Sheets-compatible functions and real native ranges; text resembling a formula is not calculated evidence.

Make the workbook usable after the sample is replaced: formulas and validation must cover the intended new rows, totals must exclude headers and examples when appropriate, and sorting/filtering must not detach records. Do not turn missing data into a misleading zero or hide all formula errors with a blanket IFERROR. Distinguish intentionally blank results from invalid inputs and provide a correction message.

Check a hand-computed example, a changed input and the relevant blank/invalid case through native calculation readback in the existing delivery flow. Test a cross-tab dependency when promised. Confirm the delivered file's inputs remain editable and the instructions explain which cells to change. No new interview, dashboard requirement or approval step.

## Reference Basis

Original adaptation of metric definitions and data-quality checks from [ai-boost's data_analyst prompt](https://github.com/ai-boost/awesome-prompts/blob/main/prompts/data_analyst.txt), formula/source separation from [financial_operations_compliance_agent](https://github.com/ai-boost/awesome-prompts/blob/main/prompts/financial_operations_compliance_agent.txt), and input-reference/constraint reasoning from [Excel Formula Sensei in its data library](https://github.com/ai-boost/awesome-prompts/blob/main/library/en/data.md). These are reference prompts, not a native Sheets engine. Do not adopt the library's text-only spreadsheet simulation or accounting sign-off process.

## Visual Design

<!-- Modified 2026-11-02: design guidance adapted from Anthropic skills (Apache-2.0), pinned at ca45fc496a3436251f191354091d557da31c15b5. See THIRD_PARTY_NOTICES.md. -->

- Use a restrained Google Sheets theme grounded in the buyer’s task: clear sheet names, readable headings and consistent input, formula, result and warning treatments.
- Make units, dates and number formats explicit; use text labels as well as color. Size native columns and rows for real values, and use frozen headings or filters when they help the intended workflow.
- Inspect actual populated and blank states, wrapping, totals and relevant cross-tab navigation. Avoid decorative merged-cell dashboards or charts that impede entry, sorting or calculation checks.

## Final Quality Review

- On the actual native sheet, verify editable inputs, real formulas and a meaningful changed input; test relevant blank, zero and invalid/edge cases and read back the dependent results.
- Inspect legible headers, units, number formats, column widths and warnings; verify intended new rows remain covered. Correct safe formatting defects, not approved formulas or assumptions.
- Restore test inputs and keep QA scratch data out of the buyer's sheet. A source model is not a calculated-file pass; report unchecked cases and grounded optional improvements under the shared review boundaries.
