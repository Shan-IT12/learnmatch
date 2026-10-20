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

The new nullable JSON column distinguishes `yes`, `no`, `unknown` (unanswered or
prefer not to answer), and `legacy_unknown`. Yes requires an impact of 1–4; No
and unknown store NULL impact and no accessibility details. Historical ambiguous
impact=1 stays unchanged and is labelled legacy_unknown when read, never guessed.
Historical unambiguous impacts 2–4 remain Yes. Students can explicitly replace any
historical answer or decline to answer. Saving without changing an ambiguous answer
preserves its value and explicit legacy_unknown state.

No backfill or historical-results recalculation is included. Old snapshots and their
explanations remain as originally saved. New calculations omit unknown factors and
renormalize the remaining component weights. Each disclosed factor uses one fifth of
the configured personal-factor weight; unknown factors contribute neither score nor
weight. With all factors unknown the entire personal-factor component is excluded.
Saved NULL personal_factor_match is displayed as Not used.

Profile changes refresh the latest recommendation using the existing refresh flow;
older assessment history is retained. Browser cleanup removes local drafts only.

Before rollback, account for explicit answer states and NULL scores: the old code
cannot safely interpret them. Do not backfill unknowns as No for compatibility.
