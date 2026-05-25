# App Navbar Design Guide

Este documento describe el estilo fijado para el `AppNavbar` (barra de navegación principal o `TopAppBar`) para garantizar la consistencia visual y permitir la replicación del mismo diseño en otros componentes o futuros desarrollos.

## Concepto General
El diseño se basa en un estilo de **barra flotante (Floating Navbar)** con efecto **Glassmorphism (Cristal esmerilado)**. Su objetivo es verse moderno, no intrusivo, aprovechar la pantalla completa (ideal para mapas de fondo) y mantener un contraste legible mediante el uso de colores carbón translúcidos e iconos en tonos claros.

---

## 1. Contenedor Principal (Container)

El contenedor actúa como una píldora flotante delgada con los siguientes atributos:

* **Fondo (Background):** `rgba(34, 34, 34, 0.55)`
  * *Color oscuro carbón con 55% de opacidad (medio transparente) para dejar entrever el fondo.*
* **Borde y Contorno:**
  * Borde redondeado completo: `borderRadius: 30`
  * Línea sutil de contorno: `borderWidth: 1`, `borderColor: 'rgba(255, 255, 255, 0.1)'`
* **Dimensiones y Espaciado (Altura Delgada):**
  * Espaciado Interno Vertical (Padding): `paddingVertical: 4`
  * Espaciado Interno Horizontal: `paddingHorizontal: 12`
  * Margen Exterior: `marginHorizontal: 16`, `marginTop: 12`
* **Sombra / Elevación (Profundidad):**
  * **iOS:** `shadowColor: '#000'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.3`, `shadowRadius: 10`
  * **Android:** `elevation: 8`
  * **Web:** `boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)'`, además de requerir `backdropFilter: 'blur(10px)'` para el efecto de cristal.

---

## 2. Elementos de Navegación (NavLinks / Tabs)

Los botones internos se distribuyen de forma equitativa (espaciado tipo `space-around` en el contenedor principal) y adoptan un estilo minimalista.

### Estilo Base
* **Altura / Espaciado:** `paddingVertical: 4`, `paddingHorizontal: 16`
* **Layout interno:** `flexDirection: 'row'`, `gap: 8`, centrado (`alignItems: 'center'`, `justifyContent: 'center'`).
* **Bordes:** `borderRadius: 24` para encajar armónicamente con la píldora principal.
* **Iconos:** Tamaño base `24`.

### Estado: Inactivo
* **Fondo:** Transparente.
* **Color de Texto e Icono:** `#9CA3AF` (Gris claro apagado, para no resaltar frente al fondo carbón oscuro).

### Estado: Activo (Seleccionado)
* **Fondo:** `rgba(255, 255, 255, 0.15)`
  * *Blanco con 15% de opacidad, crea un ligero resaltado de píldora interna.*
* **Color de Texto e Icono:** `#FFFFFF` (Blanco puro para máximo contraste y legibilidad).

---

## 3. Disposición de Pestañas (Estructura)

La barra está diseñada explícitamente sin logotipo y contiene solo los accesos directos requeridos. Para mantener un aspecto limpio, algunas opciones solo llevan icono y otras icono + texto.

* **Inicio / Mapa:** Icono (`map`) + Texto ("Inicio")
* **Foro:** Icono (`forum`) + Texto ("Foro")
* **Guardados:** Solo Icono (`bookmark`)
* **Configuración:** Solo Icono (`settings`)
* **Perfil:** Solo Icono (`person` / `account-circle`)

*(Nota técnica: cuando el botón solo lleva icono, se reduce el `paddingHorizontal` a `12` para mantener la proporción visual cuadrada/circular del botón).*
