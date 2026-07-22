# Arquitectura para agentes

## Propósito

Guía a los agentes de IA sobre los flujos de trabajo, convenciones y reglas
operativas de este proyecto — no la estructura técnica (ver
[doc_architecture.md](doc_architecture.md) para eso).

## Checklist previo a implementar

Antes de escribir código, los agentes deben:

1. Leer la spec o el requisito relevante (`openspec/changes/<change-id>/proposal.md`).
2. Entender los patrones de arquitectura existentes (ver `doc_architecture.md`).
3. Identificar qué archivos se verán afectados.
4. Determinar la estrategia de verificación apropiada (ver `doc_verification_guide.md`).
5. Revisar si ya existe una implementación similar.

## Flujos por tipo de tarea

<!-- TODO: describir el flujo real del proyecto para cada tipo de tarea -->

### Implementación de feature
1. Leer la spec de la feature (`proposal.md` aprobada).
2. Identificar módulos y capas afectadas.
3. Implementar respetando las responsabilidades de cada capa.
4. Escribir/actualizar tests (TDD: test primero).
5. Correr los comandos de verificación (`doc_verification_guide.md`).

### Corrección de bug
1. Reproducir el problema.
2. Identificar la causa raíz.
3. Escribir un test que capture el bug (debe fallar antes del fix).
4. Corregir y verificar que el test pasa.
5. Correr tests de regresión.

## Reglas específicas del proyecto

<!-- TODO: convenciones propias, ej. "toda migración debe ser reversible" -->

## Comandos frecuentes

<!-- TODO: setup, dev server, tests, build, deploy -->

## Anti-patrones para agentes

No hagas:

- Implementar sin leer la spec.
- Saltear tests por "es un cambio chico".
- Introducir patrones inconsistentes con el código existente.
- Romper contratos de API sin permiso explícito.
- Asumir requisitos — pedí aclaración.
