---
name: obsidian-knowledge-manager
description: Manage and route information across the project's Obsidian knowledge base. Use this skill when asked to document decisions, read project documentation, update tasks, or retrieve project knowledge.
---

# Obsidian Knowledge Manager

This skill provides instructions on how to interact with the project's Obsidian knowledge base, located at `obsidian/app-turismo/`.

## Core Philosophy

The Obsidian vault is the single source of truth for the project. When interacting with documentation, you must respect the directory structure and place information in the correct folder based on its domain. 

All documentation should be in Markdown (`.md`) format.

## Directory Structure & Routing Guide

When asked to retrieve or store information, use the following directory mapping:

### 1. Business & Requirements (`obsidian/app-turismo/01_Negocio_y_SaaS/`)
- **Use for:** Business logic, monetization strategies, feature requirements, SaaS models, product vision, and MVP definitions.
- **Example:** PDF requirements (`DOCUMENTO-DE-TOMA-DE-REQUERIMIENTOS (3).pdf`), cost analysis, pricing tiers.

### 2. Design & UI/UX (`obsidian/app-turismo/02_Diseño_y_UI/`)
- **Use for:** UI/UX definitions, style guides (colors, typography), component designs, and wireframe notes.
- **Example:** Creating a document mapping out the color palette or button states.

### 3. Architecture (`obsidian/app-turismo/03_Arquitectura/`)
- **Use for:** High-level system architecture, data models (ERD), user flow diagrams, and general system design patterns.
- **Example:** `Arquitectura y Flujo de Usuarios.md`, `Modelo_Datos_ERD.md`, and Mermaid diagrams (saved as `.canvas` or inside markdown).

### 4. Backend (`obsidian/app-turismo/04_Backend_Go/`)
- **Use for:** Go backend-specific documentation, API endpoint specifications, database migrations, server configurations, and backend deployment notes.
- **Example:** `STACK SELECCIONADO.md`, API contracts, or Go package structures.

### 5. Frontend (`obsidian/app-turismo/05_Frontend_Expo/`)
- **Use for:** React Native / Expo specific documentation, state management patterns, frontend folder structures, and client-side logic notes.
- **Example:** `STACK SELECCIONADO.md`, mapping screen navigation, map configuration details.

### 6. Tasks & Sprints (`obsidian/app-turismo/06_Tareas_y_Sprint/`)
- **Use for:** Daily tasks, sprint planning, meeting notes, to-do lists, and progress tracking.
- **Example:** `thomi escritura 22-05-2026.md`, current sprint backlog, completed tasks.

## Operational Rules

1. **Reading Information:** When asked about a specific domain (e.g., "What is the backend stack?"), use the `list_directory` and `read_file` tools within the corresponding directory.
2. **Writing Documentation:** When asked to document a decision or create a new file, place it in the most appropriate directory based on the guide above. Use descriptive filenames with the `.md` extension.
3. **Cross-referencing:** Feel free to create links in Obsidian format (e.g., `[[Filename]]`) to reference other documents within the vault.
