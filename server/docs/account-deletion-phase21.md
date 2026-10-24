# Phase 2.1 — Profile/deletion serialization and trusted client IPs

Local implementation and tests only. No production setting, record, migration,
deployment, or paid service was changed.

**Superseded rate-limiter findings:** the final account-based strategy in
`account-deletion-production-readiness.md` replaces the deletion route's IP quota.
The profile transaction findings below still apply. Earlier X-Real-IP/ingress
blockers are retained here as review history, not current deletion prerequisites.

## Profile transaction

The former profile handler read the account without a lock, ignored update row
counts, committed before refreshing recommendations, and could report successful
update after deletion had already removed the account/profile.

The save now requires a transaction, locks the active account first, then locks
recommendation headers, assessment attempts and the profile in deletion-compatible
parent order. Missing/inactive accounts return 404 without a write. Existing
username validation and structured Personal Factors handling remain in place.
Only existing legacy fields are preserved; deleted accounts are never recreated.

Username/profile write counts are checked. A zero changed-row count is accepted
only when the locked existing profile already equals the requested values.
Personal Factors JSON is compared by value, so MySQL's object-key ordering does
not cause an unnecessary recommendation refresh on an unchanged save.
Personal Factors, an applicable active-attempt snapshot and saved recommendation
refresh use the same connection/transaction. The refresh helper can borrow this
transaction without starting, committing or releasing a nested transaction.

A successful response means the profile transaction committed while the account
was active and locked. A subsequent authorized deletion can remove that save;
the response does not promise the account will remain active forever or recall
responses already in flight.

Before COMMIT, errors roll back. Deadlock, lock timeout or write mismatch returns
409 `PROFILE_SAVE_CONFLICT`; ordinary failures return a sanitized 500. Once COMMIT
starts, an unconfirmed outcome returns 503 `PROFILE_SAVE_OUTCOME_UNKNOWN`, destroys
the connection and never claims rollback/success or retries. The profile form
disables resubmission and offers a reload to check persisted data. No raw driver
errors or submitted Personal Factors are logged by the save handler.

Other assessment/check-in services still have their own lock orders. Contention
can cause a deadlock; tested rollback handling prevents resurrection. Root-first
serialization in profile save and deletion resolves the confirmed race without
rewriting unrelated workflows.

## Client IP and proxy policy

`server/config/proxyTrust.js` replaces the unverified `trust proxy = 1` assumption.

- With no `TRUSTED_PROXY_CIDRS`, Express trusts no forwarded addresses. Direct
  client IP comes from the socket. X-Forwarded-For, X-Real-IP and Forwarded cannot
  change a direct client's deletion quota.
- Configure only actual controlled proxy addresses or CIDRs. Example for a local
  test proxy: `TRUSTED_PROXY_CIDRS=127.0.0.2/32`. This is not a Railway address.
- The proxy must overwrite X-Forwarded-For or append the remote address it
  actually observed. Restrict ingress so untrusted callers cannot reach the
  application through a path that appears trusted.
- Express resolves from the socket right-to-left through explicitly trusted
  peers to the first untrusted address. Caller-injected leftmost entries do not
  override the observed client address on a correctly configured appending proxy.
- The derived address is validated and normalized before use. Invalid derived
  IPs return 400 rather than allowing arbitrary rotating limiter keys. IPv6 uses
  express-rate-limit's subnet normalization; mapped IPv4 uses the IPv4 identity.
- Empty trust is safe for direct local use, but a shared proxy left unconfigured
  will still appear as one client. Production proxy configuration is mandatory.
- Do not use `true`, numeric hop counts, `/0`, guessed cloud ranges, or broadly
  trust an internal subnet merely because one peer was observed there.

### Railway findings and unresolved prerequisites

Railway's public-networking specification documents X-Real-IP for identifying the
client's remote IP. It does not establish the repository's previous fixed one-hop
assumption or a stable proxy CIDR allowlist. This implementation deliberately does
not turn Railway environment markers or arbitrary request headers into trust.

Before running behind Railway, obtain and verify the ingress/header trust
contract for the actual route. Use an explicitly controlled ingress with verified
peer addresses and sanitized forwarding, or a provider-supported trust mechanism
reviewed separately. Do not copy an observed 100.x socket range into the allowlist
as an assumed stable/security boundary. Public-edge, private-network and TCP
ingress paths need separate consideration; a private caller must not be able to
impersonate an edge request. Verify direct-backend bypass is blocked. No production
probe or setting change was made to establish these facts in this task.

Latest owner-confirmed configuration: **one configured Railway replica**, start
command **`node server.js`**, and **TRUSTED_PROXY_CIDRS absent**. Repository inspection
finds one HTTP listener and no cluster/worker-based HTTP server launcher. The
source-parser child process only parses documents over IPC; it does not run the
HTTP application or instantiate rate limiters. These facts support one serving
Node process per deployment, rather than an assumed multi-worker setup.
They do not verify actual running deployment overlap or NODE_OPTIONS/preload
instrumentation. The latest read-only `railway status --json` attempt still
returned Unauthorized; live ingress and running processes were not inspected.
RAILWAY_REPLICA_ID alone is not evidence about other deployments.

The default MemoryStore is process-local and resets on restart. Multiple replicas
or workers are not supported for globally enforced deletion quotas with this
store. Proposed multi-instance solution: an atomic Redis-backed express-rate-limit
store shared by both the IP and account limiters, with independent key prefixes,
expiry, connection security and a fail-closed error policy. Reuse an approved
service if available; no Redis resource, package or paid infrastructure was
provisioned. A single-instance release must explicitly accept/document restart
resets and avoid overlapping independent limiter instances.

### Focused Railway compatibility review (latest follow-up)

No new Railway variable is required or safe to set on the evidence available.
Keep TRUSTED_PROXY_CIDRS absent; do not invent a proxy range, set trust proxy to
true/1, or enable a blanket TRUST_X_REAL_IP-style switch. No runtime header-trust
change was made in this review. The absent setting intentionally ignores XFF,
X-Real-IP and other Railway-looking headers. The consequence is a shared socket
IP quota behind an unconfigured proxy; independent public-client IP limiting is
still not release-ready.

Railway documents X-Real-IP as the client's remote IP for public HTTP ingress:
https://docs.railway.com/networking/public-networking/specs-and-limits
However, its private network is reachable by other services in the same project
environment, supports both IPv4 and IPv6 in current environments, and permits
direct HTTP requests:
https://docs.railway.com/networking/private-networking/how-it-works
The current app.listen(PORT) has no ingress-specific host/interface restriction.
Binding only IPv4 is not a general private-network exclusion. Checking Host,
Origin, X-Forwarded-Proto or X-Railway-* request headers does not authenticate the
sender; a private caller can send all of them. Syntax validation of a single IP
also does not authenticate the sender. CORS is not a server-to-server firewall.

The simplest conditional X-Real-IP design is to accept exactly one validated IP
only on a listener that is **enforced** to be reachable solely through Railway's
public HTTP ingress. Before implementing that design, establish how private
service callers and TCP/direct paths are excluded from that listener, and verify
the public edge replaces caller-supplied/duplicate X-Real-IP values. Alternatively
use a controlled authenticated ingress that sanitizes and attests client identity.
Neither boundary is established by the current confirmed settings. A configuration
flag claiming public-only traffic would not enforce it. No paid service or extra
proxy was introduced. All public/custom domains and any intermediate proxy must
be included in that verification.

Targeted localhost verification: 9 real HTTP tests passed, including three new
checks for absent-CIDR spoof resistance (X-Real-IP/XFF/Host/Railway headers), the
shared-proxy quota limitation despite an overwriting proxy, and per-account limits
across independent sockets. Together with the login-limiter regressions, the
targeted run passed **20 tests, zero failures/skips**. Proxy checks use only
synthetic identities and invalid deletion payloads; database access throws if
attempted. Login regressions use test doubles. No database was touched. No full
regression rerun was necessary; the prior 776 passing results remain historical.

Release still requires the ingress boundary above, verification/acceptance of
restart and overlapping-deployment limiter behavior, and the previously recorded
HTTPS/CORS/environment, retention and backup-restore prerequisites. With one
serving process and an accepted restart policy, a paid Redis service is not
intrinsically required. This review does not mark production compatibility PASS.

Official references reviewed on 24 October 2026:

- https://docs.railway.com/networking/public-networking/specs-and-limits
- https://docs.railway.com/deployments/optimize-performance
- https://docs.railway.com/variables/reference

### Exact pre-deployment checks

1. In the intended Railway service/environment, enumerate regions and replicas in
   scaling settings, inspect the deployed start command/process manager for Node
   cluster/worker processes, and account for overlapping old/new deployments.
   Save the verified settings; one replica ID is insufficient evidence.
2. Enumerate every ingress path: public Railway/custom domains, any additional
   CDN/proxy, private service DNS and TCP proxies. Establish which paths sanitize
   forwarding headers and which can reach the backend without that boundary.
3. Obtain supported ingress-peer ranges or deploy an explicitly controlled,
   restricted ingress. Configure `TRUSTED_PROXY_CIDRS` only from this verified
   topology. The current code uses trusted XFF resolution, not arbitrary
   X-Real-IP; Railway's documented X-Real-IP alone does not validate that setup.
4. In an approved staging environment, test two genuine client IPs and forged
   XFF/X-Real-IP/Forwarded headers through each permitted route. Confirm independent
   IP quotas, one account quota across IPs, and no direct/private bypass. This
   task performed those tests with a local controlled HTTP proxy only.
5. For any multi-process/replica/overlap topology, obtain approval for and configure
   shared rate-limit storage before release. Otherwise verify/document one limiter
   instance and its reset-on-restart policy. Nothing was provisioned here.

## Local verification

Run backend regressions with `npm test` from `server`.

Explicit disposable-database checks (PowerShell, from `server`):

```powershell
$env:ACCOUNT_DELETION_DB_TEST='1'
node --test tests/profileDeletionRace.integration.test.js tests/accountDeletion.integration.test.js
```

Both suites create randomly named disposable local schemas, copy empty schema
definitions only, seed synthetic accounts and drop their own schemas afterward.
Existing development records are never copied or modified. Tests cover both race
winners, a save after deletion, no resurrection, real InnoDB deadlock and lock
timeout, rollback, no-op versus mismatched affected rows, recommendation-refresh
rollback and both possible lost-acknowledgement outcomes.

`node --test tests/accountProxyTrust.test.js` uses real loopback HTTP client/proxy
connections and synthetic middleware identities. It cannot access a database:
only invalid payloads are sent, with a connection factory that throws on access.
It covers independent IP quotas, account quotas across IPs, direct spoofing,
leftmost XFF injection through an appending proxy and invalid derived IPs.

Remaining production requirements from Phase 2 still apply: live schema and
ingress verification, replica/store policy, HTTPS and secrets, retention/backup
restore procedures, and operational handling of unknown outcomes. Phase 3 remains
unimplemented.

## Final results and modified files

- Standard backend suite: 484 passed, 0 failed; 2 opt-in database tests skipped.
- Both opt-in disposable-database suites: 27 passed, 0 failed, including parent
  runner tests and their subtests.
- Real-proxy tests: 6 passed (included in the standard backend total).
- Frontend regression selection: 33 passed.
- Actual browser/frontend/backend/MySQL QA: 15 passed, 0 failed, including the
  previously failing profile overlap and uncertain-save reload behavior.
- Frontend ESLint, build and diff checks passed. Existing Vite module-format and
  bundle-size warnings remain.
- All 32 development-database table checksums were unchanged during browser QA;
  database suites checked source counts unchanged. Disposable schemas were removed.

Phase 2.1 files created or modified (earlier uncommitted Phase 1/2 files are not
counted unless changed again in this phase):

- `server/controllers/profileController.js`
- `server/services/recommendationPersistenceService.js`
- `server/config/proxyTrust.js` (new)
- `server/routes/accountRoutes.js`
- `server/server.js`
- `client/src/pages/ProfileEdit.jsx`
- `server/tests/profileController.test.js`
- `server/tests/personalFactorPrivacy.test.js`
- `server/tests/recommendationPersistence.test.js`
- `server/tests/accountProxyTrust.test.js` (new)
- `server/tests/profileDeletionRace.integration.test.js` (new)
- `server/docs/student-account-deletion.md`
- `server/docs/account-deletion-phase21.md` (new)

Ignored local QA artifacts include `.local-backups/phase21-browser-qa.mjs`,
`.local-backups/phase21-release-qa/results.json` and browser screenshots.

**Recommendation:** PASS for the focused local fixes and regression criteria.
Production release remains NO-GO until ingress and replica/store requirements
above, plus the existing Phase 2 operational/retention prerequisites, are verified.
