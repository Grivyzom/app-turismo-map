
Esta nota define cómo interactúan los usuarios con el sistema y cómo nuestro backend en Go gestiona sus accesos. 
Los perfiles comerciales detallados están en la nota de negocio: [[Modelo de Cuentas y Roles]].

## 1. Diagrama de Casos de Uso (UML)
El siguiente diagrama muestra los límites del sistema multiplataforma (Web/App) y qué puede hacer cada actor.![[casos-de-uso-general.png]]

* **Nota Técnica:** El Administrador asignará el rol de `Partner` manualmente según el flujo de Onboarding Concierge.

---

## 2. Flujo de Registro (Onboarding MVP)
Para evitar fricción en los turistas y poder filtrar a los negocios de Valdivia manualmente, hemos definido el siguiente embudo de registro:![[flujo-registro-mvp.png]]

### Puntos críticos para el desarrollo en Go:
* La ruta `/api/v1/auth/register` debe recibir un JSON con `userType: "citizen" | "partner_owner"`.
* Si es `partner_owner`, se debe enviar también el `entityType: "business" | "media" | "creator"`.
* Si es `citizen`, el campo `status` en la DB será `active`.
* Si es `partner_owner`, el campo `status` será `pending` y no se emitirá un Token JWT con permisos completos hasta que el Admin apruebe su Entidad Emisora (`companies`).
* **Soporte Geoespacial:** Las ubicaciones de sucursales (`branches`) se almacenarán usando **PostGIS** `GEOMETRY(Point, 4326)` en lugar de latitud/longitud flotantes separadas.
* Los `partner_workers` no se registran libremente; deben entrar a través del flujo de token de `/api/v1/invitations/accept`.