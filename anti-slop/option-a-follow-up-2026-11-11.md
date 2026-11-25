# Option A — follow-up

Approved scope: monitor 42 leaf reporters under 22 parent units, preserve existing chart appearance and document verification.

- Shared organization master and optional explicit parent/subunit identity on new quarterly records.
- Legacy exact leaf names resolved without modifying stored documents; unknown names visibly excluded from coverage (C-5 evidence over claims).
- Coverage includes missing reporters, deduplicates latest submissions, isolates year/quarter and ignores document status/search filters (C-2 functional completeness).
- Four quarterly bars retained; unit view groups 22 parents with horizontal scrolling and drills into children through the existing unit filter (C-3 content-driven composition).
- Existing palette/components retained; reporter details and completeness are scrollable (C-4 resilience).

Evidence: four organization tests pass, production build succeeds, no editor diagnostics in changed TS/TSX files. Browser confirms 42 expected reporters, 22 parent bars, four Rektorat children, four quarterly bars, unchanged coverage under status filtering, and no desktop document overflow. No test reports submitted or stored records rewritten.

Limits: existing workflow test suite fails before execution at pre-existing malformed Period type in src/utils/workflow.ts. Annual input still uses its existing identity; annual documents are excluded from quarterly coverage. This is not backend or multi-user reporting. Mobile visual regression and full end-to-end submission/revision were not exercised in this change.
