# Agent Verification Guide

## Purpose

Use this document to choose the right verification path for a task without rediscovering commands or test suites.

This is a curated guide for:

- fast unit tests for isolated logic,
- integration tests for cross-module behavior,
- type and lint checks,
- manual/debug inspection commands.

Use the cheapest verification that can detect the risk introduced by the task.

---

## Verification Strategy

Prefer this order:

1. **Unit tests** for isolated logic, pure functions, utility methods
2. **Integration tests** for API endpoints, database interactions, external services
3. **E2E tests** for critical user flows (use sparingly, only for high-value paths)
4. **Type/lint checks** for type safety and code quality
5. **Manual inspection** only when automated tests are insufficient

**Do not run the full test suite for every change**. Use filtering to run only affected tests first.

---

## Quick Map

> **TODO**: Customize these commands for your project's test runner and structure.

### I changed isolated business logic

```bash
[test-command] --filter=[TestName]
# Example: npm test -- --testNamePattern="MyService"
# Example: pytest tests/unit/test_my_service.py
```

Best for:
- Pure functions
- Utility methods
- Service layer logic
- Data transformations

---

### I changed an API endpoint

```bash
[test-command] tests/[api-or-integration]/
# Example: npm test tests/integration/api/
# Example: pytest tests/integration/test_api.py
```

Best for:
- HTTP request/response validation
- Authentication/authorization
- Input validation
- Error handling

---

### I changed the database layer

```bash
[test-command] tests/[database-or-repository]/
# Example: npm test tests/repositories/
# Example: pytest tests/unit/test_repositories.py
```

Best for:
- CRUD operations
- Query correctness
- Transaction handling
- Schema migrations

---

### I changed frontend components or UI

```bash
[type-check-command]
[lint-command]
[test-command] -- [component-path]
# Example: npm run type-check && npm run lint
# Example: npm test -- src/components/MyComponent.test.tsx
```

Best for:
- Component prop types
- UI state management
- User interaction handlers
- Visual regression (if applicable)

---

### I changed configuration or environment setup

```bash
[build-command]
[integration-test-command]
# Example: npm run build && npm test -- tests/integration/
```

Best for:
- Environment variable changes
- Build pipeline modifications
- Dependency updates

---

### I refactored shared/core functionality

```bash
[full-test-suite-command]
# Example: npm test
# Example: pytest
# Example: cargo test
```

Run the full suite because shared code affects multiple modules.

---

## Recommended Commands By Goal

> **TODO**: Replace these placeholders with your actual commands.

### Run one specific test

```bash
[test-command] --filter=[test-name]
```

### Run all tests in a file

```bash
[test-command] [path/to/test-file]
```

### Run all tests in a folder/module

```bash
[test-command] [path/to/folder]/
```

### Run the full test suite

```bash
[test-command]
```

### Format all modified files

```bash
[format-command]
# Example: npm run format
# Example: black .
# Example: cargo fmt
```

### Lint check

```bash
[lint-command]
# Example: npm run lint
# Example: eslint src/
# Example: pylint src/
```

### Type check

```bash
[type-check-command]
# Example: npm run type-check
# Example: tsc --noEmit
# Example: mypy src/
```

---

## Manual / Debug Checks

> **TODO**: Document common debug/inspection commands for your stack.

### Inspect available CLI commands

```bash
[cli-help-command]
# Example: npm run
# Example: make help
# Example: python manage.py help
```

### Interactive REPL/console

```bash
[repl-command]
# Example: node
# Example: python
# Example: rails console
```

### Inspect logs

```bash
[log-command]
# Example: tail -f logs/app.log
# Example: docker logs [container-name]
```

### Database inspection

```bash
[db-cli-command]
# Example: psql -d mydb
# Example: mongosh
# Example: sqlite3 database.db
```

---

## Anti-patterns

Do not:

- Run the full test suite for small isolated changes — use targeted test filters
- Skip formatting/linting before committing code
- Trust manual testing alone for backend logic that can be unit tested
- Skip type checks when working with statically-typed languages
- Ignore test failures in unrelated modules (they may indicate coupling issues)

---

## Notes

- Keep this guide up to date as your test structure evolves
- Add new sections as new testing patterns emerge in your project
- When a verification step becomes repetitive, consider automating it in CI/CD
