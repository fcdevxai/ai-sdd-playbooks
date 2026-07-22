# Spec de sistema — <NOMBRE_DEL_PROYECTO>

**Versión**: 1.0 · **Owner**: <Tech Lead>

> Fuente de verdad permanente y global para arquitectura, convenciones y modelo
> de datos. Todo agente lee esto antes de modificar capas del proyecto. Cada
> feature archivada enriquece esto y las specs de dominio (el flywheel de SDD).

## Principios de producto (restricciones de arquitectura)

- **Least data**: guardar solo lo estrictamente necesario.
- **Límites de ownership claros**: cada tenant/usuario accede solo a sus propios datos.
- **Security by design**: las restricciones de privacidad/seguridad son obligatorias.

## Stack tecnológico

Ver [AGENTS.md](../../AGENTS.md).

## Arquitectura por capas

Ver [docs/doc_architecture.md](../../docs/doc_architecture.md).

## Modelo de datos principal

<entidades y campos clave — reemplazar con los reales>

## Convenciones de código

<convenciones de backend / frontend / testing>

## Regla de inmutabilidad

Una vez que una spec está aprobada y archivada, es inmutable. Los cambios
futuros se introducen mediante una carpeta nueva en `openspec/changes/`.
