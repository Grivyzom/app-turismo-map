Aquí tienes una documentación inicial clara, concisa y profesional basada exactamente en la estructura y configuración real de tu espacio de trabajo. Puedes guardarla como un archivo `README.md` en la raíz de tu repositorio principal (`app-turismo-map`).

---

# Documentación Inicial: App Turismo Map

Este proyecto es una plataforma full-stack diseñada para ofrecer una experiencia turística interactiva y responsive. Utiliza una arquitectura desacoplada con un único frontend multiplataforma capaz de ejecutarse de forma nativa en dispositivos móviles y entornos web, respaldado por un backend de alto rendimiento.

## 🛠️ Stack Tecnológico

### Frontend Multiplataforma (`app-turismo`)

* **Framework Principal:** [React Native](https://reactnative.dev/) con [Expo (SDK 56)](https://expo.dev/) – Permite compilar código unificado para **Android**, **iOS** y **Web** desde un solo repositorio.
* **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/) (mediante **NativeWind v4**) – Utiliza el enfoque *utility-first* y *Mobile-First* para adaptar la interfaz dinámicamente a pantallas de teléfonos y computadoras de escritorio.
* **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) – Tipado estático para asegurar la escalabilidad del código y prevenir errores en tiempo de desarrollo.
* **Gestor de Paquetes:** [PNPM](https://pnpm.io/) – Gestión eficiente y rápida de dependencias orientada al rendimiento del disco y velocidad de instalación.

### Backend (`backend`)

* **Lenguaje / Entorno:** [Go (Golang)](https://go.dev/) – Backend de alta velocidad, concurrente y eficiente ideal para procesar APIs de geolocalización, rutas y datos masivos de mapas.

---

## 📂 Estructura General del Proyecto

Basado en el espacio de trabajo actual, los directorios principales se organizan de la siguiente manera:

```text
APP-TURISMO-MAP/
├── app-turismo/               # FRONTEND MULTIPLATAFORMA (Expo)
│   ├── .expo/                 # Archivos temporales de configuración y caché de Expo
│   ├── assets/                # Iconos del sistema, imágenes estáticas y pantallas de carga
│   ├── node_modules/          # Dependencias de JavaScript/React Native
│   ├── App.tsx                # Punto de entrada principal de la aplicación UI
│   ├── app.json               # Configuración global del manifiesto de Expo (Nombre, bundle, etc.)
│   ├── babel.config.js        # Configuración del compilador Babel (Integrado con NativeWind)
│   ├── global.css             # Archivo de estilos global que inicializa Tailwind v4
│   ├── tailwind.config.js     # Configuración de rutas y temas de Tailwind
│   ├── index.ts               # Punto de registro para la compilación web/móvil
│   ├── package.json           # Scripts de ejecución y lista de dependencias del frontend
│   └── tsconfig.json          # Configuración del compilador de TypeScript
│
├── backend/                   # BACKEND API (Go)
│   ├── go.mod                 # Definición del módulo y dependencias de Go
│   └── main.go                # Archivo principal y punto de inicio del servidor API
│
└── README.md                  # Documentación general del proyecto (Este archivo)

```

---

## 🚀 Flujo de Trabajo en Desarrollo

Para trabajar de forma local en el proyecto, se deben levantar ambos entornos en paralelo desde sus respectivas carpetas:

### 1. Levantar el Backend (Go)

Navegar al directorio de backend y ejecutar el servidor:

```bash
cd backend
go run main.go

```

### 2. Levantar el Frontend (Expo)

Navegar al directorio de la aplicación e iniciar el Metro Bundler:

```bash
cd app-turismo
pnpm expo start

```

* **Para entorno Web:** Presionar `w` en la terminal o acceder directamente a `http://localhost:8081`.
* **Para entorno Móvil:** Escanear el código QR generado en la terminal utilizando la aplicación **Expo Go** en un dispositivo Android o iOS conectado a la misma red local.