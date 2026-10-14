/**
 * Scene View Rain Effect
 * 
 * Simula lluvia cayendo desde un cielo tridimensional superior sobre el terreno (la escena del mapa).
 * Las gotas y ondas de impacto están ancladas a coordenadas exactas del mapa (mundo/escena).
 * Garantiza que:
 * 1. Todas las gotas aterricen sobre la superficie real del terreno y no en el cielo o suspendidas en el aire.
 * 2. Los charcos y ondas queden fijos en el punto exacto donde cayeron al desplazarse por el mapa.
 * 3. Las gotas en caída acompañen fluidamente el movimiento del mapa sin deformarse ni patinar.
 */

interface RaindropScene {
  targetLng: number;     // Coordenada exacta de impacto en el terreno
  targetLat: number;
  altitude: number;      // 1.0 (cielo simulado) a 0.0 (suelo del mapa)
  speed: number;         // Velocidad de caída
  opacity: number;
  length: number;        // Longitud del trazo
  active: boolean;
  depthScale: number;    // Cacheado al nacer para evitar deformaciones durante el pan
  ceilingHeight: number; // Altura de nube fija para la vida de la gota
  windDriftX: number;    // Desplazamiento lateral por viento (siempre visible)
  windDriftY: number;    // Desplazamiento longitudinal por viento (visible desde arriba)
  fallbackX?: number;
  fallbackY?: number;
}

interface WaveScene {
  targetLng: number;     // Coordenada exacta en el terreno donde cayó
  targetLat: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  active: boolean;
  createdAt: number;
  lifetime: number;
  depthScale: number;    // Cacheado al nacer para mantener escala estable
  fallbackX?: number;
  fallbackY?: number;
}

export class RainEffect {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private container: HTMLElement | null = null;
  private getMap?: () => any;

  private raindrops: RaindropScene[] = [];
  private waves: WaveScene[] = [];
  private animationFrameId: number | null = null;
  private isActive = false;
  private lastTime = Date.now();

  // Entorno y viento
  private windAngleDeg = 210; // Ángulo de origen del viento en grados (0° = Norte)
  private windSpeedKmh = 18;  // Velocidad de viento en km/h
  private intensity = 0.5;    // 0.0 a 1.0
  private mapPitch = 0;
  private mapBearing = 0;
  private mapZoom = 13;
  // Control de visibilidad por distancia de cámara (Zoom LOD)
  // La lluvia de escena (gotas y charcos) solo es visible desde cerca.
  // Desde lejos (vista regional/satelital) se desvanece suavemente para dar paso a efectos macro (radar, nubes).
  private minRainZoom = 12.0;
  private fullRainZoom = 13.5;

  private readonly dropPoolSize = 200;
  private readonly wavePoolSize = 50;
  private readonly waveLifetime = 600; // ms

  private viewportWidth = 1024;
  private viewportHeight = 1024;

  constructor(container: HTMLElement, getMap?: () => any) {
    this.container = container;
    this.getMap = getMap;
    this.initCanvas();
    this.initPools();
  }

  private initCanvas() {
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1';
    this.canvas.style.mixBlendMode = 'screen';

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.container.appendChild(this.canvas);
    this.resizeCanvas();

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    this.resizeCanvas();
  };

  private resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  private initPools() {
    for (let i = 0; i < this.dropPoolSize; i++) {
      this.raindrops.push({
        targetLng: 0,
        targetLat: 0,
        altitude: 0,
        speed: 1.5,
        opacity: 0.5,
        length: 22,
        active: false,
        depthScale: 1.0,
        ceilingHeight: 200,
        windDriftX: 5,
        windDriftY: 0,
      });
    }

    for (let i = 0; i < this.wavePoolSize; i++) {
      this.waves.push({
        targetLng: 0,
        targetLat: 0,
        radius: 0,
        maxRadius: 0,
        opacity: 0,
        active: false,
        createdAt: 0,
        lifetime: this.waveLifetime,
        depthScale: 1.0,
      });
    }
  }

  private getInactiveWave(): WaveScene | null {
    for (const wave of this.waves) {
      if (!wave.active) return wave;
    }
    return null;
  }

  /**
   * Genera o reinicia una gota de lluvia asignándole un punto de aterrizaje estricto
   * SOBRE LA SUPERFICIE DEL TERRENO (nunca en el cielo o por encima del horizonte).
   */
  private spawnDrop(drop: RaindropScene, randomizeAltitude = false) {
    const map = this.getMap?.();

    if (map && typeof map.unproject === 'function') {
      const pitch = map.getPitch?.() ?? this.mapPitch;
      const pitchRad = (pitch * Math.PI) / 180;
      const bearing = map.getBearing?.() ?? this.mapBearing;

      // Cálculo del horizonte visual para evitar desproyectar el cielo vacío:
      // A mayor pitch, el terreno visible comienza más abajo de la parte superior del canvas.
      const horizonY = this.viewportHeight * 0.20 * Math.sin(pitchRad);
      const marginX = 40;

      // El punto de impacto se elige ESTRICTAMENTE dentro de la superficie del terreno visible
      const targetScreenX = -marginX + Math.random() * (this.viewportWidth + marginX * 2);
      const targetScreenY = horizonY + Math.random() * (this.viewportHeight - horizonY + 20);

      try {
        const lngLat = map.unproject([targetScreenX, targetScreenY]);
        if (!isNaN(lngLat.lng) && !isNaN(lngLat.lat) && Math.abs(lngLat.lat) <= 85) {
          drop.targetLng = lngLat.lng;
          drop.targetLat = lngLat.lat;
          drop.altitude = randomizeAltitude ? Math.random() : 1.0;
          drop.speed = (1.4 + Math.random() * 0.7) * (0.8 + this.intensity * 0.4);
          drop.opacity = 0.35 + Math.random() * 0.35;
          drop.length = 18 + Math.random() * 14;

          // Parámetros espaciales fijos para la vida de esta gota (evita deformaciones en panning)
          const depthScale = Math.max(0.4, Math.min(1.2, 0.5 + 0.5 * (targetScreenY / this.viewportHeight)));
          drop.depthScale = depthScale;
          drop.ceilingHeight = (180 + 120 * Math.sin(pitchRad)) * depthScale;

          const relWindAngle = ((this.windAngleDeg - bearing) * Math.PI) / 180;
          const windDriftScale = (this.windSpeedKmh / 35) * (0.6 + this.intensity * 0.5);
          drop.windDriftX = Math.sin(relWindAngle) * windDriftScale * 35 * depthScale;
          drop.windDriftY = -Math.cos(relWindAngle) * windDriftScale * 35 * depthScale;

          drop.active = true;
          return;
        }
      } catch {
        // En caso de que unproject falle
      }
    }

    // Fallback si el mapa aún no está listo
    drop.fallbackX = Math.random() * this.viewportWidth;
    drop.fallbackY = Math.random() * this.viewportHeight;
    drop.altitude = randomizeAltitude ? Math.random() : 1.0;
    drop.speed = 1.5;
    drop.opacity = 0.4;
    drop.length = 20;
    drop.depthScale = 1.0;
    drop.ceilingHeight = 200;
    drop.windDriftX = 5;
    drop.windDriftY = 0;
    drop.active = true;
  }

  private createWave(
    targetLng: number,
    targetLat: number,
    depthScale: number,
    fallbackX?: number,
    fallbackY?: number,
  ) {
    const wave = this.getInactiveWave();
    if (!wave) return;

    wave.targetLng = targetLng;
    wave.targetLat = targetLat;
    wave.fallbackX = fallbackX;
    wave.fallbackY = fallbackY;
    wave.radius = 2;
    wave.maxRadius = 10 + Math.random() * 10;
    wave.opacity = 0.65;
    wave.active = true;
    wave.createdAt = Date.now();
    wave.lifetime = this.waveLifetime;
    wave.depthScale = depthScale;
  }

  private update(deltaTime: number) {
    const dt = Math.min(deltaTime / 1000, 0.08);
    const now = Date.now();

    for (const drop of this.raindrops) {
      if (!drop.active) continue;

      // La gota cae verticalmente hacia el suelo
      drop.altitude -= drop.speed * dt;

      if (drop.altitude <= 0) {
        // Impacto exacto contra el suelo de la escena
        if (Math.random() < 0.75) {
          this.createWave(
            drop.targetLng,
            drop.targetLat,
            drop.depthScale,
            drop.fallbackX,
            drop.fallbackY,
          );
        }
        // Respawn de la gota desde el cielo
        this.spawnDrop(drop, false);
      }
    }

    for (const wave of this.waves) {
      if (!wave.active) continue;

      const elapsed = now - wave.createdAt;
      const progress = elapsed / wave.lifetime;

      if (progress >= 1) {
        wave.active = false;
      } else {
        wave.radius = wave.maxRadius * Math.sqrt(progress);
        wave.opacity = 0.65 * (1 - progress);
      }
    }
  }

  private render() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    const map = this.getMap?.();
    const hasMap = !!(map && typeof map.project === 'function');

    const pitch = hasMap ? (map.getPitch?.() ?? this.mapPitch) : this.mapPitch;
    const pitchRad = (pitch * Math.PI) / 180;
    const currentZoom = hasMap && typeof map.getZoom === 'function' ? map.getZoom() : this.mapZoom;

    // --- Control de visibilidad por Zoom LOD (Cerca vs Lejos) ---
    // Física de escala:
    // - Zoom <= minRainZoom (12.0): Vista macro/regional lejana. La lluvia de escena no se dibuja (0% opacidad)
    //   para dejar libre la escena a efectos macro (radar satelital, nubes atmosféricas, etc.).
    // - minRainZoom < Zoom < fullRainZoom (12.0 - 13.5): Transición suave (fade in/out).
    // - Zoom >= fullRainZoom (13.5+): Vista cercana (nivel barrio y calle). Lluvia al 100% con física completa.
    let zoomFade = 1.0;
    if (currentZoom <= this.minRainZoom) {
      zoomFade = 0;
    } else if (currentZoom < this.fullRainZoom) {
      zoomFade = (currentZoom - this.minRainZoom) / (this.fullRainZoom - this.minRainZoom);
    }

    // Si la cámara está lejos, no dibujamos la lluvia de escena (ahorra cómputo y mantiene el mapa limpio)
    if (zoomFade <= 0.001) {
      return;
    }

    // --- 1. Dibujar gotas según perspectiva de cámara ---
    // Física de perspectiva:
    //   pitch 0° (cenital): la lluvia cae HACIA el observador → se ven como puntos/círculos
    //   pitch 60°+ (oblicuo): la lluvia se ve de costado → se ven como estelas/trazos
    const pitchFactor = Math.sin(pitchRad); // 0 arriba, ~0.87 a 60°, ~0.94 a 70°

    // Transformación dinámica del vector de viento respecto al bearing de la cámara
    // Permite que la lluvia gire correctamente cuando el usuario rota el mapa
    const currentBearing = hasMap ? (map.getBearing?.() ?? this.mapBearing) : this.mapBearing;
    const relWindRad = ((this.windAngleDeg - currentBearing) * Math.PI) / 180;
    const windScale = (this.windSpeedKmh / 35) * (0.6 + this.intensity * 0.5) * 35;
    const windDirX = Math.sin(relWindRad) * windScale;
    const windDirY = -Math.cos(relWindRad) * windScale;

    this.ctx.lineWidth = 1.3;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = 'rgba(215, 238, 255, 0.65)';

    for (const drop of this.raindrops) {
      if (!drop.active) continue;

      let gx: number;
      let gy: number;

      if (hasMap) {
        try {
          const pt = map.project([drop.targetLng, drop.targetLat]);
          gx = pt.x;
          gy = pt.y;
        } catch {
          continue;
        }

        // Si el objetivo se desplazó fuera de pantalla por navegación del usuario, reciclar
        if (gx < -120 || gx > this.viewportWidth + 120 || gy < -80 || gy > this.viewportHeight + 120) {
          this.spawnDrop(drop, true);
          continue;
        }
      } else {
        gx = drop.fallbackX ?? this.viewportWidth / 2;
        gy = drop.fallbackY ?? this.viewportHeight / 2;
      }

      // === Proyección del desplazamiento vertical según la perspectiva ===
      // Desde arriba (pitch~0), la caída vertical viene directo al ojo → no genera offset Y en pantalla
      // Desde oblicuo (pitch>0), la caída se proyecta como movimiento vertical en pantalla
      const altOffsetY = drop.altitude * drop.ceilingHeight * pitchFactor;

      // === Viento en pantalla dinámico según bearing ===
      const dropWindX = windDirX * drop.depthScale;
      const dropWindY = windDirY * drop.depthScale;
      const windOffsetX = drop.altitude * dropWindX;
      const windOffsetY = drop.altitude * dropWindY * (1 - pitchFactor);

      const headX = gx + windOffsetX;
      const headY = gy - altOffsetY + windOffsetY;

      // Desvanecimiento suave al emerger del cielo y por Zoom LOD
      const altitudeFade = drop.altitude > 0.85 ? Math.max(0, (1 - drop.altitude) / 0.15) : 1;
      const dropAlpha = drop.opacity * altitudeFade * drop.depthScale * zoomFade;
      this.ctx.globalAlpha = Math.min(1, Math.max(0, dropAlpha));

      // === Longitud de estela proporcional al ángulo de visión ===
      const baseStreakLen = drop.length * drop.depthScale * (0.8 + this.intensity * 0.4);
      const streakLen = baseStreakLen * pitchFactor;

      if (streakLen < 2.5) {
        // Vista cenital: la gota cae hacia el observador → se ve como punto circular
        // Gotas más cercanas (altitude baja) se ven ligeramente más grandes
        const dotRadius = Math.max(0.7, 1.6 * drop.depthScale * (1 - drop.altitude * 0.4));
        this.ctx.fillStyle = 'rgba(215, 238, 255, 0.7)';
        this.ctx.beginPath();
        this.ctx.arc(headX, headY, dotRadius, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Vista oblicua: estela con dirección de caída + viento dinámico
        const dirX = -dropWindX;
        const dirY = drop.ceilingHeight * pitchFactor;
        const dist = Math.hypot(dirX, dirY) || 1;
        const ndx = dirX / dist;
        const ndy = dirY / dist;

        const tailX = headX - ndx * streakLen;
        const tailY = headY - ndy * streakLen;

        this.ctx.beginPath();
        this.ctx.moveTo(tailX, tailY);
        this.ctx.lineTo(headX, headY);
        this.ctx.stroke();
      }
    }

    // --- 2. Dibujar ondas de charcos fijas en el terreno ---
    this.ctx.globalAlpha = 1;
    for (const wave of this.waves) {
      if (!wave.active) continue;

      let wx: number;
      let wy: number;

      if (hasMap) {
        try {
          const pt = map.project([wave.targetLng, wave.targetLat]);
          wx = pt.x;
          wy = pt.y;
        } catch {
          continue;
        }
      } else {
        wx = wave.fallbackX ?? 0;
        wy = wave.fallbackY ?? 0;
      }

      if (wx < -50 || wx > this.viewportWidth + 50 || wy < -50 || wy > this.viewportHeight + 50) {
        continue;
      }

      const rx = wave.radius * wave.depthScale;
      // La elipse reposa plana sobre el suelo del mapa (inclinación según pitch)
      const ry = rx * Math.max(0.22, Math.cos(pitchRad) * 0.75);

      // Anillo exterior
      this.ctx.strokeStyle = `rgba(180, 225, 255, ${wave.opacity * 0.5 * zoomFade})`;
      this.ctx.lineWidth = 1.3 * wave.depthScale;
      this.ctx.beginPath();
      this.ctx.ellipse(wx, wy, rx, ry, 0, 0, Math.PI * 2);
      this.ctx.stroke();

      // Anillo interior sutil
      this.ctx.strokeStyle = `rgba(215, 242, 255, ${wave.opacity * 0.28 * zoomFade})`;
      this.ctx.lineWidth = 0.8 * wave.depthScale;
      this.ctx.beginPath();
      this.ctx.ellipse(wx, wy, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
  }

  private animate = () => {
    if (!this.isActive) return;

    const now = Date.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    this.update(deltaTime);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.lastTime = Date.now();

    // Distribuir gotas iniciales orgánicamente
    for (const drop of this.raindrops) {
      this.spawnDrop(drop, true);
    }

    this.animate();
  }

  stop() {
    this.isActive = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    }
  }

  setIntensity(intensity: number) {
    this.intensity = Math.max(0, Math.min(1, intensity));
  }

  setWind(directionDegrees: number, speedKmh: number) {
    this.windAngleDeg = directionDegrees;
    this.windSpeedKmh = Math.max(2, Math.min(80, speedKmh));
  }

  syncMapCamera(mapZoom?: number, mapBearing?: number, mapPitch?: number) {
    if (mapZoom !== undefined) this.mapZoom = mapZoom;
    if (mapBearing !== undefined) this.mapBearing = mapBearing;
    if (mapPitch !== undefined) this.mapPitch = mapPitch;
  }

  /**
   * Configura el rango de zoom en el cual la lluvia de escena es visible.
   * @param minZoom Zoom por debajo del cual la lluvia se apaga (0% opacidad).
   * @param fullZoom Zoom a partir del cual la lluvia alcanza 100% de opacidad.
   */
  setZoomRange(minZoom: number, fullZoom: number) {
    this.minRainZoom = minZoom;
    this.fullRainZoom = Math.max(minZoom + 0.1, fullZoom);
  }

  /**
   * Retorna el factor de opacidad actual derivado del nivel de zoom (0.0 a 1.0).
   */
  getZoomFactor(): number {
    const map = this.getMap?.();
    const currentZoom = map && typeof map.getZoom === 'function' ? map.getZoom() : this.mapZoom;
    if (currentZoom <= this.minRainZoom) return 0;
    if (currentZoom >= this.fullRainZoom) return 1;
    return (currentZoom - this.minRainZoom) / (this.fullRainZoom - this.minRainZoom);
  }

  destroy() {
    this.stop();
    if (this.canvas && this.container) {
      this.container.removeChild(this.canvas);
    }
    window.removeEventListener('resize', this.handleResize);
  }
}
