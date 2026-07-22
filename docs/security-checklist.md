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

---

## Notas

- Actualizá este archivo cada vez que se introduzca una superficie sensible nueva (mecanismo de auth nuevo, integración nueva con PII, capacidad de admin nueva).
- Si `sdd-security-gate` encuentra repetidamente problemas en la misma área, considerá agregar una regla propia acá en vez de confiar en que el agente la redescubra cada vez.
