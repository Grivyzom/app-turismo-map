
  Autenticación y Perfil de Ciudadano (Prioridad Alta)
   - [x] El registro permite crear un usuario con el rol específico de "Ciudadano".
   - [x] El sistema impide registros con correos electrónicos que ya existen en la base de datos.
   - [x] El login valida correctamente las credenciales y devuelve un token JWT válido.
   - [x] El login falla con mensajes claros ante contraseñas incorrectas o usuarios inexistentes.
   - [x] La sesión se mantiene activa al cerrar y volver a abrir la aplicación (Persistencia).
   - [x] El usuario puede cerrar sesión y el token queda invalidado o eliminado localmente.
   - [ ] El ciudadano puede ver y editar sus datos básicos en la pantalla de Perfil.

  Encuesta de Bienvenida y Preferencias (Core)
   - [ ] La encuesta de preferencias aparece automáticamente la primera vez que un ciudadano ingresa.
   - [ ] El sistema guarda correctamente las categorías seleccionadas (ej: Museos, Parques, Gastronomía).
   - [ ] El usuario puede volver a editar sus preferencias desde los ajustes de su perfil.
   - [ ] El mapa se actualiza o filtra inicialmente según las preferencias guardadas en la encuesta.

  Experiencia en el Mapa y Navegación
   - [ ] El mapa carga y muestra marcadores de lugares cercanos a la ubicación real del ciudadano.
   - [ ] Al tocar un marcador, se despliega la tarjeta de información con datos reales del backend.
   - [ ] El botón "Ver detalle" en la tarjeta redirige correctamente a la pantalla de información completa del lugar.
   - [ ] El buscador del mapa filtra correctamente por nombre o categoría de lugar.

  Interacción Social y Gamificación (Dificultad Media)
   - [ ] El ciudadano puede realizar un "Check-in" exitoso si se encuentra dentro del radio de geocerca del lugar.
   - [ ] El sistema bloquea intentos de "Check-in" si el ciudadano está lejos de las coordenadas del lugar.
   - [ ] Los check-ins realizados se reflejan inmediatamente en la pantalla de "Pasaporte".
   - [ ] El usuario puede guardar un lugar en su lista de "Favoritos" o "Colecciones".
   - [ ] El ciudadano puede ver y publicar comentarios en el muro de la comunidad o foros.

  Funcionalidades Offline y Casos Borde (Dificultad Alta)
   - [ ] El mapa sigue mostrando las áreas cacheadas previamente cuando el dispositivo entra en modo avión.
   - [ ] El sistema permite realizar un "Check-in" en modo offline y lo encola para sincronizarlo al recuperar
     conexión.
   - [ ] Las notificaciones en tiempo real (eventos de última hora) llegan correctamente al ciudadano.
   - [ ] El motor de recomendaciones muestra lugares sugeridos basados en el historial de check-ins del ciudadano.

  ---

  Cambios en el diseño (Testing de UI/UX)

   1. Verificar que el cambio a Modo Oscuro sea consistente en todas las pantallas (no queden textos negros sobre
      fondo oscuro).
   2. Probar que en tablets y escritorio el mapa aproveche el ancho de pantalla y no sea solo una versión estirada de
      la app móvil.
   3. Confirmar que los Skeleton Loaders aparezcan mientras los datos del backend están en camino.
   4. Validar que los íconos de los pines en el mapa sean distinguibles según la categoría del lugar (ej: un tenedor
      para comida, un árbol para parques).
   5. Revisar que los botones de acción principal (como el de Check-in) tengan un tamaño adecuado para ser pulsados
      fácilmente con el pulgar.