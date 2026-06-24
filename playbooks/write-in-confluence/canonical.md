---
slug: write-in-confluence
title_en: "Write in Confluence — Operational guides for the platform"
title_es: "Guía operacional en Confluence"
description: "Draft an operational guide about a platform feature and publish it to Confluence. Targets internal teams (Operations, Support) — not technical IT documentation. Style is a user manual: clear, step-by-step, with screenshot placeholders when the user provides images. Activate when the user says \"write-in-confluence\" or asks to document a procedure or platform feature for the operations team in Confluence."
when_es: "Cuando necesitas redactar una guía operacional sobre una funcionalidad de la plataforma y publicarla en Confluence para el equipo interno (Operaciones, Soporte)."
---

## Purpose

Draft an operational guide about a platform feature and publish it to Confluence. Targets internal teams (Operations, Support) — not technical documentation for IT.

Style is a user manual: clear, direct, with numbered steps in imperative voice and screenshot placeholders when the user provides images.

<!-- END_SKILL -->

## Objetivo

Redactar una guía operacional sobre una funcionalidad de la plataforma y publicarla en Confluence.
El documento está dirigido al equipo interno (Operaciones, Soporte, etc.) — **no es documentación técnica para TI**.
El estilo es el de un manual de uso: claro, directo, con pasos numerados y capturas de pantalla si las hay.

## Instrucciones

### Paso 1 — Obtener cloudId

Llama a `getAccessibleAtlassianResources` para obtener el `cloudId` del sitio Atlassian activo.

### Paso 2 — Preguntar acción

Usa `AskUserQuestion` con:
- **"¿Qué deseas hacer?"** → opciones: `Crear nueva página` / `Actualizar página existente`

### Paso 3 — Recopilar información del procedimiento

Antes de redactar, haz estas dos preguntas al usuario **en el mismo mensaje**, una seguida de la otra:

1. **"Explícame el flujo de lo que quieres documentar: ¿qué hace el usuario paso a paso? ¿cuándo aplica este procedimiento? ¿hay algo importante a tener en cuenta?"**

2. **"¿Tienes capturas de pantalla para incluir? Si las tienes, compártelas directamente en el chat."**

Si el usuario comparte imágenes:
- Analiza cada imagen y describe brevemente lo que muestra
- Al redactar el documento, marca con `[CAPTURA: descripción breve]` el lugar exacto donde debe ir cada imagen, en el orden que corresponda al flujo
- Al finalizar, indica al usuario: *"Las capturas marcadas como [CAPTURA: ...] debes subirlas manualmente en Confluence: edita la página, posiciona el cursor en el marcador y usa Insertar → Imagen."*

Si el usuario no tiene capturas, redacta el documento igualmente sin placeholders.

### Paso 4 — Elegir espacio

1. Lista los espacios con `searchConfluenceUsingCql` usando query `type = "space"`.
   **No usar `getConfluenceSpaces`** — no devuelve todos los espacios del sitio.
2. Presenta los espacios con `AskUserQuestion` mostrando nombre y key.

### Paso 5A — Flujo: Crear nueva página

1. Redacta el contenido (ver **Estructura del documento** abajo).
2. Publica con `createConfluencePage` en el espacio elegido.
3. Confirma con el título y link directo a la página.

### Paso 5B — Flujo: Actualizar página existente

1. Lista páginas del espacio con `searchConfluenceUsingCql`: `space.key = "KEY" AND type = "page" ORDER BY lastmodified DESC`.
2. Presenta las páginas con `AskUserQuestion` para que el usuario elija cuál actualizar.
3. Lee el contenido actual con `getConfluencePage`.
4. Incorpora la información nueva sin eliminar contenido existente relevante.
5. Actualiza con `updateConfluencePage` usando `version.number + 1`.
6. Confirma con el link directo a la página.

---

### Estructura estándar del documento operacional

Seguir esta estructura en todas las páginas. Está basada en las guías existentes del espacio Wiki Plataforma.

#### Título

Patrón: `[Tipo] · [Nombre descriptivo de la funcionalidad o procedimiento]`

El `·` es un punto medio (no guión). Tipos habituales:
- `Funcionalidad · [Nombre]` — para documentar cómo usar una feature de la plataforma
- `Procedimiento · [Nombre]` — para documentar una acción administrativa o de soporte
- `Soporte · [Nombre]` — para guías de soporte interno o integraciones con herramientas externas

#### Secciones (en este orden)

**1. `## ¿Qué es [nombre]?`**
Una o dos frases que expliquen qué hace esta funcionalidad y cuál es su valor para el usuario.

**2. `## ¿Cuándo aplica este procedimiento?`**
En qué situación se usa. Si hay un requisito previo obligatorio, mencionarlo explícitamente con **Requisito previo:**.

**3. `## Paso N — [Nombre de la acción]`** (repetir por cada paso)
Cada paso es un H2. Dentro del paso:
- Sub-pasos numerados con verbo en imperativo y voseo (Ingresá, Hacé clic, Verificá, Seleccioná).
- Usa **negrita** para nombres de botones, secciones de la UI y términos clave.
- Si hay una nota importante dentro del paso (ej: acción irreversible, comportamiento especial), agrégala como párrafo en cursiva o con prefijo **Importante:**.
- Si hay captura para ese paso, insertar el marcador `[CAPTURA: descripción breve de lo que muestra]` justo después del sub-paso correspondiente.

**4. `## ¿Cómo se calcula / ¿Cómo funciona [aspecto técnico o lógica interna]?`** *(si aplica)*
Sección opcional para explicar la lógica detrás de la funcionalidad. Usar tabla cuando hay dimensiones, criterios o categorías:
| Dimensión / Campo | Qué evalúa / Qué significa |
| --- | --- |

**5. `## Preguntas frecuentes`** *(si aplica)*
Formato pregunta en negrita + respuesta en párrafo. Anticipar dudas reales del equipo de operaciones.

**6. Secciones adicionales si el flujo lo requiere:**
- `## Notificaciones` — si el sistema envía emails o alertas automáticas
- `## Estados posibles` — tabla de estados con descripción
- `## ¿Dónde llega?` / `## ¿Qué sucede después?` — si genera algo en Asana, email, otra herramienta

#### Reglas de estilo

- **Idioma**: español con voseo rioplatense (usá, hacé, ingresá, verificá).
- **Tono**: directo, sin tecnicismos. Para alguien del equipo de Operaciones, no un desarrollador.
- **Negritas**: nombres de botones, secciones de UI, términos clave de la plataforma.
- **Sin referencias a la sesión**: escribir como si el lector nunca participó en el desarrollo ni en la conversación.

## Criterio de bloqueo

Si `getAccessibleAtlassianResources` no devuelve recursos, informa al usuario que debe autenticarse con el MCP de Atlassian ejecutando `/mcp` y seleccionando "claude.ai Atlassian".
