Local NCM submission simulation

Run from the project root:

```sh
postman simulation run postman/simulations/ncm-approval.sim.yaml --port 4900 --no-history
```

Send API requests to `http://127.0.0.1:4900/workflow` followed by the existing
`/services/...` path. This serves a local mock; it never forwards requests to
the live API.

The completion request validates the NCM payload supplied for this change:
`Approved` or `Rejected`, payload type `ncm_stock_request_function_approval`,
empty `payloadData`, a nonblank comment, attachment IDs, and
`fetchCurrentTask: false`. The fixture task ID is `ncm-task`.

Upload responses return the fixture file ID `ncm-evidence`. Completion success
returns `{}` to exercise the client's existing JSON response handling; these
responses are local assumptions, not captured live API responses. The CLI was
signed out, so no published owner mock was searched or downloaded.

Local test controls (all relative to the same `/workflow` prefix):

- `GET /__test/reset` clears recorded submissions and injected failures.
- `GET /__test/fail-next` makes the next valid completion return HTTP 500.
- `GET /__test/submissions` lists successful completion payloads.

Other endpoints return HTTP 501. Use only synthetic data with this mock.
