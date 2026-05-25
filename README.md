# 🗺️ App Turismo Map — Plataforma Full-Stack Interactiva

[![React Native](https://img.shields.io/badge/React_Native-v0.76+-20232a.svg?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_56-000020.svg?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.0-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-Golang-00ADD8.svg?style=for-the-badge&logo=go&logoColor=white)](https://go.dev/)
[![PNPM Workspace](https://img.shields.io/badge/PNPM-Workspaces-F69220.svg?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)

Bienvenido a **App Turismo Map**, una plataforma de turismo interactiva y responsiva de alto rendimiento. El proyecto se basa en una arquitectura desacoplada de última generación que unifica un frontend multiplataforma híbrido (capaz de ejecutarse de forma nativa en **Android**, **iOS** y **Navegadores Web**) con un backend concurrente y eficiente escrito en **Go (Golang)**.

---

## 📖 Índice de Documentación Técnica

Para facilitar el desarrollo y el entendimiento de la arquitectura de software, disponemos de las siguientes guías técnicas detalladas:

* **🧩 [Guía de Componentes y Reusabilidad (docs/components.md)](file:///c:/Users/grivy/OneDrive/Desktop/Desarrollo/app-turismo-map/docs/components.md)**: Fichas técnicas, propiedades (`props`), interfaces de TypeScript y estrategias de renderizado multiplataforma (.web.tsx vs nativo).
* **🎨 [Manual de Diseño de Interfaz y Navbar (docs/design.md)](file:///c:/Users/grivy/OneDrive/Desktop/Desarrollo/app-turismo-map/docs/design.md)**: Detalle del estilo flotante con Glassmorphism (efecto cristal esmerilado) adoptado para el `AppNavbar` y replicable en el resto del software.

---

## 🛠️ Stack Tecnológico Integrado

### 📱 Frontend Multiplataforma (`app-turismo`)
* **Framework Principal:** [React Native](https://reactnative.dev/) con [Expo (SDK 56)](https://expo.dev/) – Compilación universal a partir de una única base de código.
* **Motor de Estilo:** [Tailwind CSS v4](https://tailwindcss.com/) (mediante **NativeWind v4**) – Diseño adaptativo *Mobile-First* y animaciones integradas.
* **Tipado Estático:** [TypeScript](https://www.typescriptlang.org/) – Arquitectura robusta y escalable libre de errores comunes en tiempo de ejecución.
* **Gestión de Paquetes:** [PNPM](https://pnpm.io/) – Espacio de trabajo (Workspace) eficiente que optimiza espacio en disco y velocidad de compilación.

### ⚙️ Backend API (`backend`)
* **Lenguaje:** [Go (Golang)](https://go.dev/) – Servidor HTTP concurrente nativo, ideal para el procesamiento en tiempo real de geolocalización, sincronización de usuarios e integración de sockets.

---

## 📂 Estructura General del Proyecto

El espacio de trabajo está organizado como un monorepositorio estructurado de la siguiente forma:

```text
APP-TURISMO-MAP/
├── app-turismo/               # FRONTEND MULTIPLATAFORMA (Expo)
│   ├── .expo/                 # Caché y archivos temporales de empaquetado de Expo
│   ├── app/                   # Ruteo basado en archivos (Expo Router)
│   │   ├── (home)/            # Pantalla principal (Mapa interactivo y feed)
│   │   └── _layout.tsx        # Contenedor raíz y proveedores globales
│   ├── assets/                # Imágenes de marca, iconos del sistema y splash-screens
│   ├── src/                   # Código de soporte del Cliente
│   │   ├── components/        # Componentes agrupados por categoría
│   │   │   ├── Map/           # Controladores de mapas nativos y web (.web.tsx)
│   │   │   ├── MapUI/         # Interfaz flotante de control (TopAppBar, NavLink)
│   │   │   └── ui/            # Elementos de UI atómicos (Button, Input)
│   │   ├── config/            # Configuraciones estáticas de mapas y estilos
│   │   ├── constants/         # Coordenadas geográficas y constantes del sistema
│   │   ├── hooks/             # custom hooks (ej. geolocalización de usuario)
│   │   └── utils/             # Funciones auxiliares y formateadores
│   ├── App.tsx                # Punto de entrada para compatibilidad nativa clásica
│   └── package.json           # Dependencias y scripts de desarrollo del Frontend
│
├── backend/                   # BACKEND API (Go)
│   ├── go.mod                 # Declaración del módulo y dependencias del backend Go
│   └── main.go                # Servidor HTTP API principal e integraciones
│
└── README.md                  # Manual de inicio y portal técnico (Este archivo)
```

---

## 🚀 Flujo de Trabajo en Desarrollo

Para levantar el ecosistema local de desarrollo, abre dos terminales de manera independiente en sus respectivas carpetas:

### 1️⃣ Levantar el Servidor Backend (Go)
Accede al directorio del servidor e inicializa el ejecutable de Go:
```bash
cd backend
go run main.go
```
*El servidor API se levantará de forma predeterminada, escuchando peticiones geográficas y autenticaciones.*

### 2️⃣ Levantar el Frontend (Expo Híbrido)
Navega a la carpeta de la aplicación e inicia el Metro Bundler:
```bash
cd app-turismo
pnpm expo start
```

* **📱 Para Entorno Móvil (Android/iOS):** Escanea el código QR que se muestra en tu terminal usando la aplicación **Expo Go** en tu dispositivo físico (ambos dispositivos deben compartir la misma red local Wi-Fi).
* **🌐 Para Entorno Web (Navegador):** Presiona `w` en la consola de Expo o dirígete a `http://localhost:8081` en tu navegador de preferencia.
