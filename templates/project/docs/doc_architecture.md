# Arquitectura

> Referencia de arquitectura del proyecto. `sdd-enrich-us`, `sdd-design` y
> `sdd-plan` leen esto antes de proponer o planificar trabajo.

## Capas

```
[entry points] → [transporte] → [aplicación] → [dominio] → [infraestructura]
```

| Capa | Responsabilidad | NO debe hacer |
|---|---|---|
| Transporte | parsear input, formatear output | orquestación de negocio |
| Aplicación | coordinar casos de uso | detalles de UI |
| Dominio | reglas de negocio e invariantes | acoplarse a I/O externo |
| Infraestructura | persistencia e integraciones | decisiones de negocio centrales |

## Módulos

<listar los módulos/dominios principales y sus puntos de entrada>

## Modelo de datos

<entidades clave y sus relaciones>
