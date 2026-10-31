# Personal-factor privacy release

Apply `migrations/20261020_personal_factor_privacy.sql` to the intended database
before deploying both updated server and client. Check each database's actual schema;
the presence of this migration file does not establish whether that target is migrated.
Use a coordinated release: the old client cannot write the new explicit answer states.

From the `server` directory, run
`node scripts/applyPersonalFactorPrivacyMigration.mjs` to inspect schema metadata.
To apply missing changes to that same target, use
`node scripts/applyPersonalFactorPrivacyMigration.mjs --apply --target=<targetFingerprint>`
with the fingerprint printed by inspection. The runner verifies both columns,
resumes partial application, and never reads or backfills student records.

Current Yes/No behavior (31 October 2026)
---------------------------------------
New profile writes require explicit `yes` or `no` for all five factors. Yes requires
impact 1-4 and physical/accessibility details where applicable. No stores a NULL
impact and empty physical details; scoring maps No to response 1 (zero normalized
barrier). Yes/slight remains a distinct answer even though its normalized barrier
is also zero.

The column still permits reading older `unknown` and `legacy_unknown` records.
They are historical compatibility states, not selectable or accepted on new saves.
Students must replace them with Yes or No before saving or generating new results.
Do not backfill missing or ambiguous answers as No. Incomplete attempt snapshots
are rejected and can be refreshed from a complete profile through recovery.

WSM uses all five factors and the full configured personal-factor component weight:
normalized impact = (response - 1) / 3;
personal-factor score = clamp(0.5 - 0.1 * sum(relevance * normalized impact), 0, 0.5).
There is no personal-factor coverage multiplier or partial-disclosure reweighting.
The separate explicit No interests behavior is unchanged.

No new schema migration is required for this Yes/No change. Deploy client and server
together. No historical records are backfilled. Saving changed Personal Factors uses the existing
refresh flow for the latest saved recommendation; older assessment history is retained.
Existing NULL historical scores remain readable as Not used. The privacy notice and
Terms versions are updated for new registrations; old agreement records are retained.
