# Add Draft source detection

The Add Draft editor supports at most three source links. Course details, durations,
cluster and matching weights are manually entered. Enter the course name in Course
Details before clicking **Check Sources with AI**. Checking cannot fill or change form fields.
AI is disabled by default; results clearly identify Basic fallback. See
[AI source analysis](course-source-ai.md) for configuration, evidence validation and pending evaluation.

Each source returns Potential Match or Needs Review, a brief reason, bounded supporting
excerpts with webpage/PDF locations, method, coverage and selected-claim review information.
Basic detection returns at most three excerpts of 650 characters; optional AI analysis
returns at most two 500-character quotes per assessed claim (400 for AI-read scanned PDFs;
at most five claims). Identity, description, outcomes/skills and duration are explicitly assessed.
A Potential Match requires the manually entered full course name plus nearby course
information and an explicitly approved publisher origin. A name in a program list
alone is insufficient. Detection is conservative: separate program sections, weak
structure, unreadable content or missing information require manual review. No alias
or semantic inference is performed by Basic detection. Confirmed scanned PDFs can use bounded
inline AI page reading, with AI-read evidence and manual page links. Disabled/failed/over-budget
analysis returns Needs Review with manual guidance. There is no local OCR, candidate selection
or autofill. Text keeps its 12,000-token budget. Scanned PDFs have a separate 65,000-token
full-request budget, enforced by token-count preflight before generation.

## Origin and safe reading

`SOURCE_APPROVED_PUBLISHER_HOSTS` is a comma-separated list of exact hostnames. It
defaults to empty. Both the original and final redirected hostnames must be listed;
subdomains need separate entries. Wildcards, URLs and ports are rejected. No automatic
.edu.ph/.gov.ph trust or document/logo-based approval occurs. Empty or invalid
configuration now blocks nonempty source URLs with an explicit configuration error.
Unknown origins are rejected before fetching, saving or confirming; historical saved
reports remain viewable and are never rewritten or promoted by manual confirmation.

The admin options response exposes `draftOptions.source_url_policy` from this same
server configuration. The Add editor validates paste, typing and blur using the shared
exact-host validator, shows errors directly below the relevant URL, and disables checks,
confirmations and draft submission while a nonempty URL is invalid. Blank optional
slots remain ignored. No client-submitted host list is trusted by the backend.
Every redirect is checked against the maintained allowlist before DNS/connection;
unapproved destinations are not downloaded or parsed. Known unapproved redirect
reports cannot be used for confirmation or bundled persistence. An approved origin
alone never establishes course relevance or manual approval.

The existing safe fetcher retains public-address-only DNS validation, DNS/socket
pinning, TLS checks, redirect revalidation (three maximum, no HTTPS downgrade),
fixed credential-free headers, timeouts, header bounds, download concurrency and
both declared-length and streaming byte limits. Compressed HTTP responses remain
unsupported. HTML is capped at 2 MiB. PDFs default to 6 MiB, configurable with
`SOURCE_PDF_MAX_BYTES` up to a hard 16 MiB ceiling. Invalid configuration is rejected.
The larger PDF bound supports the previously measured 4,263,629-byte CHED document;
its lack of readable text still requires manual review.

Normal HTML/text-PDF reading runs in a disposable worker: 30 PDF pages, 160,000
characters, 4,000 blocks, 30,000 HTML nodes, depth 80, six seconds and 192 MiB V8 heap,
with at most two readers. PDF content is identified from bytes, not URL extensions.
Workers are terminated on completion, cancellation or timeout; no full source text
is persisted. Only bounded reports/excerpts enter saved evidence. PDF.js still needs
its canvas dependency transitively; there is no direct OCR renderer dependency.

## Admin review and persistence

Add checking: authenticated POST `/api/admin/course-sources/check` with
`{ course_name, urls, course, sources }`, one to three distinct URLs with the current
manually entered draft and source selections. Older name/URL-only requests use Basic
detection without AI. Blank names and a fourth URL
are rejected before fetching. Per-admin overlapping checks are rejected, requests
are rate limited, and disconnect/cancellation aborts work. There is no program
selection endpoint.

Sources retain manually entered title, URL, supported information and notes; Open
Source and explicit manual confirmation remain. POST `/confirm` binds the signed
check and current selected claims to the authenticated administrator. Signed receipts
expire after 45 minutes and cannot be forged/reused by another admin. Unsaved
checks from the retired workflow must be checked again; stored history is unchanged. Changing the
target course name discards unsaved check and confirmation receipts; saving rejects
stale target names. Relevant edits invalidate affected results and manual confirmations;
current-context signed results are also checked against actual saved fields.

Save Draft atomically stores the new inactive course, explicit profiles, up to three
sources, bounded check evidence and manual review records. Reviewer identity comes
from authentication; review timestamps remain server-generated. Source confirmation
never approves weights, verifies the course or publishes it. Existing Phase 2A review
history, revision checks and invalidation are preserved.

Existing canonical-course Edit remains unchanged. Saved new drafts enforce the same
URL policy and three-link cap when adding/editing or confirming sources. Existing
unapproved sources and review history are retained for inspection; they must use an
approved URL before a new confirmation or publication. No source is auto-removed.
Changing a URL immediately clears its unsaved check report, signed check receipt,
confirmation and confirmation binding, without changing other draft inputs. A URL
change/revert does not revive these values. On a saved source, the server increments
the revision and clears the current check digest when the URL changes; previous check
and review rows remain historical. Signed check/confirmation receipts for another URL
are rejected before saving a bundle. Misleading URLs such as `ched.com.nz`,
`ched.gov.ph.fake-site.com` and `fake-site.com/ched.gov.ph` are never approved by CHED
text: their actual parsed hostname must be explicitly configured. Loopback fixture
references remain unapproved; no localhost exception is provided.
Its history renderer reads both new excerpts and legacy saved suggestion evidence;
legacy data is not rewritten or deleted. The OCR/extraction-only implementation,
dependencies, tests, verifier and obsolete documentation were removed. Existing safe
fetch/text readers and current persistence/review code remain.

## Schema and checks

The separately applied migrations remain unchanged:
`20261016_add_draft_source_reviews.sql`, then `20261016_add_source_check_evidence.sql`.
No new migration, schema rollback, import, backfill or database modification is needed.

Focused tests cover three-link frontend/save/API limits, required course name,
origin/relevance results and bounded excerpts, text/scanned PDFs, safe fetching,
manual confirmation attribution/invalidation, stale names, atomic rollback, historical
reviews, existing Edit behavior and draft exclusion. Targeted frontend ESLint and
build checks supplement them. No full suite or real course-data write is required.
