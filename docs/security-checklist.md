# Checklist de seguridad

## Propósito

Documento de referencia para `sdd-security-gate`. Lista las áreas
sensibles conocidas del proyecto y los controles que aplican, para que el gate
no tenga que redescubrirlas de cero en cada feature.

Mantené este archivo corto y actualizado — está pensado para leerse completo
antes de cada revisión de seguridad.

---

## Superficies sensibles de este proyecto

> **TODO**: listá las áreas donde un error tiene impacto desproporcionado. Actualizá a medida que el sistema crece.

| Superficie | Por qué es sensible | Owner |
|---|---|---|
| Contrato canónico de API (`contract.path_in_loom`, por defecto `openspec/specs/contracts/openapi.yaml`) | `sdd-design` escribe acá (ADR-030). Es un artefacto versionado que se comparte con todos los repos consumidores: un secreto/token/PII que entre en `example`/`description`/`servers` queda en el historial de git de cada uno, así que la filtración es permanente. La ruta sale de config, no está hardcodeada, y debe quedar contenida al repo. Contención real desde ADR-035 (`resolveContainedPath` en `src/util/fs-safe.js`). | maintainers |
| Roles del contrato (`contract.provided_by`/`consumed_by`, ADR-038/ADR-039) | Nombres de config que resuelven a paths de repos **hermanos**, fuera del repo por diseño (topología multi-repo) — la contención-al-repo de `resolveContainedPath` no aplica acá y forzarla rompería la topología. El control real es que el nombre exista en `repos:` vía `resolveConfiguredRepoPath`; un nombre desconocido falla nombrándolo, sin tocar el filesystem. Declarar `provided_by` **no** instala `contract-drift` en el CI de ese repo — riesgo aceptado de falsa sensación de conformidad verificada, mitigado dejándolo explícito en el texto del skill (`sdd-apply`). | maintainers |
| `postinstall` (`scripts/postinstall.cjs`) | Corre automáticamente en cada `npm install` de cada consumer/CI — superficie de supply-chain nueva y de la mayor exposición posible (código de este paquete ejecutándose en máquinas que no controlamos). Acotada a message-only por ADR-034: nunca escribe, nunca lee el repo del consumer, nunca hace red, nunca falla; forzado a `.cjs` (no `.js`) para no depender del `package.json` del consumer. | maintainers |
| `playbook install --link` (symlinks a `sourceRoot`) | Modo dev-only opt-in (ADR-036): escribe symlinks en los directorios globales (`~/.claude/skills`, `~/.agents/skills`). Los targets de symlink salen únicamente de nombres de skill controlados por el propio paquete, nunca de config/input externo. | maintainers |
| [ej. Autenticación/sesión] | [ej. un compromiso da acceso total a la cuenta] | [equipo/persona] |
| [ej. Datos de pago] | [ej. regulado, alto impacto si se filtra] | [equipo/persona] |
| [ej. Acciones de admin] | [ej. riesgo de escalación de privilegios] | [equipo/persona] |

---

## Reglas específicas del proyecto

> **TODO**: completá con reglas propias del stack/dominio. Ejemplos genéricos abajo.

- **Autorización**: [ej. toda acción de un controller pasa por `AuthorizationMiddleware`; no existe "logueado = permitido" implícito]
- **Límites de ownership**: [ej. toda query de recursos propios del usuario filtra por `tenant_id`/`user_id` — nunca confiar solo en un ID provisto por el cliente]
- **Secretos**: [ej. los secretos viven en `.env`/secret manager; nunca en código o config commiteada]
- **Campos sensibles**: [ej. listar campos que nunca deben aparecer en respuestas de API o logs — contraseñas, tokens, DNI, etc.]
- **Proceso de dependencias aprobadas**: [ej. toda dependencia nueva requiere aprobación de X antes del merge]

---

## Riesgos aceptados conocidos

> **TODO**: documentá riesgos que el equipo aceptó conscientemente, con el razonamiento y la fecha, para que `sdd-security-gate` no los marque de nuevo como hallazgos nuevos.

| Riesgo | Razonamiento | Aceptado por | Fecha |
|---|---|---|---|
| Un change que toca una API pero declara `impact.public_contract: false` saltea el authoring del contrato en silencio | El trigger es un campo de la proposal confirmado por un humano, y declararlo mal ya hoy saltea **toda** la etapa de diseño. El riesgo se hereda del modelo de impact, no lo agrega ADR-030. | maintainers (ADR-030) | 2026-07-24 |
| Este repo no tiene cobertura E2E automatizada de su propio CLI | ADR-032: el adapter `cli` del runtime-gate sigue sin implementar. En su lugar se exige un test unitario que falle contra el código previo **más** una invocación real registrada en el `runtime-gate-report.md`. Esa invocación es una **captura puntual, no una suite de regresión**: no se re-corre en changes futuros. Lo que sí se re-corre por `npm test` y CI es el test unitario. El disparador para implementar el harness está nombrado en el ADR (cobertura que un unitario + una captura no puedan dar). | maintainers (ADR-032) | 2026-07-24 |
| Con el árbol sucio, un change ya mergeado sigue reportando `uncommitted` | ADR-033: `localGitState` corta a `uncommitted` antes de consultar GitHub — deliberado, fijado por un test, y lo que mantiene el CLI usable offline. Con `lifecycle: runtime_cleared` + PR mergeado + cualquier archivo sin commitear, `next` puede volver a sugerir `sdd-commit`. Cerrarlo exigiría consultar GitHub antes del estado local: rompe el test fijado y fuerza una llamada de red en el camino común. En ese caso el operador **sí** tiene trabajo sin commitear, así que el consejo es imperfecto, no absurdo. | maintainers (ADR-033) | 2026-07-24 |
| La protección de los artefactos firmados es una regla en un prompt, no un permiso de filesystem | ADR-031 prohíbe que el loop de `sdd-commit` edite `proposal.md`, `design.md`, `tasks.md`, un draft de ADR o un reporte de gate para hacer pasar `validate` — y que debilite el status de un gate. Un agente que ignore la instrucción puede editarlos igual: no hay enforcement mecánico. Lo que lo mitiga es que el resultado queda en el diff y en el PR, bajo revisión humana, antes de mergear. Si eso pasa a ser insuficiente, la vía natural sería un chequeo en `playbook validate` que detecte que un artefacto con `status: approved` cambió — pero es un change aparte, y el nivel de enforcement para esta clase se cerró como wiring + test de contenido. | maintainers (ADR-031) | 2026-07-24 |
| Una filtración de secretos/PII en el contrato canónico es irreversible | El contrato se comparte con el historial de git de todos los repos consumidores. La mitigación es preventiva —la prohibición está dentro de la instrucción de `sdd-design` y hay un test de contenido que verifica que el propio texto del skill no traiga literales con forma de credencial— pero **no hay escáner de secretos** sobre el contrato. Si eso pasa a ser insuficiente, es un change aparte. | maintainers (ADR-030) | 2026-07-24 |
| Con `--ignore-scripts`, el `postinstall` message-only no corre — sin señal de post-update | ADR-034: es el trade-off aceptado de un script `postinstall`; la vía canónica documentada (`playbook install` manual) sigue disponible y no depende de lifecycle scripts. | maintainers (ADR-034) | 2026-07-25 |
| El manifest de instalación (`.playbook-manifest.json`) nunca se versiona ni se comparte entre máquinas | Es intencional: vive solo en el target global (`~/.claude/skills`, etc.), nunca en el repo consumer ni en `playbook.lock`, así que no hay guerra de digests entre máquinas de un mismo equipo — cada una verifica su propia instalación local. Fijado por test (ADR-034, SEC-002). | maintainers (ADR-034) | 2026-07-25 |

---

## Notas

- Actualizá este archivo cada vez que se introduzca una superficie sensible nueva (mecanismo de auth nuevo, integración nueva con PII, capacidad de admin nueva).
- Si `sdd-security-gate` encuentra repetidamente problemas en la misma área, considerá agregar una regla propia acá en vez de confiar en que el agente la redescubra cada vez.
