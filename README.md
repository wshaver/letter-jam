# Letter Jam

A touch-friendly letter and word recognition game connected to Coeus. Open Coeus,
choose an authorized student and lesson, then launch Letter Jam. All entry paths
require that context; there is no standalone play or local player creation.

## Gameplay

Coeus issues each question and its recommended choices. Letter Jam speaks the
supplied prompt and presents up to five cards. First-try success reports known;
a miss reports unknown when the round finishes. Keep trying is the default;
Show the answer ends the round on a miss. Confirmed answers trigger feedback and
a three-second next-round countdown.

Settings & progress pauses the round. Shared introduced/mastered counts come
from Coeus under its current learning policy, across games and devices. They are
separate from celebrations. Choose the card font, answer interaction and
celebration effects/chimes locally for each student and lesson on this browser.
Preferences do not change server scheduling or migrate old profiles.

## Storage and recovery

Learning history belongs to Coeus. A small browser record retains wrong guesses
and the exact pending answer identity for safe retries after refresh or lost
acknowledgements. Leaving preserves the unresolved question. Session expiry
pauses play until sign-in and revalidation. There is no offline learning mode.

Old browser saves are neither read, imported nor deleted. There is no local
progress backup/restore UI. Clearing browser data can lose unfinished guesses,
pending-answer recovery and presentation preferences; it does not erase saved
Coeus outcomes. See [recovery details](docs/coeus.md).

Home Screen launches open the installation root (`/letterjam/` in production) and direct to Coeus selection. They do
not pin a student's identity into the installation. A bookmarked launch with
selectors must still pass current Coeus authorization.

## Audio and display

Connected play uses published Coeus recordings by explicit name/context roles.
Missing or failed recordings fall back to device speech using the issued text.
Recorded words bracket device-spoken context sentences; letters can use recorded
names and contexts. Older questions without media still use device speech.
Six locally served card fonts are selectable; Andika is the default. Celebration
effects and chimes can be disabled without muting the question prompt.

## Development

Follow [same-origin setup](docs/coeus.md) to run Coeus on port 8001 and Vite on
port 8000, with `/coeus` proxied to the backend. Start at
`http://localhost:8000/coeus/games` with an enabled local test registration.
The statistics panel requires Coeus's learning retrieval API (Coeus PR #13).

```sh
npm install
npm run dev
npm test
npm run build
```

React, TypeScript and Vite provide the client. `src/coeus` handles authenticated
requests and durable round recovery; `src/ui` presents connected play. Unused local learning and profile storage code has been removed. Content-generation
tools and source snapshots remain for lesson/audio migration; they do not select
connected questions or store learning progress.

## Deployment

`npm run publish:letterjam` builds and publishes to the configured Letter Jam
host with verified uploads and rollback. Deployment configuration and SSH keys
stay in ignored local files. Do not deploy or enable the production launcher
until the remaining media and live browser/iPad acceptance gates are complete.
No deployment is part of this update.
