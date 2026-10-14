import maplibregl, { CustomLayerInterface, Map as MapLibreMap, MercatorCoordinate } from 'maplibre-gl';

/**
 * Rain3DLayer - Capa Custom WebGL nativa para MapLibre GL 5.x
 *
 * Arquitectura de alto rendimiento blindada para producción:
 * 1. Proyección 100% en GPU mediante u_matrix nativo (soporta >5.000 partículas a 60/120 FPS).
 * 2. Cero jittering a zooms altos (>= 16) mediante técnica Relative-to-Center (RTC) calculada en 64 bits en CPU.
 * 3. Escala vertical conformal en metros usando MercatorCoordinate.meterInMercatorCoordinateUnits().
 * 4. Topología gl.LINES con degradado de estela en fragment shader (cabeza nítida y cola suave).
 * 5. Borde de volumen suavizado (radial smooth edge falloff) para evitar popping durante paneos rápidos.
 * 6. Aislamiento estricto de estados WebGL (stencil, scissor, cull face y depthMask) y liberación de recursos en onRemove.
 * 7. Manejo resiliente de pérdida y restauración de contexto (webglcontextlost / webglcontextrestored).
 * 8. Repaint condicional: la GPU permanece en 0% cuando la lluvia está inactiva o el zoom es menor a 12.0.
 */
export class Rain3DLayer implements CustomLayerInterface {
  id = 'rain-3d-layer';
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;

  // Ubicación de uniforms y attributes
  private uMatrixLocation: WebGLUniformLocation | null = null;
  private uTimeLocation: WebGLUniformLocation | null = null;
  private uWindDirLocation: WebGLUniformLocation | null = null;
  private uCeilingMetersLocation: WebGLUniformLocation | null = null;
  private uMeterScaleLocation: WebGLUniformLocation | null = null;
  private uStreakLengthLocation: WebGLUniformLocation | null = null;
  private uZoomFadeLocation: WebGLUniformLocation | null = null;
  private uIntensityLocation: WebGLUniformLocation | null = null;
  private uVolumeRadiusLocation: WebGLUniformLocation | null = null;

  private aLocalSeedLocation = -1;
  private aSpeedLocation = -1;
  private aVertexTypeLocation = -1;

  // Estado meteorológico y de simulación
  private dropCount = 4500; // Número de gotas simultáneas en el volumen
  private readonly volumeRadiusMeters = 450; // Radio del volumen centrado en la cámara (m)
  private readonly ceilingMeters = 140.0; // Altura de nube en metros
  private readonly streakLengthMeters = 3.8; // Longitud de la estela en metros

  private intensity = 0.5; // 0.0 a 1.0
  private windAngleDeg = 210; // Dirección meteorológica del viento en grados (0° = Norte)
  private windSpeedKmh = 18; // Velocidad del viento en km/h
  private isActive = false;
  private startTime = Date.now();

  // Zoom LOD thresholds
  private minRainZoom = 12.0;
  private fullRainZoom = 13.5;

  // Búfer reutilizable para matriz RTC local (evita allocs por frame)
  private localMatrixArray = new Float32Array(16);

  constructor(options?: { minZoom?: number; fullZoom?: number; dropCount?: number }) {
    if (options?.minZoom !== undefined) this.minRainZoom = options.minZoom;
    if (options?.fullZoom !== undefined) this.fullRainZoom = options.fullZoom;
    if (options?.dropCount !== undefined) this.dropCount = options.dropCount;
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.gl = gl;

    // Escuchar pérdida y restauración de contexto WebGL
    const canvas = map.getCanvas?.();
    if (canvas && canvas !== this.canvas) {
      this.canvas = canvas;
      this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
      this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    }

    const vsSource = `
      precision mediump float;

      attribute vec3 a_local_seed;   // (x_meters, y_meters, z_phase [0..1])
      attribute float a_speed;
      attribute float a_vertex_type; // 0.0 = cabeza (impacto), 1.0 = cola superior

      uniform mat4 u_matrix;         // Matriz RTC (Relative to Center)
      uniform float u_time;
      uniform vec2 u_wind_dir;       // Desplazamiento horizontal por viento en metros
      uniform float u_ceiling_meters;
      uniform float u_meter_scale;
      uniform float u_streak_length;
      uniform float u_zoom_fade;
      uniform float u_intensity;
      uniform float u_volume_radius;

      varying float v_alpha;

      void main() {
        // Ciclo continuo de caída vertical usando fract()
        float h = fract(a_local_seed.z - u_time * a_speed);

        // Desplazamiento de estela entre cabeza y cola
        float tailOffset = a_vertex_type * (u_streak_length / u_ceiling_meters);
        float currentH = clamp(h + tailOffset, 0.0, 1.0);

        // Altitud en metros sobre la superficie
        float altMeters = currentH * u_ceiling_meters;

        // Desplazamiento horizontal por viento (a mayor altura, mayor deriva acumulada)
        vec2 windOffset = u_wind_dir * (1.0 - currentH);

        // Posición local en metros respecto al centro de la cámara
        vec2 localPosMeters = a_local_seed.xy + windOffset;

        // Proyección a unidades conformales Mercator locales
        vec3 localMercator = vec3(
          localPosMeters.x * u_meter_scale,
          -localPosMeters.y * u_meter_scale, // Invertir Y para coordenadas cartográficas Mercator
          altMeters * u_meter_scale
        );

        gl_Position = u_matrix * vec4(localMercator, 1.0);

        // 1. Gradiente de estela: cabeza más nítida y brillante, cola difuminada
        float streakFade = 1.0 - a_vertex_type * 0.65;

        // 2. Desvanecimiento superior al ingresar a la nube
        float entryFade = currentH > 0.88 ? (1.0 - currentH) / 0.12 : 1.0;

        // 3. Suavizado radial perimetral (smooth edge falloff):
        // Elimina cortes duros y efecto "popping" al realizar paneos violentos de cámara
        float distToCenter = length(a_local_seed.xy);
        float edgeFade = smoothstep(u_volume_radius, u_volume_radius * 0.80, distToCenter);

        v_alpha = streakFade * entryFade * u_zoom_fade * u_intensity * edgeFade;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying float v_alpha;

      void main() {
        if (v_alpha <= 0.005) {
          discard;
        }
        // Azul celeste platinado con premultiplied alpha
        float a = v_alpha * 0.70;
        gl_FragColor = vec4(0.82 * a, 0.92 * a, 1.0 * a, a);
      }
    `;

    // 1. Compilar shaders y enlazar programa
    const vs = this.compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    this.program = gl.createProgram();
    if (!this.program) return;

    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('[Rain3DLayer] Error al enlazar programa WebGL:', gl.getProgramInfoLog(this.program));
      return;
    }

    // 2. Extraer ubicaciones de uniforms
    this.uMatrixLocation = gl.getUniformLocation(this.program, 'u_matrix');
    this.uTimeLocation = gl.getUniformLocation(this.program, 'u_time');
    this.uWindDirLocation = gl.getUniformLocation(this.program, 'u_wind_dir');
    this.uCeilingMetersLocation = gl.getUniformLocation(this.program, 'u_ceiling_meters');
    this.uMeterScaleLocation = gl.getUniformLocation(this.program, 'u_meter_scale');
    this.uStreakLengthLocation = gl.getUniformLocation(this.program, 'u_streak_length');
    this.uZoomFadeLocation = gl.getUniformLocation(this.program, 'u_zoom_fade');
    this.uIntensityLocation = gl.getUniformLocation(this.program, 'u_intensity');
    this.uVolumeRadiusLocation = gl.getUniformLocation(this.program, 'u_volume_radius');

    // 3. Ubicaciones de atributos
    this.aLocalSeedLocation = gl.getAttribLocation(this.program, 'a_local_seed');
    this.aSpeedLocation = gl.getAttribLocation(this.program, 'a_speed');
    this.aVertexTypeLocation = gl.getAttribLocation(this.program, 'a_vertex_type');

    // 4. Generar VBO estático de partículas (2 vértices por gota para gl.LINES)
    // Layout por vértice: [seed_x (m), seed_y (m), z_phase (0..1), speed, vertex_type (0 o 1)] = 5 floats
    const vertexData = new Float32Array(this.dropCount * 2 * 5);
    let offset = 0;

    for (let i = 0; i < this.dropCount; i++) {
      // Distribución uniforme en disco alrededor de la cámara
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * this.volumeRadiusMeters;
      const seedX = Math.cos(angle) * radius;
      const seedY = Math.sin(angle) * radius;
      const zPhase = Math.random();
      const speed = 0.85 + Math.random() * 0.45; // Variación orgánica de velocidad

      // Vértice 0: Cabeza (a_vertex_type = 0.0)
      vertexData[offset++] = seedX;
      vertexData[offset++] = seedY;
      vertexData[offset++] = zPhase;
      vertexData[offset++] = speed;
      vertexData[offset++] = 0.0;

      // Vértice 1: Cola (a_vertex_type = 1.0)
      vertexData[offset++] = seedX;
      vertexData[offset++] = seedY;
      vertexData[offset++] = zPhase;
      vertexData[offset++] = speed;
      vertexData[offset++] = 1.0;
    }

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: any): void {
    if (!this.program || !this.buffer || !this.map) return;

    // Control de visibilidad por Zoom LOD
    const currentZoom = this.map.getZoom();
    let zoomFade = 1.0;
    if (currentZoom <= this.minRainZoom) {
      zoomFade = 0.0;
    } else if (currentZoom < this.fullRainZoom) {
      zoomFade = (currentZoom - this.minRainZoom) / (this.fullRainZoom - this.minRainZoom);
    }

    // Si no está lloviendo o el zoom está fuera de rango, no consumir GPU
    if (!this.isActive || this.intensity <= 0 || zoomFade <= 0.001) {
      return;
    }

    // 1. Matriz de proyección MapLibre
    const matrix: number[] | Float32Array =
      options.modelViewProjectionMatrix ||
      options.defaultProjectionData?.projectionMatrix ||
      options;

    // 2. Coordenada central del mapa en Mercator (con alta precisión 64 bits en JS)
    const center = this.map.getCenter();
    const centerCoord = MercatorCoordinate.fromLngLat([center.lng, center.lat], 0);
    const meterScale = centerCoord.meterInMercatorCoordinateUnits();

    // 3. Relative-to-Center (RTC): Calcular matriz local M' = M * Translate(centerCoord.x, centerCoord.y, 0)
    // Elimina el jittering en zooms altos (>16) al procesar la traslación geográfica en 64 bits
    const cx = centerCoord.x;
    const cy = centerCoord.y;
    const cz = 0.0;

    const m = matrix as any;
    // Columna 0
    this.localMatrixArray[0] = m[0];
    this.localMatrixArray[1] = m[1];
    this.localMatrixArray[2] = m[2];
    this.localMatrixArray[3] = m[3];
    // Columna 1
    this.localMatrixArray[4] = m[4];
    this.localMatrixArray[5] = m[5];
    this.localMatrixArray[6] = m[6];
    this.localMatrixArray[7] = m[7];
    // Columna 2
    this.localMatrixArray[8] = m[8];
    this.localMatrixArray[9] = m[9];
    this.localMatrixArray[10] = m[10];
    this.localMatrixArray[11] = m[11];
    // Columna 3: M * [cx, cy, cz, 1]^T en 64 bits
    this.localMatrixArray[12] = m[0] * cx + m[4] * cy + m[8] * cz + m[12];
    this.localMatrixArray[13] = m[1] * cx + m[5] * cy + m[9] * cz + m[13];
    this.localMatrixArray[14] = m[2] * cx + m[6] * cy + m[10] * cz + m[14];
    this.localMatrixArray[15] = m[3] * cx + m[7] * cy + m[11] * cz + m[15];

    // 4. Vector de viento geográfico real en metros
    const windRad = (this.windAngleDeg * Math.PI) / 180;
    const windSpeedScale = (this.windSpeedKmh / 35) * 22; // Escala en metros de desplazamiento
    const windMetersX = Math.sin(windRad) * windSpeedScale;
    const windMetersY = Math.cos(windRad) * windSpeedScale;

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;

    // 5. Aislamiento y guardado de estados WebGL compartidos de MapLibre
    const stencilEnabled = gl.isEnabled(gl.STENCIL_TEST);
    const scissorEnabled = gl.isEnabled(gl.SCISSOR_TEST);
    const cullFaceEnabled = gl.isEnabled(gl.CULL_FACE);

    if (stencilEnabled) gl.disable(gl.STENCIL_TEST);
    if (scissorEnabled) gl.disable(gl.SCISSOR_TEST);
    if (cullFaceEnabled) gl.disable(gl.CULL_FACE);

    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // Premultiplied alpha
    gl.depthMask(false); // No escribir en buffer de profundidad para permitir mezclar capas inferiores

    // 6. Inyectar uniforms
    gl.uniformMatrix4fv(this.uMatrixLocation, false, this.localMatrixArray);
    gl.uniform1f(this.uTimeLocation, elapsedSeconds * (0.9 + this.intensity * 0.4));
    gl.uniform2f(this.uWindDirLocation, windMetersX, windMetersY);
    gl.uniform1f(this.uCeilingMetersLocation, this.ceilingMeters);
    gl.uniform1f(this.uMeterScaleLocation, meterScale);
    gl.uniform1f(this.uStreakLengthLocation, this.streakLengthMeters * (0.8 + this.intensity * 0.5));
    gl.uniform1f(this.uZoomFadeLocation, zoomFade);
    gl.uniform1f(this.uIntensityLocation, this.intensity);
    gl.uniform1f(this.uVolumeRadiusLocation, this.volumeRadiusMeters);

    // 7. Enlazar VBO y configurar punteros de atributos
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;

    if (this.aLocalSeedLocation >= 0) {
      gl.enableVertexAttribArray(this.aLocalSeedLocation);
      gl.vertexAttribPointer(this.aLocalSeedLocation, 3, gl.FLOAT, false, stride, 0);
    }
    if (this.aSpeedLocation >= 0) {
      gl.enableVertexAttribArray(this.aSpeedLocation);
      gl.vertexAttribPointer(this.aSpeedLocation, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    }
    if (this.aVertexTypeLocation >= 0) {
      gl.enableVertexAttribArray(this.aVertexTypeLocation);
      gl.vertexAttribPointer(this.aVertexTypeLocation, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
    }

    // 8. Trazado instanciado de líneas en GPU
    gl.drawArrays(gl.LINES, 0, this.dropCount * 2);

    // 9. Restauración rigurosa de estados WebGL
    gl.depthMask(true);
    if (stencilEnabled) gl.enable(gl.STENCIL_TEST);
    if (scissorEnabled) gl.enable(gl.SCISSOR_TEST);
    if (cullFaceEnabled) gl.enable(gl.CULL_FACE);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // 10. Repaint condicional: solo redibujar continuamente si está lloviendo y visible
    if (this.isActive && this.intensity > 0 && currentZoom >= this.minRainZoom) {
      this.map.triggerRepaint();
    }
  }

  onRemove(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
      this.canvas = null;
    }
    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.buffer) {
      gl.deleteBuffer(this.buffer);
      this.buffer = null;
    }
    this.map = null;
    this.gl = null;
  }

  // --- Handlers de Pérdida y Restauración de Contexto ---

  private handleContextLost = (e: Event): void => {
    e.preventDefault(); // Permite que el navegador intente restaurar el contexto WebGL
    this.program = null;
    this.buffer = null;
  };

  private handleContextRestored = (): void => {
    if (this.map && this.gl) {
      this.onAdd(this.map, this.gl);
    }
  };

  // --- API de Control ---

  start(): void {
    this.isActive = true;
    this.startTime = Date.now();
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  stop(): void {
    this.isActive = false;
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  setIntensity(intensity: number): void {
    this.intensity = Math.max(0, Math.min(1, intensity));
    if (this.map && this.isActive) {
      this.map.triggerRepaint();
    }
  }

  setWind(directionDegrees: number, speedKmh: number): void {
    this.windAngleDeg = directionDegrees;
    this.windSpeedKmh = Math.max(2, Math.min(80, speedKmh));
  }

  setZoomRange(minZoom: number, fullZoom: number): void {
    this.minRainZoom = minZoom;
    this.fullRainZoom = Math.max(minZoom + 0.1, fullZoom);
  }

  private compileShader(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[Rain3DLayer] Error de compilación en shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
}
