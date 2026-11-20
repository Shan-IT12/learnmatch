# Administrator and Course Validator workflow

## Local setup and release configuration

1. Use the existing LearnMatch schema with the course draft, source review, source check and publication migrations applied. Local development supports MySQL 8. Rehearse production releases on the exact production MySQL version. Take and verify a database backup before applying the new migration. Confirm the target with `SELECT DATABASE(), VERSION();`.
2. Run [20261120_add_course_validation.sql](../server/migrations/20261120_add_course_validation.sql) once. In a MySQL client connected to the intended database, use `source C:/dev/learnmatch/server/migrations/20261120_add_course_validation.sql` or use the equivalent absolute path for that host. The server does not run migrations at startup. MySQL DDL commits per statement, so inspect the schema after any interrupted migration before continuing.
3. Use the existing `DB_*`, `JWT_SECRET`, `FRONTEND_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `SOURCE_APPROVED_PUBLISHER_HOSTS` settings. In production set `NODE_ENV=production` and `FRONTEND_URL=https://www.learnmatch.online` for the API's allowed client origin. Staff emails use `https://www.learnmatch.online` in production even if `FRONTEND_URL` still points at localhost. Local staff email links require `NODE_ENV=development` or `test` and a loopback `DB_HOST`. For local delivery tests use the email sink in the integration test. Existing source publisher and matching-profile checks apply to publication. In local development set the client's `VITE_API_URL` to the local backend and start the server and client with their existing commands.
4. Credentials and signature images are stored in MySQL and served through authorized download routes. Configure the database and reverse proxy for requests over 1.6 MB and MySQL packets over 2 MB. Accepted uploads are standard non-interlaced PNG files up to 1 MB and four million pixels. Include the private tables in access-controlled database backups and apply the platform's retention and access policies to those backups. Protect database and backup access as you would password and assessment data.

Before the validation migration, a local development server supports existing Administrator username sign-in, public catalog reads and College course search. Staff email sign-in, review and publication actions require a migrated database. During manual testing, use the demo frontend and its dedicated API port to keep test email in the local inbox.

## Administrator setup and recovery

Authorized platform operators with API and database access run the setup script from `server`.

```powershell
node scripts/setupAdministrator.mjs link 123 admin@example.org
node scripts/setupAdministrator.mjs provision internal-username admin@example.org "Full Name"
```

Use `link` to retain the existing internal Administrator ID. Confirm the correct mailbox with the account holder before running setup. If the address is unknown, leave the existing Administrator on the username sign-in shown on the login page while the operator verifies the address. If email delivery fails, rerun `link` with the ID printed by the command. The emailed link expires in one hour and completing it links the verified mailbox and sets a password. An account with a verified mailbox signs in by email and uses **Forgot password** for recovery. Setup and recovery invalidate earlier sessions. Keep at least one working Administrator session or verified recovery mailbox during rollout.

## Administrator use

- In **Validators**, send an invitation to the expert's address. After email verification, download their private credential and record an approval, correction request, or rejection. Approve the requested clusters supported by the credential. Use **Remove validator** beside the account, enter a reason, and confirm. This ends access and makes unfinished assignments available to reassign. **Removed validators** retains account history and signed evidence stays attached to the reviewed course version.
- In **Manage Courses**, open a saved draft and its **Course validation** panel. Complete the course, matching profiles and required source confirmations. Choose an approved Validator in the course cluster and confirm **Send for Validation**. Assignments, decisions and saved source edits appear automatically on the open workflow pages.
- For existing courses use **Validate a cluster**. Confirm the displayed list of eligible saved versions and the Validator. Existing courses stay available during review. The cluster shows current totals and preserves each batch's original decisions.
- If a draft needs changes, use **Edit Draft**, save corrections, refresh or record source confirmations as necessary, and resubmit. For a published course, use **Create replacement draft**. The draft uses the existing editor while the published course and its stable ID remain available. Publish the approved replacement from the draft's **Review & Publish** panel. The original stable course code and ID remain in use, and earlier approvals are retained as history.
- To publish a new course or replacement, record the separate matching-profile review and get a signed expert approval for the exact saved version. The publication requirements update automatically. Once all checks pass, confirm and publish. The public course page also updates its validation status automatically.

## Validator use

1. Open the invitation, submit one credential and acknowledge the displayed terms and privacy notice. Open the follow-up verification email. The verification page checks for approval while open and takes you to Validator sign-in after approval. You can also sign in at `/validator/login` to check your status or submit corrected evidence. Use **Forgot password** to recover access.
2. When approved, open **My Reviews**, choose an assignment, and review each saved course, its sources and matching profiles. Record remarks and choose **Approve** or **Request Changes** for each reviewed course. Leave the selector at **Decide later** for any course you have yet to review.
3. Check the list under **Confirm selected decisions**. Draw a signature, upload a PNG or type your profile name, then confirm personal approval of the listed course versions. A batch signature applies to the selected approvals. Each correction request retains its own remarks and date.
4. Reopen completed reviews to see decisions, or use **Help / Contact Admin** for an application or assignment question.

## Verification and rollback

The MySQL integration test creates a fresh disposable schema from local table definitions and drops it on completion. It only reads the configured local baseline schema. It uses synthetic accounts and images and captures Resend messages in memory.

```powershell
# From server. Pick an unused schema suffix and use local MySQL credentials with CREATE/DROP access.
$env:COURSE_VALIDATION_TEST_SCHEMA = 'learnmatch_validation_qa_20261120'
npm.cmd test

# Optional Chrome run. Build from client first with VITE_API_URL=/fixture.
# Playwright must be available from client/node_modules.
$env:COURSE_VALIDATION_BROWSER = '1'
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test test/courseValidation.mysql.test.js
```

Pair the migration with the updated backend and client. The backend enforces the signed approval even if a client calls the older publication endpoint directly. Verify email routing, the intended existing Administrator mailboxes, retention/access controls, and a synthetic workflow in staging before using real credentials. Keep Resend Click Tracking disabled on the sending domain so staff account links go directly to LearnMatch. [Resend Click Tracking documentation](https://resend.com/docs/dashboard/domains/tracking)

For rollback, freeze validation assignments and publication first and retain the private audit data. The migration is additive and introduces no data backfill. An older backend has no signed-approval gate or replacement-aware public catalog, so restoring it can reopen ungated publication and lose the replacement view. After a replacement is published, keep the compatible backend for reads or restore a verified, consistent application and database snapshot using the release recovery procedure. Preserve any later records before a database restore.

## Production release procedure

Use the same reviewed feature-only commit for the backend and frontend. The production origins are `https://www.learnmatch.online` and `https://precious-renewal-production-b034.up.railway.app`. Railway web and Vercel both deploy from `main`, so coordinate their triggers before pushing. Keep application rollout separate from database migration. The operator needs separate authorization for production writes, backup creation or restoration, real mail, Git push and deployments.

### Backup and restore rehearsal

1. Record the live Railway and Vercel deployment IDs, the intended Git commit and migration SHA-256. Reconfirm the Railway web service points at the expected production schema, `railway`, and record `SELECT DATABASE(), VERSION(), @@datadir, @@lower_case_table_names, @@max_allowed_packet;`. List the ten workflow tables and the `ADMIN.email` and `COURSE_PUBLICATION.validation_item_id` columns from `information_schema`. A fresh migration target has the existing draft, source and publication schema and none of these new objects. If any new object already exists, inspect the partial state before proceeding.
2. After authorization, put the application in a maintenance window that blocks writes, including the existing course publication routes, and pause database-writing workers. Leave MySQL running. Confirm the production tables use InnoDB. Use an authorized trusted connection to MySQL with TLS certificate verification or an authenticated private tunnel. Configure `lm-prod-backup` for a scoped dump user, `lm-restore-test` for a match-version isolated server, and `lm-prod-migrate` for the production DDL user with `mysql_config_editor`. Enter passwords at its prompts. Configure the appropriate TLS options for each connection in an operator-owned client option file. Keep credentials, dump files, and recovery manifests in restricted storage outside the working tree.
3. Capture a fresh Railway MySQL volume backup and record its ID and expiry. Take a full logical dump as well. It includes the existing Admin accounts, course and student records, and any private validation records present at dump time. Complete the restore check before altering production.

Use Bash and MySQL 9.7.2 client tools from the secured operator environment. Define `LEARNMATCH_BACKUP_DIR` as an existing, access-controlled directory, `LEARNMATCH_BACKUP_FILE` as a new `.sql` filename inside that directory, and `LEARNMATCH_RESTORE_SCHEMA` as an unused disposable schema name on the isolated restore server. Verify the restore target host separately. Use the production schema's character set and collation in the restore-server `CREATE DATABASE` statement.

```bash
set -euo pipefail
umask 077
cd "$LEARNMATCH_BACKUP_DIR"
test ! -e "$LEARNMATCH_BACKUP_FILE"
mysql --login-path=lm-prod-backup --database=railway --batch --execute \
  'SELECT DATABASE(), VERSION(), @@lower_case_table_names; SHOW TABLES;' > pre-migration-inventory.tsv
mysqldump --login-path=lm-prod-backup --single-transaction --quick --skip-lock-tables \
  --no-tablespaces --set-gtid-purged=OFF --hex-blob --routines --events --triggers \
  railway > "$LEARNMATCH_BACKUP_FILE.partial"
test -s "$LEARNMATCH_BACKUP_FILE.partial"
mv -- "$LEARNMATCH_BACKUP_FILE.partial" "$LEARNMATCH_BACKUP_FILE"
sha256sum "$LEARNMATCH_BACKUP_FILE" > "$LEARNMATCH_BACKUP_FILE.sha256"
sha256sum --check "$LEARNMATCH_BACKUP_FILE.sha256"
# Confirm this is the isolated 9.7.2 server and its event scheduler is OFF.
mysql --login-path=lm-restore-test --execute 'SELECT VERSION(), @@event_scheduler;'
# Create the new restore schema with the source defaults before this command.
mysql --login-path=lm-restore-test --database="$LEARNMATCH_RESTORE_SCHEMA" < "$LEARNMATCH_BACKUP_FILE"
```

Compare table inventory, row counts and checksums for the original tables while writes are frozen. For a deterministic SQL list of the base tables, run this on the source using `mysql --batch --raw --skip-column-names` with the production database selected, saving the output as `backup-table-checks.sql`.

```sql
SELECT CONCAT('SELECT ', QUOTE(TABLE_NAME), ', COUNT(*) FROM `',
              REPLACE(TABLE_NAME, '`', '``'), '`; CHECKSUM TABLE `',
              REPLACE(TABLE_NAME, '`', '``'), '` EXTENDED;')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
```

```bash
mysql --login-path=lm-prod-backup --database=railway --batch --raw --skip-column-names \
  < backup-table-checks.sql | sed 's/^railway\.//' > source-checks.tsv
mysql --login-path=lm-restore-test --database="$LEARNMATCH_RESTORE_SCHEMA" --batch --raw --skip-column-names \
  < backup-table-checks.sql | sed "s/^${LEARNMATCH_RESTORE_SCHEMA}\.//" > restore-checks.tsv
diff -u source-checks.tsv restore-checks.tsv
```

Use the same server version and settings for both. Use only letters, digits, and underscores in `LEARNMATCH_RESTORE_SCHEMA`. Check trigger, routine and event definitions separately if present. In the restored schema, verify representative legacy course IDs and publication links. Treat missing rows, unavailable checksums, failed restores or unmatched definitions as unresolved until investigated.

### Ordered deployment and Admin access

1. Approve the feature-only diff, then rehearse the same commit in staging with its own DB, hosted frontend origin, backend, and controlled mail recipients. Configure staging `VITE_API_URL` to the staging API. For staff email links to use the HTTPS staging origin, set staging `FRONTEND_URL` to that origin and `NODE_ENV=development` or `test` in a Railway environment named staging. Confirm each generated link stays on staging before using it. Production must run with `NODE_ENV=production`, `FRONTEND_URL=https://www.learnmatch.online` and the Vercel `VITE_API_URL` pointing to the production API. Verify the configured Resend sender and keep domain-level Click Tracking disabled for direct account links. Confirm that production ingress accepts the bounded 1.6 MB JSON payload.
2. During the production maintenance window, hold both Git deployment triggers or use authorized deployment controls that let the operator promote each pinned artifact separately. With the verified backup in place, confirm the target for the migration connection. Apply the candidate's migration once from the candidate root. Do not pass `--force`.

```bash
mysql --login-path=lm-prod-migrate --database=railway --execute \
  'SELECT DATABASE(), VERSION(), @@lower_case_table_names;'
mysql --login-path=lm-prod-migrate --database=railway \
  < server/migrations/20261120_add_course_validation.sql
```

3. Confirm all ten new tables, `ADMIN.email`, `COURSE_PUBLICATION.validation_item_id`, the unique `admin_verified_email` index and `fk_course_publication_validation_item`. Verify that existing Admin and publication rows have NULL in the new fields. Compare existing row counts and check representative original column values against the verified backup. If migration stops on any statement, keep maintenance active, inspect exactly which DDL committed and recover from the verified checkpoint or apply a separately reviewed repair.
4. Deploy the Railway backend first from the reviewed commit. Check the public catalog stats and a known course, allowed CORS, and anonymous `401` with `Cache-Control: no-store` at `/api/admin/validators`. Then deploy the Vercel frontend from the same commit. Verify the landing page, staff routes, `VITE_API_URL` wiring and a known public course. Reopen general access and resume workers only after these checks pass. Keep staff workflow use restricted to rollout operators until the authorized account setup and smoke checks are complete.
5. Keep the sole existing Admin usable by username until the operator can confirm both their existing access and ownership of the intended mailbox. Inside the deployed backend environment, run the setup command with the confirmed Admin ID and mailbox from `server`. This writes a setup token and sends a real email. The existing Admin completes the one-use link at `https://www.learnmatch.online/admin/account/setup`, chooses a password and then signs in by email. Recheck sign-in and recovery using an approved inbox. Completing setup invalidates previous Admin sessions. If sending fails, the operator can rerun `link` for the same Admin ID after correcting delivery.

```bash
node scripts/setupAdministrator.mjs link "$LEARNMATCH_ADMIN_ID" "$LEARNMATCH_ADMIN_MAILBOX"
```

### Deployed smoke test and rollback

- In staging, use one controlled Admin mailbox, two Validator accounts and three synthetic courses in the same cluster. Verify Admin setup, email sign-in and recovery. Send a Validator invite, submit one PNG and verify the mailbox. Confirm the open verification page redirects to sign-in after Admin approves the account and cluster. Verify the Admin and owning Validator can read approved private downloads and an anonymous user and the second Validator cannot. Read the uploaded PNG and signature again after a staging backend restart to verify persistence.
- Assign the three courses. Confirm publication is blocked before signed approval. Approve two courses with one signature, request changes on the third, then edit and resubmit it for a fresh review. Verify the signed versions and correction history, publish one eligible draft or replacement, and confirm the public page shows the matching validation status and preserves the stable course URL. Remove the test Validator and confirm access ends and signed audit records remain. Verify production catalog and route health read-only after deployment. Real production emails, account mutations and test publication require separate approval.
- If a check fails, freeze staff workflow and course publication first. Before any replacement publication, roll back the frontend and backend together to the recorded releases if necessary, retaining the additive schema and private audit records. Confirm old publication routes remain blocked during investigation because the old backend lacks the signed-approval gate. If a replacement has already been published, keep a replacement-aware backend in service or roll forward to a compatible build.
- If database recovery is necessary, freeze all writers again, preserve a separate encrypted copy of the current database and assess the gap between the backup and the last accepted write. Restore the verified backup into a fresh matched server or isolated schema, compare checksums and verify the paired application releases before an authorized connection switch. Reconcile later committed records before reopening writes. Retain the prior database volume for recovery. Use Railway volume restoration only with explicit approval.

[MySQL 9.7 backup options](https://dev.mysql.com/doc/refman/9.7/en/mysqldump.html) · [Railway volume backup and restore](https://docs.railway.com/volumes/backups)
