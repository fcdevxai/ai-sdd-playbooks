# Agent Architecture Guide

## Purpose

This document guides AI agents through your project's workflows, conventions, and operational rules.

Use it to define:

1. what to check before implementing any task,
2. which skills to activate for specific task types,
3. planning and verification workflows,
4. project-specific commands and patterns.

For technical architecture (file structure, layers, naming), use:

- [`docs/doc_architecture.md`](./doc_architecture.md)

For verification commands and test strategies, use:

- [`docs/doc_verification_guide.md`](./doc_verification_guide.md)

---

## Pre-implementation checklist

Before writing any code, agents must:

1. Read the relevant specification or requirements document
2. Understand the existing architecture patterns (see `doc_architecture.md`)
3. Identify which files will be affected
4. Determine the appropriate verification strategy (see `doc_verification_guide.md`)
5. Check for existing similar implementations

---

## Task type workflows

> **TODO**: Define workflows for common task types in your project.

### Feature implementation

1. Read the feature specification
2. Identify affected modules and layers
3. Check for existing patterns to follow
4. Implement following layer responsibilities
5. Write/update tests
6. Run verification commands
7. Update documentation if needed

### Bug fix

1. Reproduce the issue
2. Identify the root cause
3. Locate the affected code
4. Write a failing test that captures the bug
5. Fix the bug
6. Verify the test passes
7. Run regression tests

### Refactoring

1. Understand current implementation
2. Run full test suite (baseline)
3. Make incremental changes
4. Run tests after each step
5. Verify no behavior change
6. Update documentation if structure changed

---

## Skill activation patterns

> **TODO**: Document when specific skills should be activated.

Use `@[skill-name]` to activate specialized skills for:

- **New features**: `@sdd-new` (requirements gathering)
- **Implementation**: `@sdd-apply` (coding phase)
- **Code review**: `@sdd-code-review` (before merge)
- **Verification**: `@sdd-verify` (testing phase)

---

## Project-specific rules

> **TODO**: Add project-specific conventions and rules.

- Always run [formatter] before committing
- Breaking changes require [approval process]
- Database migrations must be reversible
- API changes require version bump
- New endpoints require documentation
- Tests must pass before merge

---

## Common commands

> **TODO**: Document frequently used project commands.

```bash
# Setup
[install-command]

# Development
[dev-server-command]

# Testing
[test-command]

# Build
[build-command]

# Deploy
[deploy-command]
```

---

## Anti-patterns for agents

Do not:

- Implement without reading specifications
- Skip tests for "small changes"
- Introduce patterns inconsistent with existing code
- Break API contracts without explicit permission
- Assume requirements — ask for clarification
- Mix refactoring with feature work
