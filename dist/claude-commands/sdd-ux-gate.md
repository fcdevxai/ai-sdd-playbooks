# /sdd-ux-gate — SDD UX Gate — Validación UX/UI pre-PR

## Objetivo

Validar que la implementación cumple el flujo UX/UI esperado antes del PR humano final. Complementa la revisión técnica de `/sdd-code-review` con una evaluación funcional de experiencia de usuario.

## Uso

```
/sdd-ux-gate [ticket-slug]
```

## Cuándo ejecutar

Después de `/sdd-code-review` y antes de `/sdd-commit`.

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/proposal.md` para entender intención de negocio, criterios de aceptación y casos de error.
2. Lee `openspec/changes/[ticket-slug]/tasks.md` para identificar alcance y pantallas tocadas.
3. Si existe, lee `openspec/changes/[ticket-slug]/code-review-report.md` y toma en cuenta los riesgos abiertos.
4. Revisa la UI implementada en las rutas/páginas afectadas y valida el checklist de UX/UI.
5. Genera el reporte en `openspec/changes/[ticket-slug]/ux-gate-report.md`.

## Checklist

### Flujo principal
- [ ] El usuario puede completar el flujo principal sin bloqueos
- [ ] Las acciones críticas son claras (CTAs, navegación, siguiente paso)
- [ ] No hay callejones sin salida ni ambigüedad de estado

### Estados de interfaz
- [ ] Existe estado de loading para acciones críticas
- [ ] Existe estado empty útil y accionable
- [ ] Existe estado error claro con opción de recuperación
- [ ] Existe feedback de éxito cuando corresponde

### Formularios e interacciones
- [ ] Los errores de validación son claros y accionables
- [ ] Los errores aparecen junto al campo correcto
- [ ] Un submit fallido no borra entrada del usuario inesperadamente
- [ ] Botones deshabilitados/loading previenen submit duplicado

### Responsive
- [ ] Mobile (~360px): sin contenido cortado ni acciones inaccesibles
- [ ] Tablet (~768px): jerarquía visual estable y legible
- [ ] Desktop (1024px+): layout estable y eficiente de escanear

### Accesibilidad básica
- [ ] El flujo crítico es navegable por teclado
- [ ] El focus visible está presente y es consistente
- [ ] Inputs y botones tienen nombre/label accesible
- [ ] Contraste básico aceptable en textos y controles críticos

### Contenido y confianza
- [ ] Copy coherente con tono de producto
- [ ] Mensajes de advertencia y acciones irreversibles son explícitos
- [ ] No hay textos placeholders o mensajes técnicos expuestos al usuario

### Evidencia
- [ ] Capturas o video del flujo principal
- [ ] Capturas de loading / empty / error
- [ ] Evidencia mobile y desktop de pantallas clave

## Formato de reporte

`openspec/changes/[ticket-slug]/ux-gate-report.md` con scope revisado, checklist UX/UI, issues con severidad/ubicación/problema/corrección, evidencia y veredicto.

## Criterio de bloqueo

El veredicto debe ser `REQUIRES UX FIXES` si se cumple cualquiera:
- El flujo principal no se puede completar
- Falta al menos un estado crítico (loading, empty o error)
- Existe quiebre responsive severo en flujo crítico
- Existe problema de accesibilidad severo en flujo crítico

## Qué NO reemplaza

- Decisión final de PM/UX sobre adecuación de negocio
- Validación técnica de `/sdd-code-review`
- Verificación de cobertura de tests de `/sdd-verify`
