# Backend (Go)

## Resumen

El backend de la aplicación se construirá utilizando **Go (Golang)** debido a su alto rendimiento, bajo consumo de memoria y manejo nativo eficiente de la concurrencia a través de Goroutines. Este backend servirá datos geoespaciales informativos y eventos de telemetría en tiempo real a clientes móviles y web de forma simultánea. El punto de entrada actual está en [main.go:1](vscode-file://vscode-app/c:/Users/grivy/AppData/Local/Programs/Microsoft%20VS%20Code/f6cfa2ea24/resources/app/out/vs/code/electron-browser/workbench/workbench.html).

## 🛠️ Tecnologías y Librerías Clave

- **Lenguaje:** `Go 1.26.1` (según `go.mod`)
- **Framework HTTP / Enrutador:** `Chi` o `Gin` (seleccionados para APIs REST ligeras y rápidas)
- **Manejo de Tiempo Real:** `Gorilla WebSocket` (para mantener conexiones persistentes bidireccionales)
- **Base de Datos:** `PostgreSQL` + **PostGIS** (extensión geoespacial para cálculos de distancias y consultas espaciales)

## 📍 Estado Actual del Proyecto
El proyecto se encuentra en una fase inicial de esqueleto:
- `main.go`: Contiene un "Hello World" básico para verificar el funcionamiento del entorno Go.
- `go.mod`: Define el módulo `backend` con la versión 1.26.1.

## 🗺️ Arquitectura de Datos en Tiempo Real

El servidor en Go procesará la información climática, eventos turísticos y datos en vivo para empaquetarlos en un **JSON unificado**. Este JSON será enviado a través de un canal de WebSocket común, sin importar si el cliente se conecta desde una PC o un teléfono. El backend expondrá además endpoints REST para CRUD y consultas espaciales (p. ej. rutas, POIs, filtros por distancia).

> 💡 **Nota de Arquitectura:**  
> El backend desconoce cómo el cliente renderiza el mapa. El backend solo entrega coordenadas, metadatos y estados de eventos; la representación (símbolos, clustering, estilos) queda en el cliente.