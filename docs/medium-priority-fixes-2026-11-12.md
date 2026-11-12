# Admin session and directions safeguards

Implemented November 12, 2026.

- All `/api/admin` responses receive `Cache-Control: no-store` before parsers, login rate limiters and route handlers. Admin authentication also sets this header directly.
- Admin token verification remains 401/403 for missing/invalid credentials and missing accounts. Database lookup failures return 503 with a retry message. Existing admin pages preserve stored credentials on 503 and display their normal error state.
- Public directions requests are limited to 30 per minute per detected client IP/subnet and 120 per minute per server process. Successful and failed requests count. Blocked requests return 429 with retry headers before calling the routing provider. The frontend displays a specific wait-and-retry message.
- Existing trusted-proxy configuration is retained. Raw forwarding headers do not override client identity. Without verified proxy configuration, clients behind an ingress may share its detected address and quota. IPv6 addresses use the rate-limit library's subnet grouping.
- Rate-limit counters are in memory, reset on process restart, and are independent across replicas. This is an application safeguard, not a distributed or daily provider quota guarantee.

Targeted real-HTTP tests cover admin login/parser cache policy, expired/student/invalid tokens, missing admins, database failure and recovery, client limits, spoofed forwarding headers, service limits across trusted addresses, provider error handling, retry headers and provider-call suppression. Backend tests: 38 passed; 1 unrelated destructive MySQL suite skipped. Production data and provider quotas were not used for rate-limit tests.
