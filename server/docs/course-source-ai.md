# Add Draft: Check Sources with AI

AI analysis is **disabled by default** in shared configuration. The ignored local development
backend `.env` enables it explicitly for local testing; no production configuration was changed.
A standalone live diagnostic previously confirmed
scanned-PDF input; this integration is verified with mocks only, without additional paid calls.
The input budgets are separate: **12,000 tokens for extracted text** and **65,000 tokens
for scanned PDFs**, per analyzed source. The PDF count includes the file, instructions,
structured-output schema and course/claim comparison context. The 19-page CHED diagnostic
previously used 57,184 input tokens; the current full request must still pass preflight.
Counts above the applicable cap return Needs Review without a generation request.
This is optional analysis, not autofill, manual confirmation, weight approval or publication.
The Add editor keeps one initial reference and at most three, after all course/profile fields.
It requires a manually entered course name and an explicit click. Readable content uses Basic
detection when AI is disabled or unavailable; the result states the method and fallback reason.
Valid AI findings of unrelated or insufficient evidence are retained as Needs Review, not replaced
by Basic. Accepted scanned PDFs use inline PDF analysis only when enabled and within budget;
manual confirmation remains available even when checking fails or AI is disabled.

## Configuration and compatibility

`server/.env.example` lists the independent settings. Defaults:

| Setting | Default | Allowed bounds / meaning |
| --- | --- | --- |
| `SOURCE_AI_ENABLED` | `false` | Only literal `true` enables calls |
| `SOURCE_AI_MODEL` | `gpt-6-luna` | Text path; no alternative-model retry |
| `SOURCE_AI_REASONING_EFFORT` | `low` | Text path: none, low, medium, high, xhigh, max |
| `SOURCE_AI_PROMPT_VERSION` | `source-review-v4` | Must identify the shipped prompt; fixed role unchanged |
| `SOURCE_AI_TIMEOUT_MS` | `12000` | 100–15000 ms |
| `SOURCE_AI_PDF_TIMEOUT_MS` | `60000` | 100–60000 ms, model request only |
| `SOURCE_AI_PDF_MAX_OUTPUT_TOKENS` | `1800` | 200–1800, also bounded by general output cap |
| `SOURCE_AI_MAX_INPUT_TOKENS` | `12000` | Extracted text only; existing 1000–24000 bounds |
| `SOURCE_AI_PDF_MAX_INPUT_TOKENS` | `65000` | Scanned PDFs only; 1000–65000 bounds, full-request count |
| `SOURCE_AI_MAX_OUTPUT_TOKENS` | `1800` | 200–3000; includes reasoning |
| `SOURCE_AI_CONCURRENCY` | `1` | 1–2 simultaneous calls per backend instance |
| `SOURCE_AI_REQUESTS_PER_MINUTE` | `6` | 1–20 calls per backend instance |
| `SOURCE_AI_CACHE_SECONDS` | `600` | 0–1800; at most 32 in-memory results |

Backend-only `OPENAI_API_KEY` is reused. The separate College/recommendation AI features
and their settings are unchanged. Official documentation confirms [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
supports low reasoning, Responses and structured outputs. The request uses Responses
`reasoning.effort`, `max_output_tokens`, `text.format` JSON schema and `store:false`, following
[structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs).
Scanned PDFs always use the tested `gpt-6-luna`, low reasoning and high PDF detail. They do not
inherit a different text-model setting or switch models after failure. All requests use default
service tier and no tools. The earlier standalone CHED trial completed in 17.054 seconds, with
57,184 input (57,181 cached), 948 output (including 284 reasoning) tokens. It correctly found
program identity, focus and outcomes, but omitted the four-year sample plan and a units
discrepancy. That is evidence of usefulness and limitations, not comprehensive validation.

For extracted text, serialized request UTF-8 bytes plus 1024 framing reserve conservatively bound input
tokens (not an actual tokenizer count). Up to 30 passages, each at most 1200 characters,
prioritize target-name occurrences and nearby text. No passage is sent if the complete
request including instructions, schema, comparison details and examples exceeds the cap.
Coverage always discloses passage limits/truncation. API response reading is capped at 64 KiB.
For confirmed no-text PDFs, [Responses input-token counting](https://developers.openai.com/api/docs/guides/token-counting)
preflights the complete inline `file_data` input, instructions and structured format. Counting
has a 15-second bound under the same concurrency/rate/duplicate lock. If unavailable, invalid,
over-budget or canceled, generation is not submitted. No truncation, page splitting or automatic
retry is used to bypass the cap. The full PDF is sent inline only; no Files API upload is created.

Reported API input, cached-input, cache-write, output and reasoning tokens are distinct from
preflight counts or text estimates. Reasoning tokens are already included in output and are
not billed twice in the estimate. Optional `SOURCE_AI_INPUT_USD_PER_MILLION`,
`SOURCE_AI_CACHED_INPUT_USD_PER_MILLION`, `SOURCE_AI_CACHE_WRITE_USD_PER_MILLION` and
`SOURCE_AI_OUTPUT_USD_PER_MILLION` configure prices; no prices are assumed. Verified standard
short-context rates on 2026-10-17 were $0.10/$0.01/$0.125/$0.50 respectively per million tokens
([official rates](https://developers.openai.com/api/docs/models/gpt-6-luna)). Keep rates current.
If cached pricing is omitted, the estimate does not deduct cached savings; unknown cache-write
pricing prevents a cost estimate. Estimates are not invoices. Cache hits do not count original
usage again, and no cache hit or fixed per-document cost is promised. Model cost is **per
analyzed source**, not per button click or draft. Checking three uncached sources can submit
three generation requests (with PDF token-count preflights as applicable). Concurrency one
serializes calls; it does not combine them into one charge. There are no automatic retries.

The existing endpoint limits remain: ten requests/minute/admin, no overlapping check per admin,
three distinct URLs and cancellation on disconnect. The batch deadline is now 285 seconds,
covering at most three sequential 10s download + 6s parse + 15s count + 60s model operations.
The client allows 300 seconds and the scoped Vite source-check proxy 310 seconds, with an
honest loading/cancel state. Current explicit `VITE_API_URL` requests go directly to the backend;
when the base is empty the scoped proxy targets loopback port 5000. External production
reverse-proxy timeout compatibility still requires deployment verification; nothing was deployed.
Additional global
AI limits and duplicate in-flight keys prevent overlapping paid calls. Capacity/rate failures
use Basic without queueing retries. Source fetching/parsing bounds are unchanged.

## Trust, evidence and state

Exact approved original/redirect hostnames are validated before fetching, and all DNS/private
address protections and pinned connections remain. Empty publisher configuration fails closed.
No localhost exception. Domain-like path text, logos and document instructions confer no trust.
Normal HTML and readable-PDF parsing stays in the existing bounded worker. Only Add Draft's
context-bearing checking opts into confirmed no-text PDF metadata (page count/readability).
Default parser callers retain PDF_NO_TEXT behavior. A PDF is recognized by content bytes,
not URL suffix. Source checking opts into reading only the first 30 pages of longer PDFs,
with an explicit partial-review notice. Other parser callers retain the page-limit rejection.
Invalid, encrypted/unreadable or timed-out PDFs never reach vision. The parser still processes
at most 30 pages within six seconds, 192 MiB, text/structure bounds and two readers.
For longer scans, `pdf-lib` copies the first 30 pages inside that same bounded worker before
inline submission. There are no local OCR/image-conversion workers or AI browsing.

The fixed server role is versioned in `services/sourceAnalysisPrompt.js`. Current source blocks
are untrusted JSON data, separate from reviewed examples. Only the target, selected claims,
relevant manually entered details and qualitative profile evidence are included; numeric weights,
admin/student identities and credentials are excluded from AI comparison input. Inline PDFs
are bounded in-memory buffers; references are released after completion/error/cancellation,
and parser children terminate on all paths. No full PDF or document text is logged or persisted.
No provider file is created; this does not imply zero provider retention. Only bounded reports
and excerpts enter evidence storage.

Strict server schema validation rejects extra fields, malformed/incomplete/refused output,
HTML/Markdown and numeric weight fields. Extracted-text excerpts must be exact substrings of
their supplied blocks with valid identifiers. Scanned-PDF evidence cannot be checked against
independent text: only response structure and integer page ranges are validated. It is labeled
**AI-read, verify manually**, with an approved-URL `#page=N` link. In-range transcriptions can
still be wrong; no machine-verified quotation claim is made. Claims distinguish direct passages,
inference and unresolved information. Explanations remain unverified analysis, rendered as
plain React text. A name listing is insufficient for Potential Match; direct target-name and
supporting program passages are required in addition to approved origin. Current applicability
and substantive accuracy still require admin judgment; quote checks cannot prove a model's interpretation.

Checks explicitly assess program identity/abbreviation, description, outcomes/skills and duration
or sample year structure, plus qualitative matching evidence when selected. Missing facts stay
unresolved. These core details are included in the analysis binding even if not checked in the
admin's supported-information selections. Manual confirmation retains its separate selected-claim
binding; checking never selects confirmation boxes or approves weights. Prompts request
conflict checks but neither path guarantees full coverage or complete conflict detection.

Cache keys include content hash, final URL, relevant draft/source binding, selected claims,
comparison facts, reading mode/detail, model/reasoning, prompt/example versions and input/output budgets. Relevant edits
immediately clear unsaved results/confirmations. Late responses cannot restore results after
course edits. Server-generated signed receipts bind analysis to the current source and selected
course/profile content hash; confirmation and atomic persistence reject stale bindings. Client
reports, reviewer IDs and dates are never authoritative. Saved histories and legacy evidence remain.

No schema migration is needed: `COURSE_DRAFT_SOURCE_CHECK.report` already holds JSON, including
method, configured/API model, prompt/example versions, content/relevant-context hashes,
coverage, claims and usage. Existing source review tables retain authenticated attribution,
server dates, revision invalidation and history. New saved reports also retain relevant field
revisions so changing and reverting a field cannot make an old analysis current again.
Manual review may proceed after a failed check
for an accepted URL; it never changes the automated result or approves matching weights.

## Proposed examples: review needed, inactive

`PROPOSED_SOURCE_EXAMPLES` contains three explicitly synthetic cases: target-specific course
and duration, an unrelated program, and a bare multi-program listing. Each includes the target,
passage, supported claims, expected result and explanation. None has documented reviewer
approval, identity or date. `REVIEWED_SOURCE_EXAMPLES` is empty and no proposed example is sent.
Before activating examples, obtain an explicit review record, reference that record, version
the set and evaluate it separately. Example passages must never supply current-source citations.
There is no training/fine-tuning, catalog export or student data.

## Verification

### Scanned-PDF failure diagnostics

The earlier generic `AI unavailable or returned unusable evidence` notice discarded the
exception and no request log was retained. That notice was reached only after a valid,
within-budget PDF token count; its original generation/response/validation subtype cannot
be recovered from the screenshot. The local environment file and service changes predated
the inspected backend process start, but file settings alone do not prove inherited runtime
values. No additional provider request was made to reconstruct this incident.

The standalone trial used a smaller `information` schema; the app requires one claim for
each assessed field and rejects excerpts shorter than 15 characters. Previously those
requirements were absent from the outgoing schema. Prompt v3 now requests the exact claim
count/fields, nonempty explanations and the same excerpt minimum, plus concise scanned-PDF
output within the unchanged 1,800-token budget. Semantic checks, actual page bounds and
grounding remain strict. This corrects a reproducible request/validator mismatch; it is not
proof that this mismatch caused the historical request failure.

Failures now identify token counting, generation HTTP, response body/status, output JSON,
or evidence validation separately. Safe codes distinguish timeouts, incomplete output
(including output-budget exhaustion), refusals, malformed responses and invalid citations.
Available usage survives validation failure. Logs retain only allowlisted diagnostics,
request IDs, timing and budget settings, never provider error messages, PDFs or credentials.
The authenticated admin `GET /api/admin/course-sources/status` exposes safe runtime settings
and process identity without running a check or writing data; restart is needed to load
this endpoint and the fix. No automatic retry, partial-result acceptance or model switching
was added. Mocked REST output reproductions do not replace live browser verification.

Focused mocked tests cover independent configuration, exact/deceptive origins, scanned-PDF
triggering/skipping, inline input and counts, direct/unrelated/insufficient output, citation grounding, injection, refusal,
incomplete/error/timeout fallback, budgets, concurrency, duplicate keys, caching, redaction,
server receipt attribution/staleness, transaction rollback, UI state and safe rendering.
No real course-data writes or additional paid calls were made for integration. Interactive browser
verification and production proxy checks remain pending. Existing publication/WSM/College rules
remain unchanged. The old synthetic localhost reference remains invalid under the allowlist.

## Local restart and saved-draft browser verification

Local-only settings in the ignored `server/.env` enable source AI, with text input 12,000,
PDF input 65,000, `gpt-6-luna` / low / high PDF detail, 60-second PDF model timeout,
1,800 output tokens and concurrency one. Shared `.env.example` stays disabled by default.
The existing backend was not restarted automatically; it must reload its configuration.

In the terminal already running the local backend, press Ctrl+C, then:

```powershell
cd C:\dev\learnmatch\server
node server.js
```

Do not launch a second backend on port 5000. Use the existing frontend origin/tab to
preserve its session. If Vite is stopped, start one instance on port 5173:

```powershell
cd C:\dev\learnmatch\client
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Shortest browser test: open Manage Courses, reopen the existing unpublished draft, and click
**Check Sources with AI** under Course sources. It uses the current course form and source
editor (including unsaved edits), without saving them. Inspect method, reasons, assessed
information, excerpts and PDF page links. Do not save, confirm or publish for this check.
Checking may incur one generation request per analyzed source; no live requests were made
during implementation. Retain the existing draft; do not create a replacement fixture.

The reopened panel reuses `SourceFirstDraftSources` in analysis-only mode. Relevant form
or source edits destroy transient results and cancel pending work without remounting the
source editor or clearing entered values. A local form revision also prevents change/revert
from reviving manual confirmation checkbox selections. Stored review history is unchanged;
saved confirmation status applies to the saved record, not unsaved form edits.

Reopened checks include `course_id` in the existing authenticated `/course-sources/check`
request. The backend uses SELECT-only snapshots of draft/active/publication flags, field
revisions and source revisions before and after analysis. Missing courses return 404;
legacy, active or published records return 409 before fetching. Concurrent saved changes
reject the result. No course/source/evidence/review rows are written by checking. The new-draft
path without an ID remains supported. Existing publication and source-confirmation actions
remain separate. Interactive browser verification is still pending.


## Program relationship checking

Prompt `source-review-v4` and schema `source-relationship-v1` add a structured relationship:
Same/equivalent program, Related program only, Unrelated program, or Insufficient evidence.
Results show the exact entered target, identified source names, explanation and cited passages.
Only same/equivalent identity plus adequate target-specific information can be Potential Match;
the exact-host policy still applies separately. Names must appear in grounded relationship
excerpts. Degree abbreviations BS/BSc and BA/AB are normalized without changing subject or
specialization; other equivalent names need an explicit definition/alias in the cited source.
No generic-keyword or publisher-origin rule establishes a relationship by itself.

Related-only evidence is retained as AI analysis with Needs Review. Supported skills/topics
are contextual evidence; another program's name, description, duration and curriculum remain
unresolved for the target. Explicit unrelated evidence shows Course mismatch. Missing evidence
shows Target course not established. Unresolved or contradictory relationship findings are not
retried or converted to Basic merely because the target is not supported. Text quotations and
locations are checked against supplied passages; scanned transcriptions remain AI-read and only
structure/page bounds are independently checked. Multi-program text sections are bounded at
other program headings, and contradictory non-target findings are downgraded for manual review.
Basic detection remains conservative: absence of a target does not prove a mismatch or relatedness.

Cache identity includes exact target, source URL/content hash, source/claim/course bindings,
model/reasoning, prompt and schema versions, reading mode and budgets. Duplicate requests stay
bounded; failed analyses are not cached. Frontend/backend revision and receipt checks are
unchanged. Selection-only retained previous analysis remains labeled and cannot supply a
current receipt. Hide/Show results remains visibility-only. No database migration is needed;
existing stored reports without relationship metadata remain viewable as recorded. Restart the
backend to load the new schema/prompt; live browser/model verification is pending and no paid
requests were made for this change.

## Stage-specific timeouts and incomplete analysis

The old `TIMEOUT: Source checking timed out.` text originated exclusively in the safe-fetch
layer, before parsing or AI. Fetching has an unchanged shared **10,000 ms** deadline for
DNS, redirects, connection and body reading. The **6,000 ms** parser, **15,000 ms** scanned-PDF
token-count preflight and **60,000 ms** scanned-PDF generation deadlines are separate. Readable
text uses its existing independent model timeout (default **12,000 ms**). The batch deadline
is **285,000 ms**, browser **300,000 ms**, and Vite proxy **310,000 ms**. These values were not
increased to resolve a download timeout.

Fetch errors now carry an allowlisted fetch phase (DNS, download, connection, response headers
or body), measured elapsed time and the effective shared fetch limit. Parser timeouts have
their own code. Checking returns sanitized stage/timing metadata and logs it without source
URLs, document contents or credentials. Model/preflight failure metadata now reports its own
effective deadline and elapsed time, separately from total analysis time. The authenticated
status endpoint includes fetch/parser/preflight/text/PDF timeouts and process identity for
comparison with the actual running configuration.

When no analysis completes, results say **Analysis not completed** rather than Basic, omit
relationship classification, and state which later stages were not started. Basic still
means the rules-based checker actually ran on readable content after an AI failure/disable.
Existing incomplete reports also render without a misleading Basic or relationship label
when their recorded fetch/parse state establishes failure. Source confirmation remains a
separate explicit manual action. No retries or larger security/download/token limits were added.

Incident inspection found no retained request log with the original Accountancy elapsed time
or DNS/connect/body substage. Its literal error identifies fetch, with a 10-second effective
deadline, but does not establish why that host was slow. Local file settings enable AI with a
60-second PDF model timeout; the inspected backend process started after those settings and
the previous service version. Authenticated runtime settings and live host availability were
not rechecked: no controllable browser was available and no paid/fetch retry was authorized.
Do not present mocked elapsed values as the historical Accountancy request duration. Restart
the existing backend to load these diagnostics; live verification remains pending.

## First-30-page PDF scope

Documents over 30 pages no longer fail the page limit in the source-checking path. Text
reading stops at page 30 and retains physical page numbering. If those pages have no readable
text, the worker creates a temporary in-memory 30-page PDF, strips page annotations, and checks
its size against the same configured PDF byte limit. Only this subset can reach preflight and
generation; the original document hash and verified subset hash bind the request/cache.
Page 31 onward never enters extracted passages, inline PDF input, or accepted page citations.
The report/UI state the document's total pages, reviewed range, and that later pages were not
checked. Lack of target evidence in this range is not proof of a mismatch in omitted pages.

The original full download must still fit existing URL/security, byte and 10-second fetching
limits. PDF preparation shares the existing six-second/192-MiB parser boundary; no OCR, disk
files or additional workers were introduced. Text input remains capped at 12,000 tokens and
scanned PDF preflight at 65,000 total tokens, so even a 30-page subset may exceed the token
budget and return Analysis not completed without a generation call. Model settings/timeouts
and all other limits remain unchanged. `pdf-lib` and its lockfile entries are additive runtime
dependencies. Restart the existing backend after installing dependencies; no migration is needed.
