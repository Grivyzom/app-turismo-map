
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

---

## 3. Flujo de Onboarding de Preferencias (Implementado)
Una vez que el usuario se registra exitosamente como ciudadano (`citizen`), es transferido automáticamente a la vista de Onboarding de Preferencias (`app/onboarding.tsx`).

### Características del Flujo:
* **Fases del Onboarding:** El usuario es encuestado a través de 3 pasos interactivos:
  1. **Intereses en Valdivia:** Selección múltiple de categorías (Naturaleza, Cerveza, Gastronomía, Historia, Río, Cultura).
  2. **Estilo de Viaje:** Selección única de estilo (Mochilero, Pareja, Familiar, Negocios).
  3. **Estadía:** Selección única del tiempo de permanencia.
* **Persistencia local y remota:** Las preferencias se guardan en `AsyncStorage` en el cliente y se envían de forma asíncrona mediante un `PATCH` a `/api/v1/profile/preferences` usando el token JWT.
* **Motor Predictivo:** Estos datos sirven de base fría para el motor de recomendación geoespacial.

*Detalles, diagramas de secuencia Mermaid y especificación técnica completa en:* [[Flujo Ideal de Registro y Onboarding de Preferencias]].