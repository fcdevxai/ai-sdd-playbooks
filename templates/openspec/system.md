# System Spec — [YOUR_PROJECT_NAME]

**Version**: 1.0
**Last Updated**: [YYYY-MM-DD]
**Owner**: [Tech Lead / Architecture Owner]

> Global system spec. Defines architecture, conventions, and data model rules that apply to all modules. Every agent should read this file before changing project layers.

---

## Product

[YOUR_PROJECT_NAME] is [short product description].

### Product principles (architecture constraints)

- **Least data principle**: store only what is strictly required.
- **Clear ownership boundaries**: each user/tenant can only access their own data.
- **Simplicity first**: optimize for clear, predictable workflows.
- **Security by design**: privacy and security constraints are mandatory, not optional.

---

## Technology stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | [e.g., Node / PHP / Python / JVM] | [version] |
| Backend framework | [e.g., Laravel / NestJS / FastAPI / Spring] | [version] |
| Frontend | [e.g., React / Vue / Angular] | [version] |
| Database | [e.g., PostgreSQL / MySQL / MongoDB] | [version] |
| Testing | [e.g., PHPUnit / Jest / Pytest] | [version] |
| CI | [e.g., GitHub Actions / GitLab CI] | [version] |

---

## Layer architecture

```
[Entry Point / Routes]
     |
     v
[Transport Layer: Controllers / Handlers]
     |
     v
[Application Layer: Use Cases / Services]
     |
     v
[Domain Layer: Entities / Rules]
     |
     v
[Infrastructure Layer: Repositories / External Services]
```

### Responsibilities by layer

| Layer | Responsibility | Must NOT do |
|---|---|---|
| Transport | Parse input, delegate, format output | Business orchestration |
| Application | Coordinate use cases and flow | Direct UI concerns |
| Domain | Business rules and invariants | External I/O coupling |
| Infrastructure | Persistence and integrations | Core business decisions |

---

## Main data model

> TODO: replace with your real entities/tables and key fields.

### `[entity_1]`
| Field | Type | Notes |
|---|---|---|
| id | [type] | primary key |
| [field] | [type] | [notes] |

### `[entity_2]`
| Field | Type | Notes |
|---|---|---|
| id | [type] | primary key |
| [field] | [type] | [notes] |

---

## Core flows

| Flow | Entry point |
|---|---|
| [Flow 1] | [route/handler/use case] |
| [Flow 2] | [route/handler/use case] |
| [Flow 3] | [route/handler/use case] |

---

## Code conventions

### Backend
- Explicit types in public APIs
- Clear separation between transport, application, domain, infrastructure
- No business logic in controllers/handlers

### Frontend
- Typed contracts for page/component props
- No hardcoded URLs when a routing abstraction exists
- Reusable UI primitives over duplicated components

### Testing
- Prefer focused tests by risk
- Include edge and failure scenarios
- Avoid coupling tests to implementation details

---

## SDD repository structure

```
openspec/
├── specs/            -> permanent source of truth
│   ├── system.md     -> this file
│   └── [module]/spec.md
└── changes/          -> active features (one folder per ticket)
    └── [ticket-slug]/
        ├── OWNER.md
        ├── proposal.md
        ├── design.md
        └── tasks.md
```

### Immutability rule

Once a spec is approved and archived, treat it as immutable. Future behavior changes must be introduced via a new change folder in `openspec/changes/`.
