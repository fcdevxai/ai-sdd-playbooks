---
status: accepted
date: 2026-07-03
ticket: npm-package-distribution
---

# ADR: Distribuir specloom como dependencia git privada, no como registro npm ni como repo clonado

## Context

Hoy specloom se consume clonando el repo entero. Eso obliga a mantener a mano dos copias de cada archivo del framework — la copia "viva" en uso y su equivalente en `framework/templates/` — y esa duplicación ya causó drift real: el code review de `adr-decision-records` encontró `framework/templates/docs/sdd-workflow.md` desincronizado de su copia viva (Issue 6), y esta misma sesión encontramos que `framework/templates/github/workflows/spec-lint.yml` tampoco reflejaba el fix de `--base`/`fetch-depth` aplicado a la copia viva.

Al evaluar cómo distribuir el framework hacia proyectos futuros (la topología `{api, frontend, loom}` discutida), se compararon tres mecanismos: seguir clonando (statu quo), publicar en GitHub Packages (registro npm privado scoped a la org), o instalar como dependencia git privada resuelta por tags semver (`npm install github:org/repo#semver:^X.Y.Z`).

## Decision

specloom se distribuye como dependencia git privada de GitHub. Cada proyecto consumidor lo instala con:

```
npm install github:lablab-outplacement/specloom#semver:^X.Y.Z
```

Las versiones se resuelven contra tags de git (`vX.Y.Z`), no contra un registro de paquetes — sin necesidad de scope de paquete (`@org/...`) ni de un token separado de `packages`. El repo mantiene un `package.json` delgado en su propia raíz (apuntando a `framework/`) para que la resolución de dependencia git encuentre el punto de entrada del paquete. Los tags de release se cortan manualmente y de forma deliberada — nunca automáticamente en cada merge a `main`.

## Consequences

### Positive

- Sin registro npm separado que mantener ni token de `packages` que rotar en cada consumidor/CI — el control de acceso es exactamente el mismo que ya existe hoy para clonar el repo (SSH/PAT de git).
- `npm update` funciona con semántica semver normal gracias a la sintaxis `#semver:`, resolviendo contra tags de git.
- Elimina de raíz la clase de bug de "dos copias desincronizadas" (framework/templates/ vs. copia viva): cada proyecto consumidor tiene una única instancia instalada, no un clon divergente del framework.

### Negative

- Depende de una sintaxis de npm menos conocida (`#semver:`) que un registro estándar no necesita.
- Requiere disciplina de tagging manual — sin tags nuevos, no hay nada que `npm update` pueda traer.
- Sin la ceremonia de "versión publicada formalmente": no aparece en npmjs.com, y comandos como `npm view` no listan versiones de la forma estándar de un registro.

### Risks

- Si el repo alguna vez cambia de owner/org o deja de ser accesible con las credenciales configuradas, las URLs `github:lablab-outplacement/...` dejan de resolver — mismo riesgo que ya existe hoy para cualquier clon de este repo, no uno nuevo.
- La resolución `#semver:` depende de que los tags sigan la convención `vX.Y.Z`; un tag fuera de esa convención simplemente no participa en la resolución de versión, sin error explícito — mitigación: la convención de tagging manual y deliberado queda documentada en `CLAUDE.md` → "Convenciones rápidas".

## Alternatives considered

### GitHub Packages (registro npm scoped a la org)

Descartada por ahora: exige que el nombre del paquete tenga scope (`@lablab-outplacement/specloom`), un token separado con permiso `read:packages`/`write:packages` que configurar y rotar en cada consumidor y en cada CI, y un paso de publish adicional (`npm publish` contra `npm.pkg.github.com`) — más infraestructura para el mismo resultado, dado que el único consumidor previsto hoy es la propia org.

### Seguir clonando el repo (statu quo)

Descartada: ya produjo drift real y documentado (Issue 6 del code-review de `adr-decision-records`, más el hallazgo de `spec-lint.yml` desactualizado en esta misma sesión), y no ofrece ningún camino de "actualizar" — cada proyecto que clona diverge para siempre del framework original.

## Impact

- backend: sin impacto (los repos `api`/`frontend` quedan fuera del alcance de este ticket).
- frontend: sin impacto.
- security: el repo sigue siendo privado; el acceso lo sigue gateando git (SSH/PAT), sin mecanismo de permisos nuevo. Sin scripts de instalación (`postinstall`/`prepare`) que ejecuten código arbitrario al instalar.
- data: nuevo `package.json` en la raíz del repo; nuevo `framework/templates/config.yaml`.
- deployment: redefine el mecanismo de distribución del framework en sí — de "clonar" a "instalar y actualizar vía npm" — afectando a todo proyecto que use loom de ahora en adelante.
- testing: cobertura nueva para la resolución del `package.json` de la raíz y para el comando `init` que depende de esta instalación.
