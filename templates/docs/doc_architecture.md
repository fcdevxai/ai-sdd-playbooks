# Technical Architecture Reference

## Purpose

This document is the canonical technical architecture reference for [YOUR_PROJECT_NAME].

Use it to decide:

1. where a new file belongs,
2. how modules should be structured,
3. how the main runtime flows are organized,
4. what contracts and boundaries should not be changed by mistake.

For verification commands, test selection by risk, and debug workflows, use:

- [`docs/doc_verification_guide.md`](./doc_verification_guide.md)

For AI agent operational guidance (what to check before implementing, skills activation, planning workflow), use:

- [`docs/agent_architecture.md`](./agent_architecture.md)

---

## Project layout (source of truth)

> **TODO**: Update this section with your actual project structure.

```
src/
├── [domain-module-1]/
├── [domain-module-2]/
├── shared/
└── ...

tests/
├── unit/
├── integration/
└── e2e/

docs/
├── agent_architecture.md
├── doc_architecture.md
└── doc_verification_guide.md
```

---

## Main flows and starting points

> **TODO**: Document the entry points for your main user flows.

**Example**:
- **User authentication**: starts at `[route/file]` → `[service/controller]` → `[data layer]`
- **Core feature X**: starts at `[entry point]` → `[business logic]` → `[persistence]`

---

## Layer responsibilities

> **TODO**: Define the responsibilities of each architectural layer in your system.

### [Layer 1 - e.g., API/Controllers]

- Responsibility: handle HTTP transport, validation, response formatting
- Should NOT: contain business logic or direct database queries

### [Layer 2 - e.g., Services/Use Cases]

- Responsibility: orchestrate business logic, coordinate between layers
- Should NOT: handle HTTP concerns or UI rendering

### [Layer 3 - e.g., Models/Repositories]

- Responsibility: data access, domain entities, persistence
- Should NOT: contain presentation logic or external API calls

---

## File placement rules (decision guide)

> **TODO**: Define where new files should be created based on their purpose.

When adding code, decide by intent:

1. New API endpoint → `[path/to/endpoints]`
2. New business logic → `[path/to/services]`
3. New data model → `[path/to/models]`
4. New UI component → `[path/to/components]`
5. New test → `[path/to/tests]`

---

## Naming conventions

> **TODO**: Document your project's naming conventions.

### Backend/API

- File names: `[convention]` (e.g., kebab-case, PascalCase)
- Function/method names: `[convention]` (e.g., camelCase, snake_case)
- Class names: `[convention]`

### Frontend

- Component names: `[convention]`
- File names: `[convention]`
- Hook/utility names: `[convention]`

---

## API and contract boundaries

> **TODO**: Document critical API contracts that should not be changed without explicit scope.

- **API response formats**: maintain consistent JSON structures
- **Database schemas**: coordinate changes with migrations
- **Event contracts**: preserve event payload shapes
- **Module interfaces**: breaking changes require version bumps

---

## Configuration and runtime environment

> **TODO**: Document your tech stack, runtime requirements, and configuration approach.

- **Language/Framework**: [e.g., Node.js 20, Python 3.11, Java 17]
- **Database**: [e.g., PostgreSQL 15, MongoDB 6]
- **Key dependencies**: [list major libraries/frameworks]
- **Environment variables**: see `.env.example`
- **Development setup**: `[command to start dev environment]`

---

## Anti-patterns (do not introduce)

> **TODO**: List common anti-patterns specific to your architecture.

- Business logic in presentation layer
- Direct database queries outside data access layer
- Hardcoded configuration values
- Circular dependencies between modules
- Missing error handling at layer boundaries
