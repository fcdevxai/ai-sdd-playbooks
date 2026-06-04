## Rutas SDD (Spec-Driven Development)

```
openspec/
├── specs/          -> source of truth permanente (NUNCA editar specs archivadas)
│   ├── system.md   -> arquitectura global, convenciones, modelo de datos
│   └── [module]/
│       └── spec.md
└── changes/        -> features en curso (una carpeta por feature activa)
    └── [ticket-slug]/
        ├── OWNER.md
        ├── proposal.md   -> spec de la feature (inmutable una vez APROBADA)
        ├── design.md
        └── tasks.md
```

---

## Reglas del agente (críticas)

1. **NUNCA modificar archivos fuera del scope de la spec activa** - la sección "Restricciones" de `proposal.md` define el boundary.
2. **SIEMPRE leer `openspec/changes/[feature]/proposal.md` antes de generar código** - los criterios de aceptación son los únicos criterios de éxito válidos.
3. **Si encuentras ambigüedad en la spec -> DETENTE -> señala el problema -> espera instrucción**. No improvises.
4. **Generar tests ANTES o JUNTO al código**, nunca después.
5. **Specs en `openspec/specs/` son inmutables** - si necesitas cambiar una spec archivada, abre una nueva en `openspec/changes/`.
6. **No crear archivos de documentación** a menos que el usuario lo pida explícitamente.

---

## Comandos del ciclo SDD

| Comando | Fase | Qué hace |
|---|---|---|
| `/sdd-enrich-us [ticket]` | Ideación | Enriquece user story, produce `proposal.md` draft |
| `/sdd-new [ticket] [desc]` | Inicio | Crea carpeta `openspec/changes/[ticket]/` con todos los artefactos |
| `/sdd-ff [ticket]` | Planificación | Granulariza `tasks.md` desde la proposal aprobada |
| `/sdd-apply [ticket]` | Implementación | Ejecuta spec activa (TDD, sin improvisar fuera de scope) |
| `/sdd-code-review [ticket]` | Revisión | Revisión automática contra spec |
| `/sdd-ux-gate` | Revisión | `ux-gate-report.md` con veredicto UX/UI (`READY FOR PR UX` / `REQUIRES UX FIXES`) |
| `/sdd-commit [ticket]` | Cierre | Commit estructurado con referencia a spec |
| `/sdd-verify [ticket]` | Cierre | Verifica criterios de aceptación post-PR |
| `/sdd-archive [ticket]` | Cierre | Integra delta en `openspec/specs/`, limpia `openspec/changes/` |
