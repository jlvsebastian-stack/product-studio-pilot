---
name: tracker-craft
description: Create usable trackers with a clear record structure, maintainable fields and summaries that support the buyer's next action.
---

# Tracker Craft

## Planning Contract

For outline planning only, preserve the approved workflow. Name what one record represents, required fields, observable status changes, actionable summary and close or carry-forward behavior. Include a realistic exception within the agreed units. Do not draft rows, invent dashboards or add approvals.

## Production Contract

Define what one record represents, how it is identified and when the buyer adds or updates it. Use only fields needed for the task, with clear dates, units, statuses and allowed choices. Explain how to record incomplete, repeated or corrected entries.

Provide several labeled illustrative records that demonstrate normal use and a realistic exception. Make the next action visible through an appropriate status, filter, due date or compact summary. Do not add an elaborate dashboard when a simple table answers the buyer's question.

For native spreadsheets, create real editable rows, applicable validation, useful frozen headings and formulas for any promised summaries. Verify that adding or changing a record updates those summaries correctly. Keep sample data distinguishable, retain privacy-conscious fields and use the existing Google Sheets verification flow. Preserve the approved task and source instead of turning the tracker into a guide or course.

Define statuses by observable events and explain the allowed transition or next action. A blank due date must not appear overdue; a completed item must not remain in an outstanding total. Use one consistent date convention and a clear reporting period. If time-sensitive status uses TODAY(), say so. A summary needs an explicit numerator, denominator or inclusion rule rather than an unexplained percentage.

Keep identity, status and the next action easy to see together; supporting calculation columns must not bury the recurring task. If a record includes pricing or quantities, retain the same unit and boundary checks as its calculation source, including whole-item counts when the named unit requires them.

Explain the recurring workflow: add the record, update its status, review the actionable list and close/archive it when appropriate. Preserve history during a new week or month; do not tell buyers to erase prior records to reset a summary. Keep stable IDs when names or dates can repeat. Include only personal details necessary for the approved purpose.

In native verification, add a normal record and a relevant exception, then change one status or date and read back the affected count/filter or warning. Check duplicate identifiers and empty rows do not inflate the summary. Verify formulas include intended new rows. Restore the labeled examples and keep QA scratch records outside the buyer file. This stays within the existing production flow with no added questions or approval.

## Reference Basis

Original adaptation of metric definitions, row granularity and missing/duplicate checks from [ai-boost's data_analyst prompt](https://github.com/ai-boost/awesome-prompts/blob/main/prompts/data_analyst.txt), plus dated records and actionable exceptions from [financial_operations_compliance_agent](https://github.com/ai-boost/awesome-prompts/blob/main/prompts/financial_operations_compliance_agent.txt). These patterns inform ordinary trackers; they do not authorize compliance claims or extra sign-offs.

## Visual Design

<!-- Modified 2026-11-02: design guidance adapted from Anthropic skills (Apache-2.0), pinned at ca45fc496a3436251f191354091d557da31c15b5. See THIRD_PARTY_NOTICES.md. -->

- Design for quick repeated entry in Google Sheets: legible row/column labels, consistent dates and units, and readable widths for the actual records the buyer will enter.
- Distinguish editable entries, calculated summaries and status with labels plus restrained color. Freeze useful headings, preserve sortable records and use filters only where they help the promised task.
- Inspect native empty, filled and exception states, including the next usable row and any summary. Avoid decorative layouts, merged record cells or charts that interfere with entry or hide missing data.

## Final Quality Review

- In the actual native tracker, add/update a record and check its dependent count, next action or warning; test relevant blank dates, zero values and status/duplicate edge cases.
- Check legible dates, statuses and units, useful editable rows and coverage for intended new records. Correct safe display formatting without changing approved status rules or formulas.
- Verify the recurring workflow preserves history, then restore test records. Report unchecked behavior and grounded optional improvements through the shared review boundaries.
