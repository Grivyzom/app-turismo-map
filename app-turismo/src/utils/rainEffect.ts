/**
 * 3D rain effect with perspective projection over map.
 * Raindrops fall from camera toward ground plane, transparent overlay.
 */

interface Raindrop3D {
  x: number; // 3D position
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  opacity: number;
  active: boolean;
  length: number;
}

interface Wave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  active: boolean;
  createdAt: number;
}

export class RainEffect {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private container: HTMLElement | null = null;
  private raindrops: Raindrop3D[] = [];
  private waves: Wave[] = [];
  private animationFrameId: number | null = null;
  private isActive = false;
  private lastTime = Date.now();
  private globalWindAngle = 0;
  private windSpeed = 0.3;
  private mapPitch = 0;
  private mapBearing = 0;

  private readonly dropPoolSize = 200;
  private readonly wavePoolSize = 40;
  private readonly waveLifetime = 800;

  // 3D camera setup
  private cameraZ = 800;
  private viewportWidth = 1024;
  private viewportHeight = 1024;
  private rainFieldDepth = 600;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initCanvas();
    this.initPools();
  }

  private initCanvas() {
    if (!this.container) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1'; // Low z-index, below components
    this.canvas.style.mixBlendMode = 'screen'; // Transparent blend mode

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.container.appendChild(this.canvas);
    this.resizeCanvas();

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;
  }

  private initPools() {
    for (let i = 0; i < this.dropPoolSize; i++) {
      this.raindrops.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        opacity: 0,
        active: false,
        length: 0,
      });
    }

    for (let i = 0; i < this.wavePoolSize; i++) {
      this.waves.push({
        x: 0,
        y: 0,
        radius: 0,
        maxRadius: 0,
        opacity: 0,
        active: false,
        createdAt: 0,
      });
    }
  }

  private getInactiveRaindrop(): Raindrop3D | null {
    for (const drop of this.raindrops) {
      if (!drop.active) return drop;
    }
    return null;
  }

  private getInactiveWave(): Wave | null {
    for (const wave of this.waves) {
      if (!wave.active) return wave;
    }
    return null;
  }

  // Project 3D world point to 2D screen coordinates with pitch & bearing
  private project3D(wx: number, wy: number, wz: number): [number, number, number] {
    const radBearing = (-this.mapBearing * Math.PI) / 180;
    const cosB = Math.cos(radBearing);
    const sinB = Math.sin(radBearing);
    const rx = wx * cosB - wy * sinB;
    const ry = wx * sinB + wy * cosB;

    const cx = rx;
    const cy = -ry;
    const cz = -wz;

    const radPitch = (this.mapPitch * Math.PI) / 180;
    const cosP = Math.cos(radPitch);
    const sinP = Math.sin(radPitch);

    const px = cx;
    const py = cy * cosP + cz * sinP;
    const pz = cz * cosP - cy * sinP;

    const D = this.cameraZ;
    const depth = pz + D;

    if (depth <= 0.1) return [-9999, -9999, 0];

    const scale = D / depth;
    const screenX = this.viewportWidth / 2 + px * scale;
    const screenY = this.viewportHeight / 2 + py * scale;

    return [screenX, screenY, scale];
  }

  private createRaindrop() {
    const drop = this.getInactiveRaindrop();
    if (!drop || !this.canvas) return;

    // Spawn in world coordinates
    const areaSize = this.viewportWidth * 3;
    drop.x = (Math.random() - 0.5) * areaSize;
    drop.y = (Math.random() - 0.5) * areaSize * 2;
    drop.z = this.rainFieldDepth + Math.random() * 200; // altitude
    
    drop.vx = Math.cos(this.globalWindAngle) * this.windSpeed * 15;
    drop.vy = Math.sin(this.globalWindAngle) * this.windSpeed * 15;
    drop.vz = -(25 + Math.random() * 15); // falls down
    
    drop.opacity = 0.5 + Math.random() * 0.3;
    drop.length = 25; // fallback
    drop.active = true;
  }

  private createWave(x: number, y: number) {
    const wave = this.getInactiveWave();
    if (!wave) return;

    wave.x = x;
    wave.y = y;
    wave.radius = 2;
    wave.maxRadius = 40 + Math.random() * 25;
    wave.opacity = 0.7;
    wave.active = true;
    wave.createdAt = Date.now();
  }

  private update(deltaTime: number) {
    if (!this.canvas) return;

    // Update wind
    this.globalWindAngle += 0.001;
    this.windSpeed = 0.3 + Math.sin(this.globalWindAngle * 0.5) * 0.15;

    // Update raindrops
    for (const drop of this.raindrops) {
      if (!drop.active) continue;

      drop.x += drop.vx;
      drop.y += drop.vy;
      drop.z += drop.vz;

      // Create wave when reaching ground plane (Z near 0)
      if (drop.z < 10 && drop.z > -10 && Math.random() < 0.75) {
        this.createWave(drop.x, drop.y);
      }

      // Deactivate if past ground plane
      if (drop.z < -20) {
        drop.active = false;
      }
    }

    // Update waves
    const now = Date.now();
    for (const wave of this.waves) {
      if (!wave.active) continue;

      const elapsed = now - wave.createdAt;
      const progress = elapsed / this.waveLifetime;

      if (progress >= 1) {
        wave.active = false;
      } else {
        wave.radius = wave.maxRadius * progress;
        wave.opacity = 0.7 * (1 - progress);
      }
    }
  }

  private render() {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas completely (no motion blur, clean look)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw raindrops - very transparent
    this.ctx.strokeStyle = 'rgba(200, 235, 255, 0.6)';
    this.ctx.lineWidth = 1.3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (const drop of this.raindrops) {
      if (!drop.active) continue;

      const [screenX, screenY, scale] = this.project3D(drop.x, drop.y, drop.z);

      if (
        screenX < -100 ||
        screenX > this.viewportWidth + 100 ||
        screenY < -100 ||
        screenY > this.viewportHeight + 100 ||
        scale === 0
      ) {
        continue;
      }

      const tailX = drop.x - drop.vx * 1.5;
      const tailY = drop.y - drop.vy * 1.5;
      const tailZ = drop.z - drop.vz * 1.5;
      const [tailScreenX, tailScreenY] = this.project3D(tailX, tailY, tailZ);

      // Fade based on altitude (z) so it doesn't just pop in
      const altitudeFade = Math.max(0, 1 - Math.max(0, drop.z - this.rainFieldDepth * 0.5) / (this.rainFieldDepth * 0.5));
      this.ctx.globalAlpha = drop.opacity * altitudeFade * Math.min(1, scale * 1.5);

      this.ctx.beginPath();
      this.ctx.moveTo(screenX, screenY);
      this.ctx.lineTo(tailScreenX, tailScreenY);
      this.ctx.stroke();
    }

    // Draw waves - subtle
    this.ctx.globalAlpha = 1;
    for (const wave of this.waves) {
      if (!wave.active) continue;

      const [screenX, screenY, scale] = this.project3D(wave.x, wave.y, 0);

      if (screenX < -100 || screenX > this.viewportWidth + 100 || screenY < -100 || screenY > this.viewportHeight + 100 || scale === 0) continue;

      const screenRadiusX = wave.radius * scale;
      const screenRadiusY = wave.radius * scale * Math.max(0.15, Math.cos((this.mapPitch * Math.PI) / 180));

      // Outer ring
      this.ctx.strokeStyle = `rgba(150, 210, 255, ${wave.opacity * 0.5})`;
      this.ctx.lineWidth = 1.8 * scale;
      this.ctx.beginPath();
      this.ctx.ellipse(screenX, screenY, screenRadiusX, screenRadiusY, 0, 0, Math.PI * 2);
      this.ctx.stroke();

      // Inner ring
      this.ctx.strokeStyle = `rgba(180, 225, 255, ${wave.opacity * 0.3})`;
      this.ctx.lineWidth = 0.9 * scale;
      this.ctx.beginPath();
      this.ctx.ellipse(screenX, screenY, screenRadiusX * 0.65, screenRadiusY * 0.65, 0, 0, Math.PI * 2);
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

    // Spawn drops
    if (Math.random() < 0.55) {
      this.createRaindrop();
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.lastTime = Date.now();
    this.animate();
  }

  stop() {
    this.isActive = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  setIntensity(intensity: number) {
    const clamped = Math.max(0, Math.min(1, intensity));
    this.windSpeed = 0.3 + clamped * 0.4;
  }

  // Sync with map camera (handle zoom, pan, rotation)
  syncMapCamera(mapZoom: number, mapBearing: number, mapPitch: number) {
    // Adjust camera depth based on zoom level
    this.cameraZ = 800 - Math.min(5, mapZoom - 10) * 100;
    this.cameraZ = Math.max(400, this.cameraZ);

    this.mapBearing = mapBearing;
    this.mapPitch = mapPitch;
  }

  destroy() {
    this.stop();
    if (this.canvas && this.container) {
      this.container.removeChild(this.canvas);
    }
    window.removeEventListener('resize', () => this.resizeCanvas());
  }
}
