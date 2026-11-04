# Registration disposable-email filter

`domains.json` combines the community-maintained public-domain
[disposable-email-domains list](https://github.com/disposable-email-domains/disposable-email-domains)
and the MIT-licensed [disposable aggregator](https://github.com/disposable/disposable-email-domains).
The aggregator's disposable-only `domains.txt` is used, not its strict or forwarding
lists, which also include legitimate providers. Both source URLs and immutable
revisions are recorded in the snapshot; both licenses are included here. No paid
API, new package, DNS lookup or per-request network call is needed.

From `server`, run `npm run update:disposable-emails` weekly and before releases.
Review the resulting diff and run `npm test`, then deploy/restart the server to load it.
The updater resolves an immutable revision, validates the download, checks common
legitimate providers, and atomically replaces the snapshot only on success. Failed
downloads leave the previous list intact. Updates are deliberately reviewed, not
silently pulled into production. If upstream lists a legitimate provider, report it
upstream and remove the confirmed false positive from the bundled snapshot before deployment.

Only new registration is checked. Login, verification, resending codes, recovery and
existing records are unaffected. The existing Resend OTP verification remains required.
Unknown domains are allowed; list coverage is necessarily incomplete. Matching uses
whole domain labels and subdomains, never substring matching or provider allowlisting.
Domains are lowercased and converted using Node's IDNA support. Surrounding whitespace
is removed; local-part case, dots and plus tags are preserved. Invalid domain syntax,
including trailing dots, is rejected instead of silently rewritten.

`supplemental.json` holds locally reported disposable domains missing from upstream,
with a reason for each entry. Both lists are loaded at server startup. Add reviewed
domains in lowercase ASCII/IDNA form, run tests, and restart/redeploy the backend.
The upstream updater only replaces `domains.json`, so supplemental entries survive
updates. `javafs.com` was added following the owner's temporary-email registration
test; `macsnipe.com` was added after a subsequent report. Remove an entry if a review
finds it is no longer disposable. Even combined lists cannot guarantee detection of
newly created disposable domains; unknown domains remain allowed by design.

Tests use Node's built-in runner, an actual local HTTP registration endpoint, mocked
database queries and mocked email delivery; they do not access production data or send email.
