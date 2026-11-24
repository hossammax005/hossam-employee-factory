# HOSSAM-X Employee Factory — E1 Foundation

Status: E1 foundation and hardening implementation candidate. It must still be verified on the Android/Termux runtime before being treated as deployed.

## Included
- Isolated employee records and configuration snapshots.
- New employees remain STOPPED; creation never starts a runtime.
- Configuration validation, including the MVP AI concurrency ceiling of 2.
- Create-only immutable version snapshots; existing version files cannot be overwritten.
- Per-employee serialized configuration updates and optional optimistic expectedVersion checks.
- Initial employee record and version are staged together and published by directory rename.
- Atomic replacement for mutable JSON records using unique temporary files, file sync, and rename.
- Persisted lifecycle state and explicit start/stop.
- Startup recovery marks RUNNING, STARTING, or STOPPING employees INTERRUPTED. Recovery never auto-starts an adapter.
- No automatic version pruning; history is retained, including ten or more versions.

## Runtime storage
runtime-data/employees/EMPLOYEE_ID/employee.json
runtime-data/employees/EMPLOYEE_ID/versions/v000001.json

The runtime-data directory, credentials, sessions, logs, customer data, and secrets must never be committed.

## Usage
Create E1 with: node scripts/create-e1.js

Configuration update:
service.saveConfiguration('E1', fullConfig, { expectedVersion: 1 });

A stale expectedVersion throws VersionConflictError and creates no new version.
Restore an old configuration with restoreConfiguration(employeeId, versionNumber, { expectedVersion }).
Restore creates a new snapshot; it does not rewrite the old one.

At application startup, construct EmployeeLifecycle with the repository and call:
await lifecycle.recoverInterrupted();

This records stale active lifecycle states as INTERRUPTED. It does not start WhatsApp or any adapter. Starting and stopping remain explicit operations.

## Tests
Run:
node --test test/e1.test.js

The tests cover bootstrap, validation, isolation, restore, immutable writes, 20 concurrent saves, stale-version rejection, partial-create cleanup, history retention, explicit lifecycle, and interrupted recovery.

These tests do not establish WhatsApp connectivity, AI provider behavior, customer-context persistence, message deduplication, reconnect reliability, or 24/7 operation.

## Scope exclusions
No WhatsApp adapter, credentials, API integration, customer data, Local API, dashboard, package.json changes, or index.js changes are included in this mission. The existing index.js remains untouched.
