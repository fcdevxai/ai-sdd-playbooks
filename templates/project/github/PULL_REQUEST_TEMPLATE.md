## Referencia a la spec

- **Change**: `openspec/changes/<change-id>/`
- **Proposal**: `proposal.md` (`status: approved`)
- **Branch**: `<change-id>`

## Criterios de aceptación verificados

<!-- Copiá los criterios de aceptación de proposal.md; marcá los que este PR cumple -->

- [ ] AC-01 — <criterio>
- [ ] AC-02 — <criterio>

## Casos de error cubiertos

<!-- Copiá los casos de error de proposal.md -->

- [ ] <caso de error>

## Artefactos SDD

- [ ] `sdd-enrich-us` corrido — requisito con decisiones cerradas
- [ ] `sdd-new` — `proposal.md` creada; un humano fijó `status: approved`
- [ ] `sdd-plan` — `tasks.md` (`status: ready`)
- [ ] `sdd-apply` — tareas implementadas; Execution Report anexado
- [ ] `sdd-code-review` — `code-review-report.md` (`status: passed`)
- [ ] `playbook validate` / `playbook next` en verde (el CLI decide el estado, no un encabezado)

## Checks de calidad

<!-- Reemplazar con los comandos de tu stack -->

- [ ] `<comando de test>` pasa
- [ ] `<comando de lint/formato>` limpio

## Fuera de scope

<!-- ¿Algo no cubierto por la proposal? Explicá y actualizá proposal.md -->

Ninguno / <describir el cambio y notar la spec actualizada>

## Checklist del revisor humano

- [ ] Los criterios de aceptación de este PR coinciden con `proposal.md`
- [ ] No se tocaron archivos fuera de los non-goals de la proposal
- [ ] Los casos de error de la spec tienen manejo explícito en el código
- [ ] Los tests validan comportamiento, no solo que el código corre
