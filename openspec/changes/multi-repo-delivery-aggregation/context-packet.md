---
sources:
  proposal: 30c848434bd833cf2f9d2689931aeb5e288ca3f13765bff9a97e88c3b3e369b8
  tasks: e4563983f2a9c5c7072d7cc937d5322fc29623f695998d8b4a05bb485f1ad33e
---
# Context Packet — Delivery multi-repo agregado

## Ticket

multi-repo-delivery-aggregation

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** Con 3 repos impactados y solo el hub mergeado, `playbook next` NO es `sdd-verify` (es `wait_for_github_ci`/`merge` según el agregado).
**AC-2:** El delivery agregado es `merged` si y solo si los 3 PRs impactados están mergeados.
**AC-3:** Un repo con `ci_failed` produce agregado `ci_failed` con el repo nombrado en `blocked_reason`/`per_repo`.
**AC-4:** Un repo con contexto GitHub no disponible produce agregado `unknown` (fail-closed), nunca `merged`.
**AC-5:** Un proyecto de un solo repo (sin `## Impacted repos`) produce comportamiento idéntico al actual (sin regresión): early-return a `resolveDelivery({ cwd })`.
**AC-6:** `playbook status --json` incluye `delivery.per_repo` con una entrada por repo impactado (hub incluido).

## Constraints and non-goals

- **No-goal:** modificar el motor puro (`src/lifecycle/engine.js`) — su firma y pureza quedan intactas; la agregación es un input.
- **No-goal:** cambiar el path single-repo — queda garantizado por el early-return cuando no hay `## Impacted repos`.
- **No-goal:** tocar packet-verbatim, planner-only, riesgo monótono ni inmutabilidad de ADRs (Principio 4).
- **Constraint:** el `--json` de `status` gana el campo `delivery.per_repo` de forma **aditiva** (no rompe consumidores existentes del JSON).
- **Nota al reviewer (runtime_relevant_capabilities):** se propone `[]`. Este change modifica salida de CLI (`status`/`next`), pero el adapter `cli` es experimental (nunca emite `passed`); declararlo relevante bloquearía `sdd-runtime-gate` con `ADAPTER_NOT_IMPLEMENTED` sin harness real que satisfacer. La conducta se cubre 100% con `test/delivery.test.js` (fakes de git/gh keyed por cwd) + verificación manual contra un hub fixture con repos hermanos, documentada en el verification-report. Es la misma resolución que tomó `restore-contract-first` (Fase 1) ante el mismo hallazgo, ahora anticipada desde `sdd-new` como recomienda el plan. **Confirmá o corregí este valor al aprobar.**

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** **Fail-closed en la ruta de estado.** La agregación NUNCA degrada a `merged` ante incertidumbre (repo `unknown`, contexto GitHub no disponible, path no resoluble). Test negativo: un repo `unknown` mezclado con repos `merged` produce agregado `unknown`, no `merged`.
**SEC-2:** **Nombres de repo → paths de filesystem.** Los nombres de repo se leen de `## Impacted repos` (in-repo, ya validados por el regex `^[A-Za-z0-9_.-]+$` en `extractImpactedRepos`) y se mapean a paths vía `resolveConfiguredRepoPath` (que solo resuelve paths declarados en `config.repos`). No se construyen paths a partir de input no confiable ni se hace path traversal: un nombre no declarado no resuelve a un path arbitrario, cae a `unknown`. Test: un nombre no presente en `config.repos` no lee fuera del árbol configurado.
**SEC-3:** **El delivery agregado no se persiste** (C-10 intacto): se calcula en vivo en cada `status`/`next` y nunca se escribe en `sdd.lock`. No hay nueva superficie de datos en reposo.

## Files touched

- `src/repos/delivery.js`
- `test/delivery.test.js`
- `src/cli/status.js`
- `test/lifecycle-cli.test.js`
- `templates/project/playbook.config.yaml`
- `skills/sdd-verify/canonical.md`
- `skills/sdd-archive/canonical.md`

## Verification commands

- `docs/doc_verification_guide.md`
- `node --check src/repos/delivery.js && node --check src/cli/status.js`
- `node --test test/delivery.test.js && node --test test/lifecycle-cli.test.js`

## Full sources

- openspec/changes/multi-repo-delivery-aggregation/proposal.md
- openspec/changes/multi-repo-delivery-aggregation/tasks.md
