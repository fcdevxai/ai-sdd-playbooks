---
sources:
  proposal: 6bfe9c0f68587bd6a384120dc1ccd4a9425de78688f8612086236e705bfa4ed9
  tasks: dfa402c041343e8e20a8a8a7c9124d94766807ca71a1f756a8462675027edb75
  contract: 2260109d99574a48c6b6a511d5963f4425e30b430daa082a75e3a115f9aaf70c
---
# Context Packet — Cerrar el circuito de contract-first: autoría → consumo → multi-repo

## Ticket

contract-first-consumption

## Acceptance criteria

**AC-1:** `sdd-design` autora el contrato solo cuando `impact.public_contract:
true` **y** `contract.path_in_loom` **y** `capabilities.http: true`; el texto del
skill enumera las tres condiciones explícitamente.

**AC-2:** Con `capabilities.http: false`, o con `http: true` pero un contrato
público no-HTTP, `sdd-design` saltea la autoría y declara el motivo en
`## Public contracts / interfaces` de `design.md`. Un skip sin declaración es un
defecto.

**AC-3:** `playbook.config.yaml` figura entre los archivos que el `## Context` de
`sdd-design` manda leer.

**AC-4:** `playbook validate` emite un aviso cuando `contract.path_in_loom` está
configurado y `capabilities.http: false`. El aviso es advisory: no altera el exit
code ni invalida ningún artefacto.

**AC-5:** El schema acepta `contract.provided_by` (string) y
`contract.consumed_by` (array de strings), ambos opcionales, y rechaza un nombre
que no exista en `repos:` con un error que lo nombra.

**AC-6:** `sdd-plan` instruye planificar las tasks contra los endpoints del
contrato cuando `contract.path_in_loom` está declarado y el change toca la API.

**AC-7:** `sdd-apply` instruye leer el contrato al implementar, distinguiendo la
obligación del provider (la spec a cumplir) de la del consumer (lo disponible
para llamar, incluidos los códigos de error).

**AC-8:** Ni `sdd-plan` ni `sdd-apply` copian el contrato: lo leen por path
desde el hub. El texto de los skills lo dice explícitamente.

**AC-9:** `context-packet.md` incluye el path del contrato y los roles
declarados cuando existen, y no cambia su forma cuando no existen.

**AC-10:** El bloque multi-repo del template descomentado tal como está
documentado pasa `playbook validate` — `role: impacted` ya no aparece, y el
template explica que "impacted" se lee del `## Impacted repos` de la proposal.

**AC-11:** El template documenta `provided_by`/`consumed_by` con un ejemplo
coherente con `repos:`.

## Constraints and non-goals

**Constraints**

- Las skills se regeneran, no se editan a mano: la edición va en `canonical.md`
  y `npm run generate:check` no debe reportar drift.
- El aviso de `validate` (AC-4) es advisory: no puede alterar exit codes ni
  invalidar artefactos existentes.
- Sin dependencias nuevas.
- No se rehace resolución de paths: se reusan `resolveContainedPath` y
  `resolveConfiguredRepoPath`.
- Los campos nuevos son opcionales; un proyecto single-repo sin contrato no
  cambia en nada su comportamiento actual.
- **Alcanzabilidad (regla de §10 del plan maestro):** tras insertar cada wiring,
  releer `## Preconditions`, `## Context` y `## Rules` del skill tocado y
  confirmar que ninguna sección previa lo contradice. Un test de contenido
  verifica que el texto está, no que sea alcanzable.
- Por la exclusión documentada del adapter `cli` (ADR-032), este change modifica
  comportamiento observable del CLI (`validate`), así que debe traer al menos un
  test que **falle contra el código previo** y registrar en
  `runtime-gate-report.md` la invocación real antes y después.

**Non-goals**

- Drift-check para el consumer (frontend): asimetría aceptada y documentada — no
  hay forma sensata de derivar un OpenAPI de llamadas HTTP.
- Copiar o sincronizar el contrato entre repos: se lee por path.
- Soporte de múltiples contratos por proyecto (`path_in_loom` sigue siendo uno).
- Campo nuevo en el schema de `proposal.md` (por ejemplo `impact.contract_kind`):
  descartado por costo; la determinación vive en `design.md` bajo sign-off.
- El gap análogo de `sdd-runtime-gate`, cuyo `## Context` tampoco manda leer
  `capabilities` aunque su `## Adapter selection` dependa de ellas: mismo
  patrón, change aparte.
- Retocar retroactivamente changes ya archivados (el Ciclo B declaró
  `public_contract: true` por un comando de CLI).
- Verificar automáticamente que el `contract-drift` esté instalado en el CI del
  provider.
- Implementar el harness del adapter `cli` del runtime gate.

## Security considerations

**SEC-1:** Leer el contrato desde `contract.path_in_loom` es una **lectura
derivada de configuración**, exactamente la superficie que ADR-035 endureció.
Debe pasar por `resolveContainedPath`, como ya hace `contract-drift`
(`src/cli/repos.js:154`); nunca por concatenación de strings. Test negativo
obligatorio: un `path_in_loom` que escapa del repo (`..`, absoluto a otro árbol,
o escape vía symlink) es rechazado **antes** de leer.

**SEC-2:** `provided_by`/`consumed_by` resuelven nombres de repo a paths de
filesystem que, por diseño, están **fuera** del repo (son hermanos). La
contención-al-repo **no** aplica ahí y forzarla rompería la topología multi-repo
existente. Lo que sí aplica es la validación de `resolveConfiguredRepoPath`: el
nombre debe existir en `repos:` y tener `path`. Test negativo: un nombre no
declarado falla con error claro, sin tocar el filesystem.

**SEC-3:** Declarar `provided_by` **no** instala el `contract-drift` en el CI de
ese repo — sigue siendo un paso manual del template. Riesgo de falsa sensación de
cobertura: un `provided_by` declarado puede leerse como "la conformidad está
verificada" cuando el CI no está instalado. Mitigación: dejarlo explícito en el
texto del skill y en la spec permanente al archivar. No se agrega verificación
automática de que el CI exista (está fuera del alcance de este repo).

## Files touched

- `schemas/playbook.config.schema.json`
- `test/contract-first.test.js`
- `templates/project/playbook.config.yaml`
- `src/cli/validate.js`
- `schemas/context-packet.schema.json`
- `test/tokens.test.js`
- `src/tokens/packet.js`
- `src/cli/packet.js`
- `skills/sdd-design/canonical.md`
- `skills/sdd-design/SKILL.md`
- `skills/sdd-plan/canonical.md`
- `skills/sdd-plan/SKILL.md`
- `skills/sdd-apply/canonical.md`
- `skills/sdd-apply/SKILL.md`

## Verification commands

- `(sin formatter configurado todavía)`
- `node --check <archivo.js>`
- `node --test test/contract-first.test.js test/tokens.test.js test/skill-contract.test.js`
- `npm test && npm run generate:check`

## Contract

- Path: `openspec/specs/contracts/openapi.yaml`

## Full sources

- openspec/changes/contract-first-consumption/proposal.md
- openspec/changes/contract-first-consumption/tasks.md
