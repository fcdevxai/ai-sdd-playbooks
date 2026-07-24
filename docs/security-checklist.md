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
| Contrato canónico de API (`contract.path_in_loom`, por defecto `openspec/specs/contracts/openapi.yaml`) | `sdd-design` escribe acá (ADR-030). Es un artefacto versionado que se comparte con todos los repos consumidores: un secreto/token/PII que entre en `example`/`description`/`servers` queda en el historial de git de cada uno, así que la filtración es permanente. La ruta sale de config, no está hardcodeada, y debe quedar contenida al repo. | maintainers |
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
| Una filtración de secretos/PII en el contrato canónico es irreversible | El contrato se comparte con el historial de git de todos los repos consumidores. La mitigación es preventiva —la prohibición está dentro de la instrucción de `sdd-design` y hay un test de contenido que verifica que el propio texto del skill no traiga literales con forma de credencial— pero **no hay escáner de secretos** sobre el contrato. Si eso pasa a ser insuficiente, es un change aparte. | maintainers (ADR-030) | 2026-07-24 |

---

## Notas

- Actualizá este archivo cada vez que se introduzca una superficie sensible nueva (mecanismo de auth nuevo, integración nueva con PII, capacidad de admin nueva).
- Si `sdd-security-gate` encuentra repetidamente problemas en la misma área, considerá agregar una regla propia acá en vez de confiar en que el agente la redescubra cada vez.
