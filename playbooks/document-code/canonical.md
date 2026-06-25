---
slug: document-code
title_es: "Documentación técnica de código en Confluence"
when_es: "Cuando necesitas documentar código del proyecto (entidad, servicio, controlador o componente frontend) en Confluence."
---

## Objetivo

Leer código fuente del proyecto, generar documentación técnica estructurada en inglés y publicarla en Confluence.
El documento está dirigido a desarrolladores y será usado como contexto para un MCP que asiste en la construcción de nuevas funcionalidades.

## Instrucciones

### Paso 1 — Obtener cloudId

Llama a `getAccessibleAtlassianResources` para obtener el `cloudId` del sitio Atlassian activo.

### Paso 2 — Preguntar acción

Usa `AskUserQuestion` con:
- **"¿Qué deseas hacer?"** → opciones: `Crear nueva página` / `Actualizar página existente` / `Crear subpágina` / `Actualizar subpágina existente` / `Documentar todas las entidades (batch)`

> Si el usuario elige **"Documentar todas las entidades (batch)"**, saltar directamente al **Paso 3B**. No ejecutar el Paso 3.

### Paso 3 — Identificar qué documentar *(solo para acciones que NO son batch)*

Usa `AskUserQuestion` con dos preguntas en el mismo mensaje:

1. **"¿Qué tipo de código vas a documentar?"** → opciones: `Entidad / Base de datos` / `Backend (Service, Controller, Repository)` / `Frontend (componente JS o Twig)`

2. **"¿Qué archivo o componente querés documentar? Indicá la ruta relativa o el nombre de la clase."**
   (Si ya viene como argumento del comando, omitir esta pregunta y usar el argumento.)

Una vez obtenida la respuesta, **lee el archivo con la herramienta Read** antes de redactar. Si el usuario indica una clase o módulo sin ruta exacta, búscalo primero con Bash (`find` o `grep`). No documentes de memoria — siempre leer el código fuente actual.

### Paso 3B — Solo si la acción es "Documentar todas las entidades (batch)": Configurar batch

#### 3B.1 — Obtener configuración del proyecto

Usa `AskUserQuestion` con las siguientes preguntas **en el mismo mensaje**:

1. **"¿Cuál es la ruta base de tus entidades?"** — indicá la ruta relativa desde la raíz del proyecto. Ejemplo: `src/Entity`, `app/Models`, `src/Collab/BackendBundle/Entity`. Guardá el resultado como `ENTITIES_PATH`.

2. **"¿Qué extensión tienen los archivos de entidades?"** → opciones: `.php` / `.ts` / `.java` / `.py` / Otra

3. **"¿Qué ORM usa tu proyecto?"** → opciones: `Doctrine ORM (PHP)` / `TypeORM (Node.js)` / `Eloquent (Laravel)` / `Otro / no aplica`

Guardá las respuestas como `ENTITIES_PATH`, `FILE_EXT` y `ORM_TYPE`. El directorio base para búsqueda de referencias (`SRC_BASE`) se deriva automáticamente como el directorio padre de `ENTITIES_PATH` (ej: `src/Collab/BackendBundle/Entity` → `SRC_BASE = src/Collab/BackendBundle`).

#### 3B.2 — Listar entidades

1. Lista todas las entidades disponibles con Bash, usando los valores obtenidos:
   ```bash
   find [ENTITIES_PATH] -maxdepth 1 -name "*[FILE_EXT]" | sort | xargs -I{} basename {} [FILE_EXT]
   ```
   Filtra del resultado las clases abstractas e interfaces (grep `abstract class` o `interface ` dentro del archivo).

2. Muestra el total de entidades encontradas al usuario.

3. Pregunta con `AskUserQuestion`:
   - **"¿Querés filtrar por prefijo o patrón de nombre?"** → opciones: `Sin filtro (todas)` / `Indicaré un patrón`
   - **"¿Hay entidades que desees excluir? Indicá los nombres separados por coma (ej: LogEntry, AuditLog). Dejá en blanco si no."**

4. Si el usuario indicó un patrón, filtra la lista de entidades aplicando el patrón (substring match sobre el nombre de clase).
   Si indicó exclusiones, elimínalas de la lista final.

5. Muestra el listado final con el total de entidades a procesar y pide confirmación antes de continuar:
   **"Se van a crear N subpáginas en Confluence. ¿Confirmás?"** → opciones: `Confirmar` / `Cancelar`
   Si el usuario cancela, detener el proceso.

### Paso 4 — Elegir espacio

1. Lista los espacios con `searchConfluenceUsingCql` usando query `type = "space"`.
   **No usar `getConfluenceSpaces`** — no devuelve todos los espacios del sitio.
2. Presenta los espacios con `AskUserQuestion` mostrando nombre y key.

### Paso 4B — Solo si la acción es "Crear subpágina", "Actualizar subpágina existente" o "Documentar todas las entidades (batch)": Elegir página padre

1. Lista las páginas del espacio con `searchConfluenceUsingCql`: `space.key = "KEY" AND type = "page" AND ancestor = null AND status = "current" ORDER BY title ASC`
   Esto devuelve únicamente las páginas de nivel raíz publicadas (sin padre, sin archivadas) del espacio.
   Si la query anterior no devuelve resultados, usar: `space.key = "KEY" AND type = "page" AND status = "current" ORDER BY title ASC` y tomar las que tengan depth = 0 o sean de nivel superior.
2. Presenta las páginas padre disponibles con `AskUserQuestion` para que el usuario elija la página padre.
   Para el modo batch, indicar al usuario que las subpáginas se crearán bajo la página seleccionada (ej: "Modelo de Datos · Backend Entities").
3. Guarda el `id` de la página seleccionada como `parentPageId` para usarlo en el Paso 5C, 5D o 5E según corresponda.

### Paso 4C — Solo si el tipo es "Entidad / Base de datos": Analizar impacto

> Si `ORM_TYPE` es `Otro / no aplica`, saltar este paso y omitir la sección `## Impact Level` del documento.

Para flujos **batch**: usa `ENTITIES_PATH`, `FILE_EXT` y `SRC_BASE` obtenidos en el Paso 3B.
Para flujos **no-batch**: `ENTITIES_PATH` es el directorio del archivo indicado por el usuario en el Paso 3; `FILE_EXT` se deriva de la extensión del archivo leído; `SRC_BASE` es el directorio padre de `ENTITIES_PATH`.

Antes de redactar, mide el nivel de impacto/relevancia de la entidad ejecutando los siguientes análisis con Bash:

**a) Contar relaciones directas en la entidad:**
```bash
# Doctrine ORM (PHP — annotations o attributes):
grep -cE "@ORM\\(OneToMany|ManyToOne|ManyToMany|OneToOne)|#\[ORM\\(OneToMany|ManyToOne|ManyToMany|OneToOne)" [ENTITIES_PATH]/[EntityName][FILE_EXT]
# TypeORM (TypeScript — decoradores):
grep -cE "@(OneToMany|ManyToOne|ManyToMany|OneToOne)\(" [ENTITIES_PATH]/[EntityName][FILE_EXT]
```
Usá el patrón correspondiente a `ORM_TYPE`.

**b) Contar referencias en servicios:**
```bash
grep -rl "[EntityClassName]" [SRC_BASE]/Service/ | wc -l
```
Si el directorio `Service/` no existe bajo `SRC_BASE`, buscar en `Services/` o adaptar al nombre real de la carpeta.

**c) Contar referencias en repositorios:**
```bash
grep -rl "[EntityClassName]" [SRC_BASE]/Repository/ | wc -l
```
Si el directorio `Repository/` no existe, adaptar al nombre real.

**d) Contar referencias en controladores:**
```bash
grep -rl "[EntityClassName]" [SRC_BASE] --include="*Controller[FILE_EXT]" | wc -l
```

Con los totales obtenidos, determina el nivel de impacto según esta escala:

| Nivel | Criterio |
|---|---|
| **High** | ≥ 5 relaciones ORM **o** referenciada en ≥ 5 servicios **o** referencias totales ≥ 15 |
| **Medium** | 2–4 relaciones ORM **o** referenciada en 2–4 servicios **o** referencias totales 5–14 |
| **Low** | ≤ 1 relación ORM **y** referenciada en ≤ 1 servicio **y** referencias totales ≤ 4 |

Incluye el nivel de impacto calculado en la sección `## Impact Level` del documento (ver estructura Tipo A).

---

### Paso 5A — Flujo: Crear nueva página

1. Redacta el contenido en inglés según la estructura del tipo elegido (ver más abajo).
2. Publica con `createConfluencePage` en el espacio elegido (sin `parentId`).
3. Confirma con el título y link directo a la página.

### Paso 5B — Flujo: Actualizar página existente

1. Lista páginas del espacio con `searchConfluenceUsingCql`: `space.key = "KEY" AND type = "page" AND status = "current" ORDER BY lastmodified DESC`.
2. Presenta las páginas con `AskUserQuestion` para que el usuario elija cuál actualizar.
3. Lee el contenido actual con `getConfluencePage`.
4. Actualiza incorporando los cambios sin eliminar información existente vigente. Si un método o campo fue removido, eliminarlo de la doc.
5. Actualiza con `updateConfluencePage` usando `version.number + 1`.
6. Confirma con el link directo a la página.

### Paso 5C — Flujo: Crear subpágina

1. Redacta el contenido en inglés según la estructura del tipo elegido (ver más abajo).
2. Publica con `createConfluencePage` en el espacio elegido, pasando el `parentPageId` obtenido en el Paso 4B como campo `parentId`.
3. Confirma con el título, la página padre y el link directo a la subpágina creada.

### Paso 5D — Flujo: Actualizar subpágina existente

1. Lista las subpáginas bajo la página padre con `searchConfluenceUsingCql`: `ancestor = "PARENT_PAGE_ID" AND type = "page" AND space.key = "KEY" AND status = "current" ORDER BY title ASC`.
   Si no hay subpáginas, informar al usuario y sugerir usar "Crear subpágina" en su lugar.
2. Presenta las subpáginas encontradas con `AskUserQuestion` para que el usuario elija cuál actualizar.
3. Lee el contenido actual de la subpágina seleccionada con `getConfluencePage`.
4. Actualiza incorporando los cambios sin eliminar información existente vigente. Si un método o campo fue removido, eliminarlo de la doc.
5. Actualiza con `updateConfluencePage` usando `version.number + 1`.
6. Confirma con el título, la página padre y el link directo a la subpágina actualizada.

### Paso 5E — Flujo: Documentar todas las entidades (batch)

Para cada entidad de la lista final confirmada en el Paso 3B, ejecutar el siguiente ciclo en orden secuencial:

1. **Leer el archivo** con `Read`: `[ENTITIES_PATH]/[EntityName][FILE_EXT]`

2. **Analizar impacto** (Paso 4C aplicado a esta entidad, usando `ENTITIES_PATH`, `FILE_EXT`, `SRC_BASE` y `ORM_TYPE` obtenidos en 3B.1):
   ```bash
   # Usar el patrón de relaciones correspondiente a ORM_TYPE (ver Paso 4C):
   grep -cE "<patrón ORM>" [ENTITIES_PATH]/[EntityName][FILE_EXT]
   grep -rl "[EntityName]" [SRC_BASE]/Service/ | wc -l
   grep -rl "[EntityName]" [SRC_BASE]/Repository/ | wc -l
   grep -rl "[EntityName]" [SRC_BASE] --include="*Controller[FILE_EXT]" | wc -l
   ```

3. **Redactar el documento** en inglés según la estructura Tipo A completa.

4. **Verificar si ya existe** una subpágina con ese título bajo `parentPageId`:
   ```
   searchConfluenceUsingCql: title = "Entity · [EntityName]" AND ancestor = "PARENT_PAGE_ID" AND status = "current"
   ```
   - Si **no existe**: crear con `createConfluencePage` pasando `parentId = parentPageId`.
   - Si **ya existe**: actualizar con `updateConfluencePage` usando `version.number + 1`.

5. **Reportar progreso** tras cada entidad: `[N/Total] Entity · [EntityName] — ✓ creada / ✓ actualizada / ✗ error: motivo`

6. Al finalizar todas las entidades, mostrar resumen:
   ```
   Batch completado.
   ✓ Creadas: N
   ✓ Actualizadas: N
   ✗ Errores: N (listar cuáles)
   Página padre: [título + link]
   ```

---

### Estructuras por tipo de código

#### Tipo A — Entidad / Base de datos

**Título**: `Entity · [EntityName]`
Ejemplo: `Entity · Candidate`

**Secciones** (en este orden exacto):

```

```

## Checklist



## Formato de reporte



## Criterio de bloqueo

Si `getAccessibleAtlassianResources` no devuelve recursos, informar al usuario que debe autenticarse con el MCP de Atlassian ejecutando `/mcp` y seleccionando "claude.ai Atlassian".

## Qué NO reemplaza


