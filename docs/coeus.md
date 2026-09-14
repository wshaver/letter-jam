# Coeus migration

Letter Jam is Coeus-only by explicit product decision. All entry paths, including
bare `/letterjam/` and `/`, require authorized Coeus launch context. Missing or
incomplete selectors show a link to Coeus selection. There is no standalone fallback.
Existing local profiles/backups are not read or migrated. Connected rounds now use
Coeus challenges and outcomes. Keep Letter Jam disabled in the production registry
until media delivery and full migration acceptance are complete.

Launch selectors are `student`, `lesson` (version ID), and `game=letter-jam`.
The client initializes `/coeus/sanctum/csrf-cookie`, then retrieves
`/coeus/api/game-context` with same-origin session credentials. It shows the
authorized student, lesson version and canonical Back to Coeus link. URL `return`
is ignored. Invalid/missing selectors show a catalog link; session expiry provides
sign-in in another tab and a retry that revalidates the original per-tab selectors.
Network/access failures never start local play.
Availability failures show Coeus's specific 409 reason as plain text, with a generic
fallback for malformed responses. Authentication failures retain sign-in guidance.

## Connected rounds

`POST /coeus/api/challenges/next` issues or resumes a question. Cards and speech use
its typed letter/word payload and recommended distractors, including content absent
from the bundled dictionary. Letter Jam shuffles cards, defaults to Andika, and displays
at most five choices. Device speech reads the supplied text and sentence directly;
published Coeus recordings remain a separate migration step.

Keep trying is the default; Show the answer ends the round on a miss. First-try
success sends `known: true`; any miss makes the finished round `known: false`.
The client sends no per-guess events, metrics, hints or skip requests. Celebrations
and the three-second Next countdown start only after confirmed server completion.

A small localStorage record, scoped by student, lesson version and enrollment,
holds the challenge UUID, wrong choice IDs and exact pending submission UUID/boolean.
It contains no mastery, profile, counters or legacy saves. Wrong guesses and completed
answers are saved synchronously before further play or submission. Refresh retrieves
the saved challenge first. An active pending answer is retried exactly; completed
questions use the server receipt. Conflicts trigger retrieval and an explicit notice
when another submission completed the question. Recovery is retained during network,
session, access and availability errors; Retry connection renews CSRF, revalidates
context, and resumes. Only a successful next-question response replaces the record.
Storage failures pause play. Clearing site storage or using a different browser
does not transfer this local unfinished-guess record.

A damaged record stays intact and shows a distinct error: reconnecting cannot
repair damaged data. It may contain an uncertain completed answer, so replacing
it with a new UUID or an assumed miss would violate exact outcome recovery. A 404
also preserves the record: Coeus uses 404 for missing launch resources as well as
an unknown challenge, not as a definitive deletion acknowledgement. Automated
repair after destructive development resets is outside this client contract.

Recovery is separate for each lesson. Leaving or returning to Coeus preserves the
unresolved server question. There are no local progression or mastery writes.
Settings & progress pauses the active round and retrieves current Coeus summaries
on opening, refresh, or window focus. It never calculates mastery locally. Session
expiry or revoked access uses the same connection recovery flow as gameplay;
other statistics failures offer a retry without showing stale counts.

Answer mode, card font and celebration effects/chimes are saved per student and
lesson version on this browser in a separate `letter-jam-coeus-preferences-v1`
key. No old profiles or progress are imported or deleted. Storage failures leave
preferences usable for the session and display a notice in Settings. Coeus owns
student/lesson selection. Home Screen uses a relative installation-root start URL (`/letterjam/` in production), matching its relative scope and identity, and directs to Coeus.
This panel requires the retrieval API in Coeus PR #13.

## Verification

The client tests execute new-content letter/word rounds, wrong-guess refresh,
one-and-done, delayed/lost receipts, exact retries, conflicts, unavailable context,
storage failure, StrictMode, rapid clicks and three-second advancement. The request
tests verify selector scope, same-origin credentials and decoded CSRF headers.
Test discovery is restricted to `src` so retained worktrees are excluded.

2026-09-13: 148 tests and the production build passed. A real Chromium browser
using an isolated API fixture verified five-card layout at 1280×720 and 390×650,
wrong-choice refresh and recovered-success feedback. This is not a live Coeus
login/launch or physical iPad acceptance test. Those remain migration gates.

## Local development

In the sibling Coeus repository, clear cached Laravel config if needed, then run:

```powershell
$env:APP_URL='http://localhost:8000/coeus'
$env:SESSION_PATH='/coeus'
$env:SESSION_SECURE_COOKIE='false'
php -S 127.0.0.1:8001 scripts/dev-router.php
```

Here run `npm ci` and `npm run dev`. Open `http://localhost:8000/coeus/games`.
Vite proxies `/coeus` without changing Host, Origin or paths. Session cookies stay
under `/coeus`; the CSRF cookie stays readable from `/letterjam/` at `/`.
For another port use `npm run dev -- --port 8010` and update Coeus `APP_URL` to match.
Use a disposable local game registration enabled for bootstrap testing; production
enablement waits for the complete migration. This requires the paired Coeus
game-context API; see its `docs/game-bootstrap.md` for response/error contracts.

Validation: `npm test` and `npm run build`. Coeus tests cover authorization,
enrollment/version validation, compatibility revocation, and mounted return paths.

## Published audio

Each issued item's optional `media` array carries immutable Coeus clip references.
Letter Jam uses `letter-name`, `word-name`, and `context-sentence` roles for the
name/context/name sequence and wrong-card naming. No text lookup into the bundled
snapshot selects connected recordings. Only same-origin `/coeus/lesson-media/`
URLs with the supplied hash are accepted, independently of the game's base URL.
Sprite seconds become Howler milliseconds, with explicit MIME-to-codec mapping
because media URLs have no extension. The decoded clip cache is bounded to eight
entries and includes URL, clip identity and offsets.

Absent, invalid, failed or timed-out audio uses device speech. The issued sentence
is preserved; a context recording with different wording is ignored. Replay,
settings and leaving cancel current speech and queued segments. No audio event
records an outcome. The existing first-gesture audio unlock remains in use;
physical iPad acceptance is still required before production rollout.
