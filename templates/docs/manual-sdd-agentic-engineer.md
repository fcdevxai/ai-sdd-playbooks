# Manual de Implementación SDD en Contexto Agentic Engineer
### Para proyectos con `.claude` y `.github`

> Basado en la metodología OpenSpec LIDR — *Agentic Engineer Playbook 2026*

---

## Tabla de Contenidos

1. [Qué resuelve este manual](#1-qué-resuelve-este-manual)
2. [Diagnóstico previo: la paradoja de productividad IA](#2-diagnóstico-previo-la-paradoja-de-productividad-ia)
3. [Fundamentos: los 3 pilares + SDD](#3-fundamentos-los-3-pilares--sdd)
4. [Arquitectura del repositorio](#4-arquitectura-del-repositorio)
5. [Configuración de `.claude`](#5-configuración-de-claude)
6. [Configuración de `.github`](#6-configuración-de-github)
7. [El ciclo OpenSpec: Proposal → Apply → Archive](#7-el-ciclo-openspec-proposal--apply--archive)
8. [Context Engineering: construir el contexto compartido](#8-context-engineering-construir-el-contexto-compartido)
9. [Estructura de una spec de feature](#9-estructura-de-una-spec-de-feature)
10. [Comandos del ciclo completo](#10-comandos-del-ciclo-completo)
11. [Integración con GitHub Actions](#11-integración-con-github-actions)
12. [Gestión del cambio en specs activas](#12-gestión-del-cambio-en-specs-activas)
13. [Prácticas de equipo y convenciones de escala](#13-prácticas-de-equipo-y-convenciones-de-escala)
14. [Checklist de adopción por fases](#14-checklist-de-adopción-por-fases)

---

## 1. Qué resuelve este manual

La IA acelera la escritura de código, pero **el coste de corrección no desaparece: se desplaza**. Se mueve del momento de escritura al de revisión, validación, QA y producción. Los datos del *AI Productivity Paradox Report* (Faros AI, 2025) sobre más de 10.000 developers en 1.255 equipos son elocuentes:

| Métrica | Variación |
|---|---|
| Tareas completadas (individual) | +21% |
| PRs mergeados (individual) | +98% |
| **Tiempo de revisión de PR (equipo)** | **+91%** |
| **Tamaño medio del PR (equipo)** | **+154%** |
| **Bugs por developer (equipo)** | **+9%** |

El problema no es la IA. Es el método. **Este manual convierte Spec-Driven Development (SDD) en un flujo repetible** dentro de proyectos que usan Claude Code (`.claude`) y GitHub (`.github`), de forma que la IA siempre corre en la dirección correcta desde el principio.

---

## 2. Diagnóstico previo: la paradoja de productividad IA

Antes de implementar, identifica en qué nivel de madurez está tu equipo. Estos síntomas indican que SDD es urgente:

- PRs con comentarios "esto no era lo que pedí"
- Code reviews que duran días porque nadie sabe qué se intentaba hacer
- QA rechaza tickets con requisitos no documentados
- La misma feature implementada dos veces de forma distinta
- Los developers juniors generan código fuera de los patrones del equipo
- Cada developer usa su copiloto con reglas distintas (o sin reglas)

**El cuello de botella no es la velocidad de escritura. Es la falta de definición.**

---

## 3. Fundamentos: los 3 pilares + SDD

Todo el sistema descansa en cuatro elementos que deben alinearse:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   TOOL          PROMPT          CONTEXT             │
│   ────          ──────          ───────             │
│   Claude Code   Instrucciones   Project specs       │
│   configurado   estructuradas   compartidas         │
│   con reglas    con rol,        y versionadas       │
│   del equipo    objetivo y      en el repo          │
│                 restricciones                       │
│                                                     │
│              ▼  SDD  ▼                              │
│   La spec es el contrato ejecutable.                │
│   Código, tests y docs son proyecciones             │
│   de esa spec, no su origen.                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Por qué el Contexto es el pilar crítico

Un prompt mal escrito da feedback inmediato. Un contexto pobre es traicionero: el output parece razonable, pero no encaja con el sistema, no sigue las convenciones, no tiene en cuenta las decisiones ya tomadas. El problema aparece tarde: en code review, en QA, en producción.

> **Sin contexto, la IA inventa. Con contexto, la IA extiende.**

---

## 4. Arquitectura del repositorio

Esta es la estructura de ficheros recomendada para un proyecto con SDD + `.claude` + `.github`:

```
mi-proyecto/
│
├── .claude/                        # Configuración de Claude Code
│   ├── CLAUDE.md                   # Contexto general del proyecto (obligatorio)
│   ├── settings.json               # Configuración del agente
│   └── commands/                   # Comandos personalizados del ciclo SDD
│       ├── enrich_us.md            # /enrich_us — refina user stories
│       ├── new.md                  # /new — genera proposal artifacts
│       ├── ff.md                   # /ff — feature flag / spec inicial
│       ├── apply.md                # /apply — ejecuta el contrato
│       ├── code-review.md          # /code-review — revisión contra spec
│       ├── commit.md               # /commit — commit estructurado
│       ├── verify.md               # /verify — verifica criterios de aceptación
│       └── archive.md              # /archive — archiva la spec completada
│
├── .github/
│   ├── workflows/
│   │   ├── spec-lint.yml           # Valida estructura de specs en PRs
│   │   ├── test-on-spec.yml        # Ejecuta tests alineados a la spec activa
│   │   ├── pr-template-check.yml   # Verifica que el PR referencia una spec
│   │   └── archive-cleanup.yml     # Alerta sobre proposals obsoletas (>2 semanas)
│   ├── PULL_REQUEST_TEMPLATE.md    # Template de PR con referencia a spec
│   ├── ISSUE_TEMPLATE/
│   │   ├── user-story.md           # Template de user story para /enrich_us
│   │   └── bug-report.md
│   └── CODEOWNERS                  # Ownership explícito por dominio
│
├── openspec/
│   ├── specs/                      # Source of truth permanente
│   │   ├── system.md               # Spec de sistema global
│   │   ├── auth/
│   │   │   └── spec.md
│   │   ├── payments/
│   │   │   └── spec.md
│   │   └── [domain]/
│   │       └── spec.md
│   │
│   └── changes/                    # Cambios en curso (uno por feature)
│       └── PROJ-1234-candidate-filters/
│           ├── OWNER.md            # Developer responsable + fecha inicio
│           ├── proposal.md         # La spec de feature completa
│           ├── design.md           # Decisiones técnicas detalladas
│           ├── tasks.md            # Tareas granularizadas
│           └── specs/              # Delta specs (solo lo que cambia)
│               └── candidates/
│                   └── spec.md
│
├── src/                            # Código fuente
├── tests/                          # Tests generados por el ciclo
└── docs/                           # Documentación generada automáticamente
```

---

## 5. Configuración de `.claude`

### 5.1 `CLAUDE.md` — El contexto base del proyecto

Este es el fichero más importante. Claude Code lo lee al inicio de cada sesión. Debe contener todo lo que el agente necesita saber antes de escribir una sola línea.

```markdown
# CLAUDE.md — [Nombre del Proyecto]

## Stack tecnológico
- **Runtime**: Node.js 20 / Python 3.12 / [tu stack]
- **Framework**: NestJS / FastAPI / Next.js / [tu framework]
- **Base de datos**: PostgreSQL 15 + Prisma ORM
- **Testing**: Jest (unit) + Playwright (E2E)
- **CI/CD**: GitHub Actions
- **Gestión de tareas**: Jira / Linear

## Arquitectura
- Patrón: Controllers → Services → Repositories
- Módulos: auth, users, [dominio1], [dominio2]
- Las reglas de negocio viven ÚNICAMENTE en Services
- Los Controllers solo gestionan HTTP y delegan a Services
- Los Repositories son la única capa que accede a la base de datos

## Convenciones de código
- Naming: camelCase para variables/funciones, PascalCase para clases/tipos
- Archivos: kebab-case (ej: candidate-filters.service.ts)
- Commits: Conventional Commits (feat/fix/docs/test/refactor)
- Branches: [TICKET-ID]-descripcion-corta (ej: PROJ-1234-candidate-filters)

## Estándares de testing
- Cobertura mínima: 80% por módulo
- Mocks: siempre mockear dependencias externas (DB, APIs terceros)
- Estructura: describe → describe (subcasos) → it
- Nomenclatura de tests: debe describir comportamiento, no implementación

## Diseño de APIs
- REST con versionado: /api/v1/[recurso]
- PATCH para actualizaciones parciales, PUT solo para reemplazos completos
- Respuestas de error: { error: string, code: string, details?: object }
- Autenticación: JWT Bearer token en header Authorization

## Git workflow
- Branch principal: main (protegida, requiere PR + review)
- Branch de desarrollo: develop
- Feature branches: desde develop, merge a develop via PR
- Nunca hacer commits directos a main ni develop

## Reglas críticas del agente
- NUNCA modificar archivos fuera del scope de la spec activa
- SIEMPRE leer la spec en openspec/changes/[feature-activa]/ antes de generar código
- Si hay ambigüedad en la spec, SEÑALARLA y ESPERAR instrucción. No improvisar.
- Los criterios de aceptación de la spec son los únicos criterios de éxito válidos
- Generar tests ANTES o JUNTO al código, nunca después

## MCPs activos
- Jira/Linear: para leer el contexto del ticket antes de /enrich_us
- GitHub: para leer PRs existentes y detectar patrones del equipo
- Context7: para documentación actualizada de las librerías del stack
```

### 5.2 `settings.json` — Configuración del agente

```json
{
  "model": "claude-opus-4-5",
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Read(**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Write(openspec/changes/**)",
      "Write(docs/**)"
    ],
    "deny": [
      "Write(openspec/specs/**)",
      "Write(.github/**)",
      "Write(.claude/**)",
      "Bash(git push:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/check-spec-exists.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/log-changes.js"
          }
        ]
      }
    ]
  }
}
```

> **Nota sobre permisos**: El agente tiene permisos de escritura restringidos. No puede modificar la spec de sistema (`openspec/specs/`) sin acción explícita del Tech Lead, y no puede hacer push directamente al repositorio.

### 5.3 Comandos del ciclo SDD

Cada fichero en `.claude/commands/` define un comando personalizado que el agente ejecuta cuando se le invoca con `/nombre-comando`.

#### `.claude/commands/enrich_us.md`

```markdown
# /enrich_us — Enriquecer User Story

## Objetivo
Analizar la user story proporcionada, detectar ambigüedades, formular las preguntas
que nadie ha hecho, y producir una Refined User Story con el contexto técnico
necesario para especificar bien.

## Instrucciones al agente
1. Lee la user story del issue de GitHub/Jira indicado
2. Analiza: ¿qué está implícito? ¿qué edge cases no están cubiertos?
3. Revisa la spec de sistema en openspec/specs/system.md para contexto
4. Revisa los dominios afectados en openspec/specs/[dominio]/spec.md
5. Formula TODAS las preguntas de clarificación necesarias
6. Produce una Refined User Story con:
   - Objetivo de negocio medible
   - Usuarios afectados
   - Comportamientos esperados (happy path + edge cases)
   - Restricciones técnicas identificadas
   - Dependencias con otros módulos
7. Guarda en openspec/changes/[TICKET-ID]-[descripcion]/proposal.md (draft)

## Formato de salida
Archivo Markdown estructurado. Ver plantilla en openspec/templates/refined-user-story.md

## Regla de oro
Este es el paso más infrautilizado y el más valioso.
El 80% de los fallos en SDD ocurren por saltárselo.
```

#### `.claude/commands/apply.md`

```markdown
# /apply — Ejecutar el contrato

## Objetivo
Ejecutar la spec activa sin improvisar. Generar en paralelo:
branch, tests, código, documentación y testing report.

## Instrucciones al agente
1. Lee COMPLETAMENTE openspec/changes/[feature-activa]/proposal.md
2. Lee openspec/changes/[feature-activa]/tasks.md
3. Lee openspec/specs/system.md y los dominios afectados
4. Para cada tarea de tasks.md, en orden:
   a. Genera los tests primero (TDD)
   b. Genera el código que hace pasar los tests
   c. Verifica que no se modifica nada fuera del scope de Restricciones
5. Al finalizar, genera:
   - Testing report en openspec/changes/[feature-activa]/testing-report.md
   - Actualización de proposal en openspec/changes/[feature-activa]/proposal-update.md

## Regla crítica
Si encuentras ambigüedad en la spec → DETENTE → señala el problema → espera instrucción.
NUNCA improvises fuera de la spec. NUNCA modifiques módulos no listados en Restricciones.

## Criterio de completitud
La feature está completa cuando TODOS los criterios de aceptación de proposal.md
tienen al menos un test que los valida y ese test pasa.
```

#### `.claude/commands/code-review.md`

```markdown
# /code-review — Revisión automática contra spec

## Objetivo
Hacer una primera revisión del código generado contra la spec,
detectar inconsistencias y resolverlas antes de que llegue al revisor humano.

## Qué valida el agente
✅ Cada criterio de aceptación tiene un test que lo cubre
✅ El código no modifica módulos marcados como "sin tocar" en Restricciones
✅ Nombres, patrones y convenciones siguen la spec de sistema
✅ Todos los casos de error definidos en la spec tienen manejo explícito
✅ La estructura de ficheros sigue la definida en el proyecto
✅ Los imports no introducen dependencias no previstas en la spec

## Qué NO puede validar el agente (requiere revisión humana)
❌ Si el criterio de aceptación captura correctamente la necesidad de negocio
❌ Si la restricción técnica era la correcta en primer lugar
❌ Si la arquitectura elegida es la más adecuada
❌ Si existen casos de error que la spec no contemplaba

## Formato de salida
Reporte en openspec/changes/[feature-activa]/code-review-report.md con:
- Lista de criterios verificados (✅/❌)
- Issues encontrados con referencia exacta a línea de código
- Sugerencias de corrección
- Veredicto: LISTO PARA PR HUMANO / REQUIERE CORRECCIONES
```

---

## 6. Configuración de `.github`

### 6.1 `PULL_REQUEST_TEMPLATE.md`

```markdown
## Referencia a spec

- **Ticket**: [PROJ-XXXX](link-al-ticket)
- **Spec activa**: `openspec/changes/PROJ-XXXX-[descripcion]/proposal.md`
- **Rama**: `PROJ-XXXX-[descripcion]`

## Criterios de aceptación verificados

<!-- Copia los criterios de aceptación de tu proposal.md y marca los verificados -->

- [ ] [Criterio 1 de la spec]
- [ ] [Criterio 2 de la spec]
- [ ] [Criterio N de la spec]

## Artefactos generados por el ciclo SDD

- [ ] Tests unitarios cubren todos los criterios de aceptación
- [ ] Tests E2E cubren los flujos principales
- [ ] `/code-review` automático ejecutado — ver `code-review-report.md`
- [ ] Documentación actualizada
- [ ] ADRs registrados en la spec si se tomaron decisiones de arquitectura

## Cambios fuera de scope

<!-- Si hay cambios no contemplados en la spec, explica por qué y actualiza la spec -->

Ninguno / [Descripción del cambio y spec actualizada]

## Checklist del revisor humano

- [ ] Los criterios de aceptación en el PR coinciden con los de la spec en el repo
- [ ] El código no toca módulos marcados como fuera de scope
- [ ] Los casos de error de la spec tienen manejo explícito en el código
- [ ] Los tests no solo pasan sino que validan el comportamiento correcto
```

### 6.2 GitHub Actions

#### `.github/workflows/spec-lint.yml`

```yaml
name: Spec Lint — Validar estructura de spec en PR

on:
  pull_request:
    paths:
      - 'openspec/changes/**'
      - 'src/**'
      - 'tests/**'

jobs:
  spec-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Verificar que el PR referencia una spec activa
        run: |
          # Extrae el ID del ticket del nombre de la rama
          BRANCH="${{ github.head_ref }}"
          TICKET_ID=$(echo "$BRANCH" | grep -oP '^[A-Z]+-\d+')
          
          if [ -z "$TICKET_ID" ]; then
            echo "❌ ERROR: La rama no sigue el formato TICKET-ID-descripcion"
            exit 1
          fi
          
          # Busca la carpeta de spec correspondiente
          SPEC_DIR=$(find openspec/changes -maxdepth 1 -type d -name "${TICKET_ID}*" | head -1)
          
          if [ -z "$SPEC_DIR" ]; then
            echo "❌ ERROR: No existe spec activa para el ticket $TICKET_ID"
            echo "Crea la spec antes de abrir el PR: openspec/changes/$TICKET_ID-descripcion/"
            exit 1
          fi
          
          echo "✅ Spec encontrada: $SPEC_DIR"

      - name: Verificar estructura mínima de la spec
        run: |
          BRANCH="${{ github.head_ref }}"
          TICKET_ID=$(echo "$BRANCH" | grep -oP '^[A-Z]+-\d+')
          SPEC_DIR=$(find openspec/changes -maxdepth 1 -type d -name "${TICKET_ID}*" | head -1)
          
          REQUIRED_FILES=("proposal.md" "tasks.md" "OWNER.md")
          
          for FILE in "${REQUIRED_FILES[@]}"; do
            if [ ! -f "$SPEC_DIR/$FILE" ]; then
              echo "❌ ERROR: Falta $FILE en $SPEC_DIR"
              exit 1
            fi
          done
          
          echo "✅ Estructura de spec válida"

      - name: Verificar criterios de aceptación en proposal.md
        run: |
          BRANCH="${{ github.head_ref }}"
          TICKET_ID=$(echo "$BRANCH" | grep -oP '^[A-Z]+-\d+')
          SPEC_DIR=$(find openspec/changes -maxdepth 1 -type d -name "${TICKET_ID}*" | head -1)
          
          # Verifica que existan criterios de aceptación (sección ## Criterios)
          if ! grep -q "## Criterios de aceptación" "$SPEC_DIR/proposal.md"; then
            echo "❌ ERROR: proposal.md no tiene sección '## Criterios de aceptación'"
            exit 1
          fi
          
          # Verifica que existan casos de error (sección ## Casos de error)
          if ! grep -q "## Casos de error" "$SPEC_DIR/proposal.md"; then
            echo "❌ ERROR: proposal.md no tiene sección '## Casos de error'"
            echo "Una spec sin casos de error es una spec a medias."
            exit 1
          fi
          
          echo "✅ Secciones obligatorias presentes en proposal.md"
```

#### `.github/workflows/archive-cleanup.yml`

```yaml
name: Alerta de Proposals Obsoletas

on:
  schedule:
    - cron: '0 9 * * 1'  # Cada lunes a las 9:00

jobs:
  check-stale-proposals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detectar proposals con más de 14 días sin actividad
        run: |
          STALE_PROPOSALS=()
          
          for DIR in openspec/changes/*/; do
            if [ -d "$DIR" ]; then
              # Última fecha de modificación de cualquier archivo en la carpeta
              LAST_MODIFIED=$(git log -1 --format="%ci" -- "$DIR" 2>/dev/null)
              
              if [ -n "$LAST_MODIFIED" ]; then
                DAYS_AGO=$(( ($(date +%s) - $(date -d "$LAST_MODIFIED" +%s)) / 86400 ))
                
                if [ $DAYS_AGO -gt 14 ]; then
                  OWNER_FILE="$DIR/OWNER.md"
                  OWNER="desconocido"
                  if [ -f "$OWNER_FILE" ]; then
                    OWNER=$(grep -m1 "Developer:" "$OWNER_FILE" | sed 's/Developer: //')
                  fi
                  STALE_PROPOSALS+=("$DIR (${DAYS_AGO} días, owner: $OWNER)")
                fi
              fi
            fi
          done
          
          if [ ${#STALE_PROPOSALS[@]} -gt 0 ]; then
            echo "⚠️ PROPOSALS OBSOLETAS DETECTADAS (>14 días sin actividad):"
            for PROP in "${STALE_PROPOSALS[@]}"; do
              echo "  - $PROP"
            done
            echo ""
            echo "Acción requerida: archivar, eliminar o retomar estas proposals."
            # En producción, aquí se puede crear un issue automáticamente
            # o notificar por Slack/email
          else
            echo "✅ No hay proposals obsoletas."
          fi
```

#### `.github/workflows/pr-spec-coverage.yml`

```yaml
name: Verificar cobertura de criterios de aceptación

on:
  pull_request:
    paths:
      - 'tests/**'
      - 'src/**'

jobs:
  spec-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Verificar que existe code-review-report.md
        run: |
          BRANCH="${{ github.head_ref }}"
          TICKET_ID=$(echo "$BRANCH" | grep -oP '^[A-Z]+-\d+')
          SPEC_DIR=$(find openspec/changes -maxdepth 1 -type d -name "${TICKET_ID}*" | head -1)
          
          if [ -z "$SPEC_DIR" ]; then
            echo "⚠️ No se encontró spec activa. Omitiendo verificación."
            exit 0
          fi
          
          if [ ! -f "$SPEC_DIR/code-review-report.md" ]; then
            echo "❌ ERROR: Falta el reporte de /code-review automático"
            echo "Ejecuta /code-review antes de abrir el PR"
            exit 1
          fi
          
          # Verifica que el veredicto sea positivo
          if grep -q "REQUIERE CORRECCIONES" "$SPEC_DIR/code-review-report.md"; then
            echo "❌ ERROR: El /code-review automático encontró problemas sin resolver"
            cat "$SPEC_DIR/code-review-report.md"
            exit 1
          fi
          
          echo "✅ Code review automático aprobado"
```

### 6.3 `ISSUE_TEMPLATE/user-story.md`

```markdown
---
name: User Story
about: Template para user stories que serán procesadas con /enrich_us
title: '[US] '
labels: 'user-story, needs-enrichment'
assignees: ''
---

## Historia de usuario

**Como** [tipo de usuario]
**quiero** [acción o funcionalidad]
**para** [objetivo de negocio o valor esperado]

## Contexto de negocio

<!-- ¿Por qué es importante esto ahora? ¿Qué problema resuelve? -->

## Criterios de aceptación iniciales (borrador)

<!-- Estos serán enriquecidos por /enrich_us antes de generar la spec -->

- Dado [contexto], cuando [acción], entonces [resultado esperado]

## Restricciones conocidas

<!-- Qué NO debe hacer esta feature, qué no debe tocar -->

## Prioridad y deadline

- **Prioridad**: Alta / Media / Baja
- **Deadline**: [fecha o sprint]

---
> Esta user story será procesada con `/enrich_us` antes de generar la spec técnica.
> No abrir el PR de implementación sin spec aprobada en `openspec/changes/`.
```

---

## 7. El ciclo OpenSpec: Proposal → Apply → Archive

El flujo completo de desarrollo con SDD se estructura así:

```
User Story (GitHub Issue)
        │
        ▼
  /enrich_us ──────────────────────────────────────────────┐
        │                                                   │
        ▼                                              Preguntas de
  Refined User Story                                  clarificación
        │                                            al PM / negocio
        ▼
  /new + /ff
        │
        ▼
  Proposal Artifacts
  (proposal.md, design.md, tasks.md)
        │
        │  ◄── Revisión humana obligatoria aquí
        │      (PM valida criterios de aceptación)
        ▼
  /apply
        │
        ▼
  Artefactos generados en paralelo:
  ┌─────────────────────────────────┐
  │  Branch    Test    Code         │
  │  Docs      Testing Report       │
  │  Proposal Update                │
  └─────────────────────────────────┘
        │
        ▼
  /code-review ─────────────────────┐
        │                           │
        │  Issues encontrados       │
        │  ───────────────────►     │
        │                    Corrección
        ▼                    en el mismo ciclo
  /commit
        │
        ▼
  Feature For PR
  (PR abierto con template completo)
        │
        │  ◄── Code review HUMANO aquí
        │      (contra la spec, no contra intuición)
        ▼
  /verify + /archive
        │
        ▼
  Feature Published
  (spec integrada en openspec/specs/)
```

### Estados y transiciones

| Estado | Ubicación | Acción siguiente |
|---|---|---|
| User Story | GitHub Issue | `/enrich_us` |
| Refined User Story | `openspec/changes/[ticket]/proposal.md` (draft) | `/new + /ff` |
| Proposal Artifacts | `openspec/changes/[ticket]/` (completo) | Revisión humana |
| Feature For PR | Rama + PR abierto | Code review humano |
| Feature Ready | PR aprobado | `/verify + /archive` |
| Feature Published | `openspec/specs/[dominio]/spec.md` actualizado | Siguiente ciclo |

---

## 8. Context Engineering: construir el contexto compartido

El contexto no es un documento que escribes una vez. Es un sistema vivo. Estos son los ficheros que lo componen y cómo mantenerlos:

### Jerarquía de contexto

```
Nivel 1: Spec de sistema (openspec/specs/system.md)
         Define la arquitectura, convenciones globales, modelo de datos.
         Actualizada por Tech Lead / CTO.
         Referenciada al inicio de cada sesión del agente.
         
Nivel 2: Specs de dominio (openspec/specs/[dominio]/spec.md)
         Define el comportamiento específico de cada módulo.
         Actualizada con cada feature archivada.
         Referenciada cuando el agente toca ese dominio.
         
Nivel 3: Spec de feature activa (openspec/changes/[ticket]/proposal.md)
         Define exactamente qué construir ahora.
         Escrita antes de ejecutar /apply.
         Referenciada durante todo el ciclo de la feature.
```

### El flywheel que lo cambia todo

```
Feature completada con SDD
         │
         ▼
Documentación generada automáticamente
         │
         ▼
Se integra en openspec/specs/ al archivar
         │
         ▼
Contexto disponible para la siguiente feature
         │
         ▼
La siguiente spec puede referenciar decisiones anteriores
         │
         ▼
Cada iteración → el sistema se vuelve más preciso ──► (vuelve al inicio)
```

### Comparativa: sin vs con Context Engineering

| Dimensión | Sin contexto compartido | Con Context Engineering |
|---|---|---|
| Consistencia | Cada developer usa su estilo y reglas | Mismo output independientemente de quién escribe el prompt |
| Coherencia | La IA propone soluciones que rompen la arquitectura | Nuevas features encajan con decisiones ya tomadas |
| Independencia del prompt | La calidad depende del seniority | El contexto compensa instrucciones imprecisas |
| Independencia del seniority | Un junior genera código fuera de los patrones | Un junior genera código con patrones de senior desde el día 1 |

---

## 9. Estructura de una spec de feature

Una buena spec no es un documento de 50 páginas. Es un contrato estructurado en Markdown que incluye exactamente lo necesario.

### Plantilla: `openspec/changes/[TICKET-ID]-[descripcion]/proposal.md`

```markdown
# Spec: [Nombre de la Feature]

**Ticket**: [PROJ-XXXX](link)
**Rama**: `PROJ-XXXX-[descripcion]`
**Developer**: @[username]
**Fecha inicio**: YYYY-MM-DD
**Estado**: DRAFT / APROBADA / EN EJECUCIÓN / COMPLETADA

---

## Objetivo

<!-- ¿Por qué lo hacemos? Objetivo de negocio medible. -->
Reducir el tiempo de revisión de candidatos un 40% eliminando la navegación
manual entre perfiles.

## Capacidades

<!-- ¿Qué debe hacer el sistema? Lista de comportamientos esperados. -->
- El sistema permite filtrar candidatos por estado (activo / descartado / en proceso)
- El sistema permite ordenar la lista por score descendente
- Los filtros se aplican sin recargar la página

## Criterios de aceptación

<!-- Formato: Dado [contexto], cuando [acción], entonces [resultado]. -->
<!-- Estos son el contrato. Lo que no está aquí, no se implementa. -->

**AC-01**: Dado un recruiter con 50 candidatos, cuando filtra por estado "en proceso",
entonces solo ve los candidatos con ese estado y el contador se actualiza.

**AC-02**: Dado que no hay candidatos con el filtro aplicado, cuando el sistema devuelve
la lista vacía, entonces se muestra un estado vacío con CTA para limpiar filtros.

**AC-03**: Dado un recruiter, cuando aplica múltiples filtros simultáneos,
entonces la lista muestra solo candidatos que cumplen TODOS los filtros activos.

## Restricciones

<!-- ¿Qué NO puede hacer esta feature? Crítico para limitar el scope del agente. -->
- Sin modificar el modelo de datos existente de `candidates`
- Sin tocar la capa de servicios `CandidateService`
- Sin afectar el rendimiento en listas de más de 1.000 candidatos
- Solo modificar archivos en `src/candidates/components/` y `tests/candidates/`

## Decisiones técnicas

<!-- ¿Cómo lo hacemos? Decisiones ya tomadas que el agente debe respetar. -->
- PATCH en lugar de PUT para actualizaciones parciales de estado
- Filtrado en cliente para listas < 500 registros; server-side para listas mayores
- Usar el componente `FilterBar` existente como base, no crear uno nuevo

## Casos de error

<!-- ¿Qué pasa cuando algo falla? Una spec sin casos de error es una spec a medias. -->
- Si el API devuelve 500: mostrar banner de error no bloqueante (no modal)
- Si la lista está vacía tras filtrar: mostrar estado vacío con CTA para limpiar filtros
- Si el filtro seleccionado no existe en el backend: ignorar y loggear warning

## Dependencias

<!-- ¿Con qué otros módulos o sistemas interactúa esta feature? -->
- `CandidateList` component (solo lectura, no modificar)
- `GET /api/v1/positions/:id/candidates` (endpoint existente, añadir query params)
- No tiene dependencias con features en desarrollo concurrente

---

> **Regla de inmutabilidad**: Esta spec es inmutable una vez marcada como APROBADA.
> Los cambios posteriores generan nuevas specs. Ver gestión del cambio.
```

### Plantilla: `openspec/changes/[TICKET-ID]-[descripcion]/tasks.md`

```markdown
# Tareas — [Nombre de la Feature]

<!-- REGLA DE GRANULARIDAD:
     Una tarea está bien granularizada cuando puedes escribir su criterio
     de éxito en una sola frase.
     Si necesitas "y" o "además" para describirla, divídela. -->

## Orden de ejecución

### Tarea 1: Componente FilterBar con tests unitarios

**Scope**: `src/candidates/components/FilterBar.tsx`
**Tests**: `tests/candidates/FilterBar.test.tsx`

Crear componente FilterBar con props:
- `filters: FilterState`
- `onChange: (newFilters: FilterState) => void`

Tests unitarios requeridos:
- [ ] Renderiza correctamente con filtros vacíos
- [ ] Aplica filtro de estado correctamente
- [ ] Maneja múltiples filtros activos
- [ ] Llama a onChange con el estado correcto al seleccionar

**Criterio de éxito**: Todos los tests pasan. El componente no tiene lógica de negocio.

---

### Tarea 2: Integración en CandidateList

**Scope**: `src/candidates/components/CandidateList.tsx` (solo integración)
**Tests**: `tests/candidates/CandidateList.integration.test.tsx`

Integrar FilterBar en CandidateList.
Implementar lógica de filtrado: client-side si lista < 500, server-side si lista ≥ 500.

Tests de integración requeridos:
- [ ] FilterBar aparece sobre la lista de candidatos
- [ ] Filtrado client-side funciona con lista de 10 candidatos
- [ ] Filtrado server-side se activa con lista de 600 candidatos (mock)
- [ ] Estado vacío se muestra cuando no hay resultados

**Criterio de éxito**: AC-01, AC-02 y AC-03 de proposal.md verificados con tests.

---

### Tarea 3: Test E2E del flujo completo

**Scope**: `tests/e2e/candidate-filters.spec.ts`

Test E2E: dado recruiter autenticado en `/positions/123/candidates`,
cuando selecciona filtro "en proceso", entonces la URL incluye
`?status=in_progress` y la lista muestra solo candidatos con ese estado.

- [ ] Flujo completo de filtrado funciona end-to-end
- [ ] URL refleja filtros activos (permite compartir URL filtrada)
- [ ] Performance: lista de 1.000 candidatos carga en < 2s con filtro activo

**Criterio de éxito**: AC-01 verificado desde perspectiva de usuario real.

---

### Tarea 4: Documentación y ADR

**Scope**: `openspec/specs/candidates/spec.md` (delta), `docs/candidates/`

- [ ] Actualizar spec de dominio con decisión de filtrado client/server-side
- [ ] Añadir ejemplo de uso de FilterBar en Storybook bajo categoría 'Candidates'
- [ ] Registrar ADR-0042: decisión de filtrado client-side vs server-side

**Criterio de éxito**: Un developer nuevo puede entender la decisión técnica en < 5 minutos.
```

---

## 10. Comandos del ciclo completo

Referencia rápida de todos los comandos disponibles:

| Comando | Fase | Entrada | Salida |
|---|---|---|---|
| `/enrich_us [ticket-id]` | Enriquecer historia | ID del ticket en Jira/GitHub | Refined User Story en `proposal.md` (draft) |
| `/new [ticket-id] [descripcion]` | Crear spec | User Story enriquecida | Carpeta `openspec/changes/[ticket]/` con estructura |
| `/ff [ticket-id]` | Feature flags / spec inicial | Nombre de la feature | `tasks.md` inicial con granularidad correcta |
| `/apply [ticket-id]` | Ejecutar contrato | Spec aprobada en `proposal.md` | Branch + Tests + Code + Docs + Testing Report |
| `/code-review [ticket-id]` | Revisión contra spec | Código generado | `code-review-report.md` con veredicto |
| `/commit [ticket-id]` | Commit estructurado | Código revisado | Commit con Conventional Commits + referencia a spec |
| `/verify [ticket-id]` | Verificación final | PR aprobado por humano | Verificación de todos los criterios de aceptación |
| `/archive [ticket-id]` | Archivar spec | Feature verificada | Delta integrado en `openspec/specs/`, `changes/` limpio |

### Uso en sesión de Claude Code

```bash
# 1. Inicio del ciclo — desde la raíz del proyecto
/enrich_us PROJ-1234

# 2. Generar proposal artifacts
/new PROJ-1234 candidate-filters
/ff PROJ-1234

# [REVISIÓN HUMANA: PM aprueba criterios de aceptación]

# 3. Ejecutar la spec
/apply PROJ-1234

# 4. Revisión automática
/code-review PROJ-1234

# 5. Commit estructurado
/commit PROJ-1234

# [REVISIÓN HUMANA: Code review del PR]

# 6. Verificar y archivar
/verify PROJ-1234
/archive PROJ-1234
```

---

## 11. Integración con GitHub Actions

### Flujo completo integrado

```
Developer ejecuta /apply
         │
         ▼
Código generado en rama local
         │
         ▼
Developer ejecuta /code-review
         │
         ▼
Developer ejecuta /commit
(Conventional Commits + referencia a spec)
         │
         ▼
git push origin PROJ-XXXX-descripcion
         │
         ▼
GitHub Actions: spec-lint.yml
┌─────────────────────────────────────┐
│ ✅ Rama sigue formato TICKET-ID      │
│ ✅ Spec activa existe en openspec/   │
│ ✅ proposal.md tiene criterios       │
│ ✅ proposal.md tiene casos de error  │
│ ✅ code-review-report.md existe      │
│ ✅ Sin "REQUIERE CORRECCIONES"       │
└─────────────────────────────────────┘
         │
         ▼
PR creado con PULL_REQUEST_TEMPLATE.md
         │
         ▼
Revisor humano valida contra la spec
(no contra su intuición)
         │
         ▼
PR aprobado → /verify + /archive
         │
         ▼
GitHub Actions: archive-cleanup.yml
(monitoreo semanal de proposals obsoletas)
```

### CODEOWNERS por dominio

```
# .github/CODEOWNERS

# La spec de sistema requiere aprobación del Tech Lead
openspec/specs/system.md    @tech-lead @cto

# Specs de dominio — owners por módulo
openspec/specs/auth/        @auth-team-lead
openspec/specs/payments/    @payments-team-lead
openspec/specs/candidates/  @product-team-lead

# Configuración del agente — solo Tech Lead puede modificar
.claude/settings.json       @tech-lead
.claude/CLAUDE.md           @tech-lead

# Workflows de CI — DevOps
.github/workflows/          @devops-team
```

---

## 12. Gestión del cambio en specs activas

En SDD, el cambio no es un fallo del sistema. Es un ciudadano de primera clase con su propio proceso.

> **Regla de inmutabilidad**: Una spec es inmutable una vez marcada como APROBADA. Los cambios futuros generan nuevas specs. Nunca se editan specs archivadas.

### Tabla de decisión de cambios

| Situación | Protocolo correcto | Qué NO hacer |
|---|---|---|
| El requisito cambia antes de ejecutar `/apply` | Volver a `/enrich_us` con el cambio. Actualizar `proposal.md` antes de ejecutar. Cero código sobre spec obsoleta. | Ejecutar `/apply` con la spec anterior y "arreglar después" |
| El requisito cambia mientras `/apply` está en curso | Interrumpir la ejecución. Actualizar la spec. Relanzar `/apply` desde el punto de cambio. | Continuar la ejecución y parchear el output manualmente |
| Se descubre durante el desarrollo que una decisión técnica era incorrecta | Documentar el cambio en `proposal.md` (sección "Decisiones técnicas revisadas"). Actualizar spec de sistema si afecta patrones globales. | Cambiar el código sin actualizar la spec, creando divergencia |
| El cambio afecta features ya archivadas | Abrir nueva spec para el cambio. Nunca editar specs archivadas. | Editar specs archivadas, perdiendo trazabilidad histórica |

### Protocolo de cambio durante `/apply`

```bash
# 1. Detectado cambio de requisito durante ejecución
# Detener el agente

# 2. Actualizar la spec
# Editar openspec/changes/[ticket]/proposal.md
# Marcar qué cambió en la sección "Historial de cambios"

# 3. Actualizar tasks.md si las tareas se ven afectadas

# 4. Relanzar desde el punto de cambio
/apply PROJ-XXXX --from-task 3
# (o relanzar completo si el cambio afecta tareas anteriores)
```

---

## 13. Prácticas de equipo y convenciones de escala

### Para equipos pequeños (1-5 developers)

- Un `CLAUDE.md` a nivel de proyecto es suficiente
- El mismo developer puede hacer `/enrich_us`, `/apply` y `/verify`
- La spec de sistema se revisa mensualmente o ante cada decisión de arquitectura
- Usar git worktrees para features concurrentes

### Para equipos medianos (5-20 developers)

- Agregar specs de dominio separadas por equipo funcional
- El Tech Lead valida todos los `proposal.md` antes de `/apply`
- Activar todos los GitHub Actions del manual
- Revisión quincenal de `openspec/changes/` para detectar proposals obsoletas

### Para equipos grandes (20+ developers / enterprise)

- Monorepo con `openspec/` como ciudadano de primera clase
- CODEOWNERS granular por dominio
- TTL de 14 días máximo para proposals activas (alerta automática en CI)
- Naming de changes con prefijo de equipo: `TEAM-PROJ-1234-descripcion`
- `OWNER.md` obligatorio en cada carpeta de `changes/`
- Spec de sistema versionada semánticamente (v1.0, v1.1...)
- Integración MCP con Jira/Linear para que el agente lea el contexto del ticket

### Convenciones de naming

```
# Branches
PROJ-1234-nombre-feature-en-kebab-case

# Carpetas en openspec/changes/
PROJ-1234-nombre-feature-en-kebab-case/

# Commits (Conventional Commits)
feat(candidates): add filter bar component [PROJ-1234]
test(candidates): add unit tests for FilterBar [PROJ-1234]
docs(candidates): update ADR for client-side filtering [PROJ-1234]
fix(candidates): handle empty filter state correctly [PROJ-1234]

# ADRs en specs
ADR-[número]-descripcion-de-la-decision.md
```

### Git worktrees para features concurrentes

```bash
# Crear un worktree por feature activa
git worktree add ../proyecto-PROJ-1234 -b PROJ-1234-candidate-filters
git worktree add ../proyecto-PROJ-1235 -b PROJ-1235-bulk-export

# Cada worktree tiene su propio contexto activo
# Claude Code en cada worktree lee la spec correspondiente
# No hay interferencia entre features concurrentes
```

---

## 14. Checklist de adopción por fases

### Fase 0: Preparación (1-2 días)

- [ ] Crear estructura `.claude/` con `CLAUDE.md` completo
- [ ] Crear estructura `.github/` con templates y workflows básicos
- [ ] Crear estructura `openspec/` con `specs/system.md` inicial
- [ ] Configurar `settings.json` con permisos restrictivos
- [ ] Instalar MCPs: Jira/Linear + Context7 (mínimo)
- [ ] Comunicar al equipo el nuevo flujo y la regla de inmutabilidad de specs

### Fase 1: Primer ciclo piloto (1 semana)

- [ ] Elegir una feature de complejidad media (no trivial, no crítica)
- [ ] Ejecutar el ciclo completo: `/enrich_us` → `/apply` → `/archive`
- [ ] Documentar fricción y ajustar comandos en `.claude/commands/`
- [ ] Revisar la calidad del `proposal.md` generado vs. expectativas
- [ ] Ajustar `CLAUDE.md` con las convenciones que faltaban

### Fase 2: Estandarización del equipo (2-4 semanas)

- [ ] Todo el equipo ejecuta al menos 2 ciclos completos
- [ ] Activar todos los GitHub Actions del manual
- [ ] Configurar CODEOWNERS
- [ ] Primera revisión de `openspec/specs/system.md` en equipo
- [ ] Establecer cadencia de revisión de proposals obsoletas

### Fase 3: Optimización continua (ongoing)

- [ ] Medir: tiempo medio de revisión de PR (debe bajar)
- [ ] Medir: tasa de rechazo en QA (debe bajar)
- [ ] Medir: bugs en producción por feature (debe bajar)
- [ ] Refinar granularidad de tareas según aprendizajes del equipo
- [ ] Expandir specs de dominio con cada feature archivada
- [ ] Incorporar análisis preventivo de seguridad en `/code-review`

---

## Apéndice: Señales de que el sistema está funcionando

✅ El revisor humano llega al PR con criterios claros (la spec) en lugar de su intuición  
✅ Los comentarios de PR son "esto no cumple el criterio AC-03" en lugar de "esto no era lo que pedí"  
✅ Los developers junior generan código con patrones de senior desde el primer commit  
✅ Los cambios de requisito tienen un proceso claro y no generan pánico  
✅ La documentación técnica siempre está actualizada (se genera automáticamente)  
✅ Cada commit puede trazarse hasta el requisito exacto que lo originó  
✅ La IA no improvisa: señala las ambigüedades y espera instrucción  

## Apéndice: Señales de que algo falla

⚠️ Los agents siguen improvisando → las tareas en `tasks.md` son demasiado vagas  
⚠️ El code review tarda días → el PM no validó los criterios de aceptación antes de `/apply`  
⚠️ La spec y el código divergen → alguien modificó código sin actualizar la spec primero  
⚠️ El contexto se pierde entre sesiones → `CLAUDE.md` está incompleto  
⚠️ Cada developer tiene un flujo distinto → los comandos en `.claude/commands/` no son la norma del equipo  

---

*Manual basado en el Agentic Engineer Playbook 2026 — LIDR.co*  
*Framework OpenSpec: github.com/Fission-AI/OpenSpec*  
*AI Assessment: ai-assessment.lidr.co/es*
