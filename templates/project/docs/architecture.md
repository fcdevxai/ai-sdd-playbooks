# Architecture

> Project architecture reference. `sdd-enrich-us`, `sdd-design`, and `sdd-plan`
> read this before proposing or planning work.

## Layers

```
[entry points] → [transport] → [application] → [domain] → [infrastructure]
```

| Layer | Responsibility | Must NOT do |
|---|---|---|
| Transport | parse input, format output | business orchestration |
| Application | coordinate use cases | direct UI concerns |
| Domain | business rules & invariants | external I/O coupling |
| Infrastructure | persistence & integrations | core business decisions |

## Modules

<list the main modules/domains and their entry points>

## Data model

<key entities and their relationships>
