# Coeus migration

Branch includes authorized launch bootstrap only. `/letterjam/` and URLs carrying
Coeus selectors open the connected screen. The standalone root without selectors
retains local play. Existing local profiles/backups are not read or migrated by
the connected entry. Connected gameplay is the next migration slice; keep Letter
Jam disabled in the Coeus registry and do not deploy this slice by itself.

Launch selectors are `student`, `lesson` (version ID), and `game=letter-jam`.
The client initializes `/coeus/sanctum/csrf-cookie`, then retrieves
`/coeus/api/game-context` with same-origin session credentials. It shows the
authorized student, lesson version and canonical Back to Coeus link. URL `return`
is ignored. Invalid/missing selectors show a catalog link; session expiry provides
sign-in in another tab and a retry that revalidates the original per-tab selectors.
Network/access failures never start local play.

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
