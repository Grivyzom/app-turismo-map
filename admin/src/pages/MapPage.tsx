import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MapPin,
  Trash2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Plus,
  Minus,
  Compass,
  Download,
} from 'lucide-react'
import { sileo } from '../components/ui/Toast'

type MapLayer = 'dark' | 'streets' | 'light' | 'satellite' | 'terrain'

const MAP_LAYER_OPTIONS: { key: MapLayer; label: string }[] = [
  { key: 'dark', label: 'Noche' },
  { key: 'streets', label: 'Calles' },
  { key: 'light', label: 'Claro' },
  { key: 'satellite', label: 'Satélite' },
  { key: 'terrain', label: 'Relieve' },
]
import { api } from '../lib/api'

interface MapEvent {
  id: number
  title: string
  description: string
  startTime: string
  endTime: string
  category: string
  latitude: number
  longitude: number
  emitterType: string
  userEmitterId?: number
  branchEmitterId?: number
  createdAt: string
  sectorName?: string
  targetAudience?: string
  imageUrl?: string
  isLive?: boolean
}

interface MapZone {
  id: number
  name: string
  description: string
  category: string
  color: string
  isActive: boolean
  geojson: any
  eventsCount?: number
}

interface MapBranch {
  id: number
  companyId: number
  companyName: string
  branchName: string
  description: string
  category: string
  address: string
  phone: string
  latitude: number
  longitude: number
  imageUrl: string
  targetAudience: string
  createdAt: string
  sectorName?: string
}

interface EventResponse {
  success: boolean
  events: MapEvent[]
}

interface ZoneResponse {
  success: boolean
  zones: MapZone[]
}

interface BranchResponse {
  success: boolean
  branches: MapBranch[]
}

interface Cycleway {
  id: string
  eje: string
  inicio: string
  fin: string
  km: number
  coordinates: [number, number][]
}

// Inyección dinámica de Leaflet para evitar problemas de dependencias
function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve()
      return
    }

    // Leaflet CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    // Leaflet JS
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const heatScript = document.createElement('script')
      heatScript.src = 'https://unpkg.com/leaflet.heat/dist/leaflet-heat.js'
      heatScript.onload = () => resolve()
      heatScript.onerror = () => reject(new Error('Error al cargar Leaflet Heat'))
      document.body.appendChild(heatScript)
    }
    script.onerror = () => reject(new Error('Error al cargar Leaflet'))
    document.body.appendChild(script)
  })
}

export default function MapPage() {
  const [events, setEvents] = useState<MapEvent[]>([])
  const [zones, setZones] = useState<MapZone[]>([])
  const [branches, setBranches] = useState<MapBranch[]>([])
  const [cycleways, setCycleways] = useState<Cycleway[]>([])
  const [faunaTypes, setFaunaTypes] = useState<{id: number, name: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<MapBranch | null>(null)
  const [selectedCycleway, setSelectedCycleway] = useState<Cycleway | null>(null)
  const [activeSidebarTab, setActiveSidebarTab] = useState<'events' | 'sectors' | 'branches' | 'cycleways'>('events')
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deletingBranchId, setDeletingBranchId] = useState<number | null>(null)
  const [togglingZoneId, setTogglingZoneId] = useState<number | null>(null)

  // Vista y filtros de público (Local / Turista)
  const [viewMode, setViewMode] = useState<'all' | 'local' | 'tourist'>('all')
  const [togglingMode, setTogglingMode] = useState(false)

  const filteredEvents = events.filter(e => {
    if (viewMode === 'all') return true
    return e.targetAudience === viewMode
  })

  const filteredBranches = branches.filter(b => {
    if (viewMode === 'all') return true
    return b.targetAudience === viewMode
  })

  const handleToggleViewMode = (newMode: 'all' | 'local' | 'tourist') => {
    if (newMode === viewMode || togglingMode) return

    setTogglingMode(true)

    // Simulamos un retraso de carga para mostrar el Promise Toast de sileo
    const filterPromise = new Promise<'success'>((resolve) => {
      setTimeout(() => {
        setViewMode(newMode)
        resolve('success')
      }, 800)
    })

    const modeLabels = {
      all: 'Todo Público',
      local: 'Residentes Locales',
      tourist: 'Sólo Turistas'
    }

    sileo.promise(filterPromise, {
      loading: {
        title: `Cargando: ${modeLabels[newMode]}`,
        description: 'Filtrando marcadores y recalculando rutas...'
      },
      success: {
        title: `Vista: ${modeLabels[newMode]}`,
        description: 'Se actualizaron los marcadores del mapa.'
      },
      error: {
        title: 'Error al cambiar vista',
        description: 'Ocurrió un problema al cargar los marcadores.'
      }
    }).finally(() => {
      setTogglingMode(false)
    })
  }

  // Estados de control del mapa con estilo Obsidian
  const [currentLayer, setCurrentLayer] = useState<MapLayer>('dark')
  const [layersMenuOpen, setLayersMenuOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)

  // Estados para creación de puntos
  const [createMode, setCreateMode] = useState(false)
  const [tempMarkerCoords, setTempMarkerCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [savingPoint, setSavingPoint] = useState(false)
  const [createForm, setCreateForm] = useState({
    type: 'event' as string,
    title: '',
    description: '',
    category: '',
    address: '',
    phone: '',
    imageUrl: '',
    targetAudience: 'all' as 'all' | 'local' | 'tourist',
    startTime: '',
    endTime: '',
  })

  const [isEditingCycleway, setIsEditingCycleway] = useState(false)
  const [drawOnMapMode, setDrawOnMapMode] = useState(false)
  const [cyclewayForm, setCyclewayForm] = useState<Cycleway>({
    id: '',
    eje: '',
    inicio: '',
    fin: '',
    km: 0,
    coordinates: []
  })

  const [isEditingZone, setIsEditingZone] = useState(false)
  const [drawZoneMode, setDrawZoneMode] = useState(false)
  const [zoneForm, setZoneForm] = useState<{
    name: string
    description: string
    category: string
    color: string
    coordinates: [number, number][]
  }>({
    name: '',
    description: '',
    category: 'ciudad',
    color: '#EC4899',
    coordinates: []
  })

  const cyclewaysGroupRef = useRef<any>(null)
  const activeDrawingLayerRef = useRef<any>(null)
  const activeZoneDrawingLayerRef = useRef<any>(null)
  const drawOnMapModeRef = useRef(drawOnMapMode)
  const drawZoneModeRef = useRef(drawZoneMode)
  const cyclewayFormRef = useRef(cyclewayForm)
  const zoneFormRef = useRef(zoneForm)

  useEffect(() => {
    drawOnMapModeRef.current = drawOnMapMode
  }, [drawOnMapMode])

  useEffect(() => {
    drawZoneModeRef.current = drawZoneMode
  }, [drawZoneMode])

  useEffect(() => {
    cyclewayFormRef.current = cyclewayForm
  }, [cyclewayForm])

  useEffect(() => {
    zoneFormRef.current = zoneForm
  }, [zoneForm])

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersGroupRef = useRef<any>(null)
  const zonesGroupRef = useRef<any>(null)
  const markersRef = useRef<Record<number, any>>({})
  const branchMarkersRef = useRef<Record<number, any>>({})
  const tileLayerRef = useRef<any>(null)
  const userLocationMarkerRef = useRef<any>(null)
  const tempMarkerRef = useRef<any>(null)
  const heatmapLayerRef = useRef<any>(null)
  const createModeRef = useRef(createMode)

  useEffect(() => {
    createModeRef.current = createMode
  }, [createMode])

  useEffect(() => {
    if (leafletLoaded && mapInstanceRef.current && (window as any).L && (window as any).L.heatLayer) {
      if (showHeatmap) {
        const L = (window as any).L
        if (heatmapLayerRef.current) {
          mapInstanceRef.current.removeLayer(heatmapLayerRef.current)
        }
        const heatPoints = filteredEvents.map(e => [e.latitude, e.longitude, 1])
        heatmapLayerRef.current = L.heatLayer(heatPoints, { radius: 25, blur: 15, maxZoom: 15 }).addTo(mapInstanceRef.current)
      } else {
        if (heatmapLayerRef.current) {
          mapInstanceRef.current.removeLayer(heatmapLayerRef.current)
          heatmapLayerRef.current = null
        }
      }
    }
  }, [showHeatmap, filteredEvents, leafletLoaded])

  // Cargar Leaflet y luego los datos
  useEffect(() => {
    loadLeaflet()
      .then(() => {
        setLeafletLoaded(true)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [eventsRes, zonesRes, branchesRes, faunaRes, cyclewaysRes] = await Promise.all([
        api.get<EventResponse>('/admin/api/v1/events'),
        api.get<ZoneResponse>('/admin/api/v1/zones'),
        api.get<BranchResponse>('/admin/api/v1/branches').catch(() => ({ success: false, branches: [] })),
        api.get<any[]>('/admin/api/v1/fauna-types').catch(() => []),
        api.get<Cycleway[]>('/api/v1/cycleways').catch(() => [])
      ])

      if (eventsRes.success) {
        setEvents(eventsRes.events)
      }
      if (zonesRes.success) {
        setZones(zonesRes.zones)
      }
      if (branchesRes.success) {
        setBranches(branchesRes.branches)
      }
      if (Array.isArray(faunaRes)) {
        setFaunaTypes(faunaRes)
      }
      if (Array.isArray(cyclewaysRes)) {
        setCycleways(cyclewaysRes)
      }

      if (!eventsRes.success && !zonesRes.success) {
        throw new Error('Error al sincronizar datos del mapa')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (leafletLoaded) {
      fetchData()
    }
  }, [leafletLoaded, fetchData])

  // Inicializar mapa de Leaflet
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return

    const L = (window as any).L
    // Valdivia, Chile por defecto (Selva Valdiviana)
    const defaultCenter = [-39.8142, -73.2459]
    const defaultZoom = 13

    // Crear mapa
    const map = L.map(mapContainerRef.current, {
      zoomControl: false
    }).setView(defaultCenter, defaultZoom)

    mapInstanceRef.current = map
    zonesGroupRef.current = L.featureGroup().addTo(map)
    markersGroupRef.current = L.featureGroup().addTo(map)
    cyclewaysGroupRef.current = L.featureGroup().addTo(map)

    map.on('click', (e: any) => {
      if (createModeRef.current) {
        const { lat, lng } = e.latlng
        setTempMarkerCoords({ lat, lng })
        setSelectedEvent(null)
        setSelectedBranch(null)
        setSelectedCycleway(null)
      } else if (drawOnMapModeRef.current) {
        const { lat, lng } = e.latlng
        const newCoords = [...cyclewayFormRef.current.coordinates, [lng, lat]] as [number, number][]
        setCyclewayForm(prev => ({
          ...prev,
          coordinates: newCoords
        }))
      } else if (drawZoneModeRef.current) {
        const { lat, lng } = e.latlng
        const newCoords = [...zoneFormRef.current.coordinates, [lng, lat]] as [number, number][]
        setZoneForm(prev => ({
          ...prev,
          coordinates: newCoords
        }))
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersGroupRef.current = null
        zonesGroupRef.current = null
        cyclewaysGroupRef.current = null
        tileLayerRef.current = null
        userLocationMarkerRef.current = null
        tempMarkerRef.current = null
      }
    }
  }, [leafletLoaded])

  // Manejar el marcador temporal en modo de creación
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return
    const L = (window as any).L
    const map = mapInstanceRef.current

    if (tempMarkerRef.current) {
      map.removeLayer(tempMarkerRef.current)
      tempMarkerRef.current = null
    }

    if (!tempMarkerCoords) return

    const tempIcon = L.divIcon({
      html: `
        <div class="temp-pulse-marker" style="
          background: #f59e0b;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 10px #f59e0b;
        "></div>
      `,
      className: 'temp-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })

    tempMarkerRef.current = L.marker([tempMarkerCoords.lat, tempMarkerCoords.lng], { icon: tempIcon })
      .addTo(map)

    map.setView([tempMarkerCoords.lat, tempMarkerCoords.lng])
  }, [tempMarkerCoords, leafletLoaded])

  // Capas del mapa reactivas
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return
    const L = (window as any).L
    const map = mapInstanceRef.current

    // Remover capa previa si existe
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current)
    }

    let url = ''
    let attribution = ''
    let subdomains = 'abcd'
    let maxZoom = 20

    switch (currentLayer) {
      case 'dark':
        url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        attribution = '&copy; OpenStreetMap &copy; CARTO'
        break
      case 'streets':
        url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        attribution = '&copy; OpenStreetMap &copy; CARTO'
        break
      case 'light':
        url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        attribution = '&copy; OpenStreetMap &copy; CARTO'
        break
      case 'satellite':
        url = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        break
      case 'terrain':
        url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
        attribution = 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
        maxZoom = 17
        break
    }

    tileLayerRef.current = L.tileLayer(url, {
      attribution,
      subdomains,
      maxZoom
    }).addTo(map)
  }, [currentLayer, leafletLoaded])

  // Geolocalización
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      sileo.error({
        title: 'Error de compatibilidad',
        description: 'La geolocalización no está soportada por su navegador.'
      })
      return
    }

    setLocating(true)

    const locationPromise = new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })

    sileo.promise(locationPromise, {
      loading: {
        title: 'Obteniendo ubicación...',
        description: 'Buscando coordenadas GPS...'
      },
      success: {
        title: 'Ubicación obtenida',
        description: 'Se ha centrado el mapa en su posición.'
      },
      error: {
        title: 'Error al ubicar',
        description: 'No se pudo obtener la geolocalización o se denegó el acceso.'
      }
    })

    locationPromise
      .then(({ latitude, longitude, accuracy }) => {
        if (mapInstanceRef.current) {
          const L = (window as any).L
          const map = mapInstanceRef.current
          
          // Centrar mapa
          map.setView([latitude, longitude], 15)

          // Remover marcador previo si existe
          if (userLocationMarkerRef.current) {
            map.removeLayer(userLocationMarkerRef.current)
          }

          // Crear marcador personalizado con efecto de pulso
          const pulsingIcon = L.divIcon({
            html: '<div class="pulsing-location-dot"></div>',
            className: 'user-location-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })

          userLocationMarkerRef.current = L.marker([latitude, longitude], { icon: pulsingIcon }).addTo(map)

          // Bind a simple popup
          userLocationMarkerRef.current.bindPopup(`
            <div style="color: #1a201f; font-family: system-ui, sans-serif; font-size: 11px; padding: 4px;">
              <strong>Su ubicación actual</strong><br/>
              Precisión: +/- ${Math.round(accuracy)}m
            </div>
          `).openPopup()
        }
      })
      .catch((error) => {
        console.error('Error getting location:', error)
      })
      .finally(() => {
        setLocating(false)
      })
  }

  // Renderizar marcadores en el mapa cuando cambien los eventos o tiendas
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !markersGroupRef.current) return

    const L = (window as any).L

    // Limpiar marcadores antiguos
    markersGroupRef.current.clearLayers()
    markersRef.current = {}
    branchMarkersRef.current = {}

    // 1. Renderizar eventos
    filteredEvents.forEach(event => {
      const isFauna = event.category?.toLowerCase() === 'fauna'
      const isBusiness = event.emitterType === 'business'
      const color = isFauna ? '#3b82f6' : (isBusiness ? '#0d9488' : '#10b981') // Azul para Fauna
      const pinHtml = `
        <div style="position: relative;">
          ${event.isLive ? `<div style="position: absolute; top: -8px; left: -8px; width: 44px; height: 44px; background: rgba(239, 68, 68, 0.5); border-radius: 50%; animation: map-pulse 2s infinite ease-out;"></div>` : ''}
          <div style="
            position: relative;
            background: ${event.isLive ? '#ef4444' : color}; 
            width: 28px; 
            height: 28px; 
            border-radius: 50%; 
            border: 2px solid white; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
            z-index: 2;
          ">
            ${isFauna ? '🐾' : event.title.charAt(0).toUpperCase()}
          </div>
        </div>
      `

      const customIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-map-marker-event',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })

      const marker = L.marker([event.latitude, event.longitude], { icon: customIcon })
        .addTo(markersGroupRef.current)

      marker.bindPopup(`
        <div style="color: #1a201f; font-family: system-ui, sans-serif; min-width: 160px; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700;">${event.title}</h4>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #4b5563; line-height: 1.4;">${event.description || 'Sin descripción'}</p>
          <div style="font-size: 10px; font-weight: 600; color: ${color}; text-transform: uppercase;">
            ${event.category}
          </div>
        </div>
      `)

      marker.on('click', () => {
        if (isFauna) {
          setSelectedEvent(null)
        } else {
          setSelectedEvent(event)
        }
        setSelectedBranch(null)
      })

      markersRef.current[event.id] = marker
    })

    // 2. Renderizar tiendas/sucursales
    filteredBranches.forEach(branch => {
      const color = '#4f46e5' // Indigo para tiendas
      const pinHtml = `
        <div style="
          background: ${color}; 
          width: 28px; 
          height: 28px; 
          border-radius: 50%; 
          border: 2px solid white; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
        ">
          🏪
        </div>
      `

      const customIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-map-marker-branch',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })

      const marker = L.marker([branch.latitude, branch.longitude], { icon: customIcon })
        .addTo(markersGroupRef.current)

      marker.bindPopup(`
        <div style="color: #1a201f; font-family: system-ui, sans-serif; min-width: 180px; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700;">${branch.branchName}</h4>
          ${branch.imageUrl ? `<img src="${branch.imageUrl}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px; margin-bottom: 6px;" />` : ''}
          <p style="margin: 0 0 6px 0; font-size: 11px; color: #4b5563; line-height: 1.4;">${branch.description || 'Sin descripción'}</p>
          ${branch.address ? `<div style="font-size: 10px; color: #6b7280; margin-bottom: 2px;">📍 ${branch.address}</div>` : ''}
          ${branch.phone ? `<div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">📞 ${branch.phone}</div>` : ''}
          <div style="font-size: 10px; font-weight: 600; color: #4f46e5; text-transform: uppercase;">
            ${branch.category || 'TIENDA'} (${branch.companyName})
          </div>
        </div>
      `)

      marker.on('click', () => {
        setSelectedBranch(branch)
        setSelectedEvent(null)
      })

      branchMarkersRef.current[branch.id] = marker
    })

    // El mapa se mantiene centrado en Valdivia por defecto
  }, [filteredEvents, filteredBranches, leafletLoaded])

  // Renderizar zonas (sectores) en el mapa
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !zonesGroupRef.current) return

    const L = (window as any).L
    zonesGroupRef.current.clearLayers()

    zones.forEach(zone => {
      if (!zone.isActive) return

      try {
        const geojson = typeof zone.geojson === 'string' ? JSON.parse(zone.geojson) : zone.geojson
        const layer = L.geoJSON(geojson, {
          style: {
            color: zone.color || '#10B981',
            weight: 2,
            opacity: 0.6,
            fillColor: zone.color || '#10B981',
            fillOpacity: 0.1
          }
        }).addTo(zonesGroupRef.current)

        layer.bindPopup(`
          <div style="color: #1a201f; font-family: system-ui, sans-serif; padding: 4px;">
            <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700;">${zone.name}</h4>
            <div style="font-size: 10px; font-weight: 600; color: #10b981; text-transform: uppercase;">
              ${zone.category || 'Sector'}
            </div>
          </div>
        `)
      } catch (e) {
        console.error('Error rendering zone geojson:', e)
      }
    })
  }, [zones, leafletLoaded])

  // Renderizar ciclovías en el mapa
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !cyclewaysGroupRef.current) return

    const L = (window as any).L
    cyclewaysGroupRef.current.clearLayers()

    cycleways.forEach(c => {
      try {
        const coords = c.coordinates.map(([lng, lat]) => [lat, lng]) // Leaflet uses [lat, lng]
        if (coords.length < 2) return

        // Base/BG path (dark blue for glow outline)
        L.polyline(coords, {
          color: '#072030',
          weight: 8,
          opacity: 0.8
        }).addTo(cyclewaysGroupRef.current)

        // Main path (celeste neon)
        const lineLayer = L.polyline(coords, {
          color: '#00d2ff',
          weight: 4,
          opacity: 1.0,
          dashArray: '5, 10'
        }).addTo(cyclewaysGroupRef.current)

        lineLayer.bindPopup(`
          <div style="color: #1a201f; font-family: system-ui, sans-serif; padding: 4px;">
            <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; display:flex; align-items:center; gap:6px;">
              <span>🚲</span> ${c.eje || 'Ciclovía'}
            </h4>
            <div style="font-size: 11px; color: #666; line-height: 1.6;">
              <div>Desde: <b>${c.inicio || 'No especificado'}</b></div>
              <div>Hasta: <b>${c.fin || 'No especificado'}</b></div>
              <div>Largo: <b style="color: #00bfff;">${c.km} km</b></div>
            </div>
          </div>
        `)
      } catch (e) {
        console.error('Error rendering cycleway:', e)
      }
    })
  }, [cycleways, leafletLoaded])

  // Dibujo activo de ciclovía en tiempo real
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return
    const L = (window as any).L
    const map = mapInstanceRef.current

    if (activeDrawingLayerRef.current) {
      map.removeLayer(activeDrawingLayerRef.current)
      activeDrawingLayerRef.current = null
    }

    if (drawOnMapMode && cyclewayForm.coordinates.length > 0) {
      const coords = cyclewayForm.coordinates.map(([lng, lat]) => [lat, lng])
      activeDrawingLayerRef.current = L.polyline(coords, {
        color: '#ff9900', // naranja vibrante
        weight: 4,
        opacity: 0.8,
        dashArray: '5, 5'
      }).addTo(map)
    }

    return () => {
      if (activeDrawingLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(activeDrawingLayerRef.current)
      }
    }
  }, [cyclewayForm.coordinates, drawOnMapMode, leafletLoaded])

  // Dibujo activo de sector (zona) en tiempo real
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return
    const L = (window as any).L
    const map = mapInstanceRef.current

    if (activeZoneDrawingLayerRef.current) {
      map.removeLayer(activeZoneDrawingLayerRef.current)
      activeZoneDrawingLayerRef.current = null
    }

    if (drawZoneMode && zoneForm.coordinates.length > 0) {
      const coords = zoneForm.coordinates.map(([lng, lat]) => [lat, lng])
      activeZoneDrawingLayerRef.current = L.polygon(coords, {
        color: zoneForm.color || '#EC4899',
        weight: 3,
        opacity: 0.8,
        fillColor: zoneForm.color || '#EC4899',
        fillOpacity: 0.2,
        dashArray: '5, 5'
      }).addTo(map)
    }

    return () => {
      if (activeZoneDrawingLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(activeZoneDrawingLayerRef.current)
      }
    }
  }, [zoneForm.coordinates, zoneForm.color, drawZoneMode, leafletLoaded])

  const handleSaveCycleway = async (data: Cycleway) => {
    const savePromise = api.post<{ success: boolean; message: string }>('/admin/api/v1/cycleways', data)
      .then(res => {
        if (!res.success) throw new Error(res.message || 'Error al guardar la ciclovía')
        return res
      })

    sileo.promise(savePromise, {
      loading: {
        title: 'Guardando ciclovía...',
        description: 'Registrando el trazado de la ciclovía en el servidor...'
      },
      success: {
        title: 'Ciclovía guardada',
        description: 'La ciclovía se ha guardado exitosamente.'
      },
      error: {
        title: 'Error al guardar',
        description: 'No se pudo guardar la ciclovía.'
      }
    })

    try {
      await savePromise
      fetchData()
      setSelectedCycleway(null)
      setIsEditingCycleway(false)
      setDrawOnMapMode(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveZone = async () => {
    if (zoneForm.coordinates.length < 3) {
      sileo.error({
        title: 'Sector incompleto',
        description: 'Se requieren al menos 3 puntos para crear un sector.'
      })
      return
    }
    if (!zoneForm.name.trim()) {
      sileo.error({
        title: 'Campo obligatorio',
        description: 'El nombre del sector es obligatorio.'
      })
      return
    }
    
    const payload = {
      name: zoneForm.name,
      description: zoneForm.description,
      category: zoneForm.category,
      color: zoneForm.color,
      points: zoneForm.coordinates.map((coord, i) => ({
        latitude: coord[1],
        longitude: coord[0],
        orderIndex: i,
        pointType: 'sector'
      }))
    }

    const savePromise = api.post<{ success: boolean; message: string }>('/api/v1/zones', payload)
      .then(res => {
        if (!res.success) throw new Error(res.message || 'Error al guardar el sector')
        return res
      })

    sileo.promise(savePromise, {
      loading: {
        title: 'Guardando sector...',
        description: 'Registrando el sector en el servidor...'
      },
      success: {
        title: 'Sector guardado',
        description: 'El sector se ha guardado correctamente.'
      },
      error: {
        title: 'Error al guardar',
        description: 'No se pudo registrar el sector.'
      }
    })

    try {
      await savePromise
      fetchData()
      setIsEditingZone(false)
      setDrawZoneMode(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteCycleway = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta ciclovía?')) return

    const deletePromise = api.post<{ success: boolean; message: string }>('/admin/api/v1/cycleways/delete', { id })
      .then(res => {
        if (!res.success) throw new Error(res.message || 'Error al eliminar la ciclovía')
        return res
      })

    sileo.promise(deletePromise, {
      loading: {
        title: 'Eliminando ciclovía...',
        description: 'Procesando la solicitud de eliminación...'
      },
      success: {
        title: 'Ciclovía eliminada',
        description: 'La ciclovía se eliminó exitosamente.'
      },
      error: {
        title: 'Error al eliminar',
        description: 'No se pudo eliminar la ciclovía.'
      }
    })

    try {
      await deletePromise
      fetchData()
      setSelectedCycleway(null)
    } catch (err) {
      console.error(err)
    }
  }

  // Enfocar un marcador de evento
  const handleSelectEvent = (event: MapEvent) => {
    if (event.category?.toLowerCase() === 'fauna') {
      setSelectedEvent(null)
    } else {
      setSelectedEvent(event)
    }
    setSelectedBranch(null)
    if (mapInstanceRef.current && markersRef.current[event.id]) {
      const marker = markersRef.current[event.id]
      mapInstanceRef.current.setView([event.latitude, event.longitude], 16)
      marker.openPopup()
    }
  }

  // Enfocar un marcador de tienda/sucursal
  const handleSelectBranch = (branch: MapBranch) => {
    setSelectedBranch(branch)
    setSelectedEvent(null)
    if (mapInstanceRef.current && branchMarkersRef.current[branch.id]) {
      const marker = branchMarkersRef.current[branch.id]
      mapInstanceRef.current.setView([branch.latitude, branch.longitude], 16)
      marker.openPopup()
    }
  }

  // Alternar estado de zona (activar/desactivar)
  const handleToggleZone = async (zone: MapZone) => {
    const actionLabel = zone.isActive ? 'Desactivando' : 'Activando'
    const togglePromise = api.post<{ success: boolean; message: string }>('/admin/api/v1/zones/toggle', {
      zoneId: zone.id,
      isActive: !zone.isActive
    }).then(res => {
      if (!res.success) throw new Error(res.message || 'Error al actualizar la zona')
      return res
    })

    sileo.promise(togglePromise, {
      loading: {
        title: `${actionLabel} sector...`,
        description: 'Actualizando estado en el servidor...'
      },
      success: {
        title: 'Sector actualizado',
        description: `El sector se ha ${zone.isActive ? 'desactivado' : 'activado'} correctamente.`
      },
      error: {
        title: 'Error de actualización',
        description: 'No se pudo cambiar el estado del sector.'
      }
    })

    try {
      setTogglingZoneId(zone.id)
      await togglePromise
      setZones(prev => prev.map(z => z.id === zone.id ? { ...z, isActive: !z.isActive } : z))
    } catch (err) {
      console.error(err)
    } finally {
      setTogglingZoneId(null)
    }
  }

  // Eliminar un marcador/evento
  const handleDeleteEvent = async (eventId: number) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este evento del mapa permanentemente?')) return

    const deletePromise = api.post<{ success: boolean; message: string }>('/admin/api/v1/events/delete', {
      eventId
    }).then(res => {
      if (!res.success) throw new Error(res.message || 'Error al eliminar el evento')
      return res
    })

    sileo.promise(deletePromise, {
      loading: {
        title: 'Eliminando pin/evento...',
        description: 'Eliminando el marcador de forma permanente...'
      },
      success: {
        title: 'Marcador eliminado',
        description: 'El pin/evento se eliminó exitosamente.'
      },
      error: {
        title: 'Error al eliminar',
        description: 'No se pudo eliminar el marcador.'
      }
    })

    try {
      setDeletingId(eventId)
      await deletePromise
      setEvents(prev => prev.filter(e => e.id !== eventId))
      if (selectedEvent?.id === eventId) {
        setSelectedEvent(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleLiveEvent = async (eventId: number, currentIsLive: boolean) => {
    const actionLabel = currentIsLive ? 'Finalizando transmisión en vivo' : 'Iniciando transmisión en vivo'
    const livePromise = api.post<{ success: boolean; message: string }>('/admin/api/v1/events/live', {
      eventId,
      isLive: !currentIsLive
    }).then(res => {
      if (!res.success) throw new Error(res.message || 'Error al actualizar estado en vivo')
      return res
    })

    sileo.promise(livePromise, {
      loading: {
        title: 'Actualizando estado en vivo...',
        description: `${actionLabel}...`
      },
      success: {
        title: 'Estado actualizado',
        description: `El evento ahora está ${!currentIsLive ? 'EN VIVO' : 'finalizado'}.`
      },
      error: {
        title: 'Error en vivo',
        description: 'No se pudo cambiar el estado de transmisión.'
      }
    })

    try {
      await livePromise
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isLive: !currentIsLive } : e))
      if (selectedEvent?.id === eventId) {
        setSelectedEvent(prev => prev ? { ...prev, isLive: !currentIsLive } : null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleExportCSV = () => {
    if (events.length === 0) {
      sileo.warning({
        title: 'Exportación vacía',
        description: 'No hay eventos para exportar en este momento.'
      })
      return
    }
    const headers = ["ID", "Título", "Categoría", "Tipo Emisor", "En Vivo", "Latitud", "Longitud", "Inicio", "Fin"]
    const rows = events.map(e => [
      e.id,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.emitterType,
      e.isLive ? "Sí" : "No",
      e.latitude,
      e.longitude,
      e.startTime,
      e.endTime
    ])
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(r => r.join(",")).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `eventos_mapa_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Eliminar una sucursal/tienda
  const handleDeleteBranch = async (branchId: number) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta tienda/sucursal permanentemente?')) return

    const deletePromise = api.post<{ success: boolean; message: string }>('/admin/api/v1/branches/delete', {
      branchId
    }).then(res => {
      if (!res.success) throw new Error(res.message || 'Error al eliminar la tienda')
      return res
    })

    sileo.promise(deletePromise, {
      loading: {
        title: 'Eliminando tienda...',
        description: 'Procesando eliminación en el servidor...'
      },
      success: {
        title: 'Tienda eliminada',
        description: 'La sucursal se eliminó exitosamente.'
      },
      error: {
        title: 'Error al eliminar',
        description: 'No se pudo eliminar la tienda.'
      }
    })

    try {
      setDeletingBranchId(branchId)
      await deletePromise
      setBranches(prev => prev.filter(b => b.id !== branchId))
      if (selectedBranch?.id === branchId) {
        setSelectedBranch(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingBranchId(null)
    }
  }

  // Guardar un nuevo punto en la base de datos
  const handleSavePoint = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempMarkerCoords) return

    if (!createForm.title || !createForm.category) {
      sileo.error({
        title: 'Formulario incompleto',
        description: 'Por favor complete el título y la categoría.'
      })
      return
    }

    const isFaunaType = createForm.type === 'Fauna'
    const label = createForm.type === 'event' ? 'Pin/Evento' : (isFaunaType ? 'Fauna' : 'Tienda/Sucursal')

    const savePromise = (async () => {
      setSavingPoint(true)
      const isFaunaType = createForm.type === 'Fauna'
      
      if (createForm.type === 'event' || isFaunaType) {
        const finalCategory = isFaunaType ? 'fauna' : createForm.category
        const finalDescription = isFaunaType
          ? `[${createForm.category}] ${createForm.description || 'Sin descripción adicional.'}`
          : createForm.description

        const defaultFaunaImage = 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&q=80&w=800'
        const finalImageUrl = createForm.imageUrl || (isFaunaType ? defaultFaunaImage : '')

        const res = await api.post<{ success: boolean; message: string }>('/admin/api/v1/events', {
          title: createForm.title,
          description: finalDescription,
          startTime: createForm.startTime || new Date().toISOString(),
          endTime: createForm.endTime || new Date(Date.now() + 2 * 3600000).toISOString(),
          category: finalCategory,
          latitude: tempMarkerCoords.lat,
          longitude: tempMarkerCoords.lng,
          emitterType: 'citizen',
          targetAudience: createForm.targetAudience,
          imageUrl: finalImageUrl
        })

        if (!res.success) throw new Error(res.message || 'Error al crear el pin')
        return res
      } else {
        const res = await api.post<{ success: boolean; message: string }>('/admin/api/v1/branches', {
          branchName: createForm.title,
          description: createForm.description,
          category: createForm.category,
          address: createForm.address,
          phone: createForm.phone,
          latitude: tempMarkerCoords.lat,
          longitude: tempMarkerCoords.lng,
          imageUrl: createForm.imageUrl,
          targetAudience: createForm.targetAudience
        })

        if (!res.success) throw new Error(res.message || 'Error al crear la tienda')
        return res
      }
    })()

    sileo.promise(savePromise, {
      loading: {
        title: `Creando ${label}...`,
        description: 'Guardando datos en el servidor...'
      },
      success: {
        title: `${label} creado`,
        description: 'El elemento se ha creado exitosamente.'
      },
      error: {
        title: `Error al crear ${label}`,
        description: 'Ocurrió un error al guardar.'
      }
    })

    savePromise
      .then(() => {
        handleCancelCreation()
        fetchData()
      })
      .catch((err) => {
        console.error('Error saving point:', err)
      })
      .finally(() => {
        setSavingPoint(false)
      })
  }

  const handleCancelCreation = () => {
    setCreateMode(false)
    setTempMarkerCoords(null)
    setCreateForm({
      type: 'event',
      title: '',
      description: '',
      category: '',
      address: '',
      phone: '',
      imageUrl: '',
      targetAudience: 'all',
      startTime: '',
      endTime: '',
    })
  }

  return (
    <div className="map-page-layout" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - var(--topbar-height) - 40px)',
      gap: '20px'
    }}>
      {/* Dynamic CSS styles for Obsidian Glassmorphism Controls */}
      <style dangerouslySetInnerHTML={{ __html: `
        .obsidian-glass-toolbar {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end;
        }
        .obsidian-glass-pill {
          background: rgba(34, 34, 34, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        .obsidian-glass-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f3f4f6;
          background: transparent;
          transition: all 150ms ease;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .obsidian-glass-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .obsidian-glass-btn.active {
          color: #34d399;
          background: rgba(52, 211, 153, 0.15);
          border: 1px solid rgba(52, 211, 153, 0.3);
        }
        .obsidian-glass-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 2px 4px;
        }
        .obsidian-layers-panel {
          background: rgba(20, 26, 24, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 160px;
          animation: fadeIn 200ms ease;
        }
        .obsidian-layers-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          color: #9ca3af;
          margin-bottom: 4px;
          letter-spacing: 0.05em;
        }
        .obsidian-layer-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 0.8125rem;
          color: #9ca3af;
          cursor: pointer;
          transition: all 150ms ease;
          border: 1px solid transparent;
        }
        .obsidian-layer-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #f3f4f6;
        }
        .obsidian-layer-item.active {
          background: rgba(52, 211, 153, 0.08);
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.25);
        }
        .obsidian-layer-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: transparent;
        }
        .obsidian-layer-item.active .obsidian-layer-dot {
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
        }
        @keyframes map-pulse {
          0% {
            transform: scale(0.6);
            opacity: 1;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        .pulsing-location-dot {
          position: relative;
          width: 16px;
          height: 16px;
          background-color: #3b82f6;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.8);
        }
        .pulsing-location-dot::after {
          content: '';
          position: absolute;
          top: -8px;
          left: -8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background-color: rgba(59, 130, 246, 0.4);
          animation: map-pulse 2s infinite ease-out;
        }
      ` }} />

      <div className="dashboard-header" style={{ marginBottom: '0', display: 'none' }}>
      </div>

      {error && (
        <div className="dashboard-error" style={{ margin: '0 0 10px 0' }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={fetchData} className="dashboard-error-retry">
            Reintentar
          </button>
        </div>
      )}

      <div className="map-content-container" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        flex: 1,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)'
      }}>
        {/* Leaflet Map Div */}
        <div style={{ position: 'relative', width: '100%', height: '100%' }} className={createMode ? 'admin-leaflet-map-create-mode' : ''}>
          <div
            ref={mapContainerRef}
            id="admin-leaflet-map"
            style={{
              width: '100%',
              height: '100%',
              background: '#0a0d0d',
              zIndex: 10,
              cursor: createMode ? 'crosshair' : 'grab'
            }}
          />

          {/* Obsidian Glassmorphism Control Bar */}
          {leafletLoaded && mapInstanceRef.current && (
            <div className="obsidian-glass-toolbar">
              <div className="obsidian-glass-pill">
                <button
                  className="obsidian-glass-btn"
                  onClick={() => mapInstanceRef.current?.zoomIn()}
                  title="Acercar"
                >
                  <Plus size={18} />
                </button>
                <button
                  className="obsidian-glass-btn"
                  onClick={() => mapInstanceRef.current?.zoomOut()}
                  title="Alejar"
                >
                  <Minus size={18} />
                </button>
                <div className="obsidian-glass-divider" />
                <button
                  className={`obsidian-glass-btn ${createMode ? 'active' : ''}`}
                  onClick={() => {
                    if (createMode) {
                      handleCancelCreation()
                    } else {
                      setCreateMode(true)
                      setSelectedEvent(null)
                      setSelectedBranch(null)
                    }
                  }}
                  title={createMode ? "Cancelar creación" : "Ubicar nuevo pin, evento o tienda"}
                  style={{ color: createMode ? '#f59e0b' : 'inherit' }}
                >
                  <MapPin size={18} />
                </button>
                <div className="obsidian-glass-divider" />
                <button
                  className={`obsidian-glass-btn ${locating ? 'active' : ''}`}
                  onClick={handleLocateMe}
                  disabled={locating}
                  title="Mi ubicación"
                >
                  <Compass size={18} className={locating ? 'spin' : ''} />
                </button>
                <div className="obsidian-glass-divider" />
                <button
                  className={`obsidian-glass-btn`}
                  onClick={handleExportCSV}
                  title="Exportar Eventos a CSV"
                >
                  <Download size={18} />
                </button>
                <div className="obsidian-glass-divider" />
                <button
                  className={`obsidian-glass-btn ${layersMenuOpen ? 'active' : ''}`}
                  onClick={() => setLayersMenuOpen(!layersMenuOpen)}
                  title="Capas del mapa"
                >
                  <Layers size={18} />
                </button>
              </div>

              {/* Menú de Capas flotante */}
              {layersMenuOpen && (
                <div className="obsidian-layers-panel">
                  <div className="obsidian-layers-title">Capas de Mapa</div>
                  {MAP_LAYER_OPTIONS.map((option) => (
                    <div
                      key={option.key}
                      className={`obsidian-layer-item ${currentLayer === option.key ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentLayer(option.key)
                        setLayersMenuOpen(false)
                      }}
                    >
                      <div className="obsidian-layer-dot" />
                      <span>{option.label}</span>
                    </div>
                  ))}
                  <div style={{ margin: '8px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                  <div className="obsidian-layers-title">Audiencia / Vista</div>
                  <div
                    className={`obsidian-layer-item ${viewMode === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      handleToggleViewMode('all')
                      setLayersMenuOpen(false)
                    }}
                  >
                    <div className="obsidian-layer-dot" />
                    <span>🌍 Todo Público</span>
                  </div>
                  <div
                    className={`obsidian-layer-item ${viewMode === 'local' ? 'active' : ''}`}
                    onClick={() => {
                      handleToggleViewMode('local')
                      setLayersMenuOpen(false)
                    }}
                  >
                    <div className="obsidian-layer-dot" />
                    <span>🏡 Locales</span>
                  </div>
                  <div
                    className={`obsidian-layer-item ${viewMode === 'tourist' ? 'active' : ''}`}
                    onClick={() => {
                      handleToggleViewMode('tourist')
                      setLayersMenuOpen(false)
                    }}
                  >
                    <div className="obsidian-layer-dot" />
                    <span>✈️ Turistas</span>
                  </div>

                  <div style={{ margin: '8px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                  <div className="obsidian-layers-title">Herramientas Analíticas</div>
                  <div
                    className={`obsidian-layer-item ${showHeatmap ? 'active' : ''}`}
                    onClick={() => {
                      setShowHeatmap(!showHeatmap)
                      setLayersMenuOpen(false)
                    }}
                  >
                    <div className="obsidian-layer-dot" />
                    <span>🔥 Mapa de Calor</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(14, 17, 17, 0.7)',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '12px',
              color: 'var(--text-primary)',
              backdropFilter: 'blur(4px)'
            }}>
              <div className="spinner" />
              <span>Sincronizando puntos geoespaciales...</span>
            </div>
          )}
        </div>

        {/* Sidebar Info/Control */}
        <div className="map-sidebar" style={{
          background: 'var(--glass-bg)',
          borderLeft: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {isEditingZone ? (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-accent)' }}>Nuevo Sector</h3>
                <button
                  onClick={() => setIsEditingZone(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <AlertTriangle size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nombre del Sector</label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={e => setZoneForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej. Centro Histórico"
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tipo de Sector</label>
                <select
                  value={zoneForm.category}
                  onChange={e => setZoneForm(prev => ({ ...prev, category: e.target.value }))}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                >
                  <option value="ciudad">Ciudad (Barrio / Comuna)</option>
                  <option value="edificio">Edificio (Recinto cerrado)</option>
                  <option value="reserva">Reserva (Parque / Playa / Naturaleza)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Color (Hex)</label>
                <input
                  type="color"
                  value={zoneForm.color}
                  onChange={e => setZoneForm(prev => ({ ...prev, color: e.target.value }))}
                  style={{ width: '100%', height: '40px', padding: '0', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ padding: '12px', background: 'rgba(255,153,0,0.1)', border: '1px solid #ff9900', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#ff9900', fontWeight: 600 }}>
                  Geometría ({zoneForm.coordinates.length} puntos)
                </p>
                <button
                  onClick={() => setDrawZoneMode(!drawZoneMode)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: drawZoneMode ? '#ff9900' : 'transparent',
                    color: drawZoneMode ? '#fff' : '#ff9900',
                    border: '1px solid #ff9900',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {drawZoneMode ? 'Dejar de Dibujar' : 'Dibujar en Mapa'}
                </button>
                {zoneForm.coordinates.length > 0 && (
                  <button
                    onClick={() => setZoneForm(prev => ({ ...prev, coordinates: [] }))}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'transparent',
                      color: 'var(--danger)',
                      border: '1px solid var(--danger)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      marginTop: '8px'
                    }}
                  >
                    Borrar Puntos
                  </button>
                )}
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setIsEditingZone(false)}
                  style={{ flex: 1, padding: '10px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveZone}
                  style={{ flex: 1, padding: '10px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : isEditingCycleway ? (
            <div className="creation-form-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-accent)' }}>
                  {cyclewayForm.id.startsWith('new-') || !cycleways.some(c => c.id === cyclewayForm.id) ? 'Nueva Ciclovía' : 'Editar Ciclovía'}
                </h3>
                <button onClick={() => { setIsEditingCycleway(false); setDrawOnMapMode(false); }} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>Cancelar</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ID Ciclovía</label>
                  <input
                    type="text"
                    value={cyclewayForm.id}
                    onChange={(e) => setCyclewayForm(prev => ({ ...prev, id: e.target.value }))}
                    disabled={!cyclewayForm.id.startsWith('new-')}
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Eje Vial / Calle</label>
                  <input
                    type="text"
                    value={cyclewayForm.eje}
                    onChange={(e) => setCyclewayForm(prev => ({ ...prev, eje: e.target.value }))}
                    required
                    placeholder="Ej. Av. Alemania"
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Desde / Inicio</label>
                  <input
                    type="text"
                    value={cyclewayForm.inicio}
                    onChange={(e) => setCyclewayForm(prev => ({ ...prev, inicio: e.target.value }))}
                    placeholder="Ej. Av. Prat"
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hasta / Fin</label>
                  <input
                    type="text"
                    value={cyclewayForm.fin}
                    onChange={(e) => setCyclewayForm(prev => ({ ...prev, fin: e.target.value }))}
                    placeholder="Ej. Av. Valdivia"
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Largo (KM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cyclewayForm.km}
                    onChange={(e) => setCyclewayForm(prev => ({ ...prev, km: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ej. 1.2"
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Coordenadas ({cyclewayForm.coordinates.length} puntos)</span>
                    <span style={{ fontSize: '0.7rem', color: '#ff9900' }}>[Lng, Lat] WGS84</span>
                  </label>
                  
                  <textarea
                    rows={4}
                    value={JSON.stringify(cyclewayForm.coordinates)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        if (Array.isArray(parsed)) {
                          setCyclewayForm(prev => ({ ...prev, coordinates: parsed }));
                        }
                      } catch (err) {}
                    }}
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'monospace' }}
                  />

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setDrawOnMapMode(!drawOnMapMode)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        border: '1px solid ' + (drawOnMapMode ? 'var(--info)' : 'var(--border-medium)'),
                        background: drawOnMapMode ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                        color: drawOnMapMode ? 'var(--info)' : 'var(--text-primary)'
                      }}
                    >
                      {drawOnMapMode ? '🔴 Capturando clics...' : '📍 Dibujar en Mapa'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCyclewayForm(prev => ({
                          ...prev,
                          coordinates: prev.coordinates.slice(0, -1)
                        }))
                      }}
                      disabled={cyclewayForm.coordinates.length === 0}
                      style={{
                        padding: '6px 8px',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        border: '1px solid var(--border-medium)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        opacity: cyclewayForm.coordinates.length === 0 ? 0.5 : 1
                      }}
                    >
                      Deshacer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCyclewayForm(prev => ({
                          ...prev,
                          coordinates: []
                        }))
                      }}
                      disabled={cyclewayForm.coordinates.length === 0}
                      style={{
                        padding: '6px 8px',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        border: '1px solid var(--border-medium)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        opacity: cyclewayForm.coordinates.length === 0 ? 0.5 : 1
                      }}
                    >
                      Limpiar
                    </button>
                  </div>
                  {drawOnMapMode && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--info)', marginTop: '4px' }}>
                      * Haga clic en el mapa para agregar coordenadas consecutivas de la ciclovía.
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSaveCycleway(cyclewayForm)}
                  style={{
                    backgroundColor: 'var(--success)',
                    color: '#fff',
                    padding: '10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}
                >
                  Guardar Ciclovía
                </button>
              </div>
            </div>
          ) : createMode ? (
            <div className="creation-form-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-accent)' }}>Nuevo Punto</h3>
                <button onClick={handleCancelCreation} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancelar</button>
              </div>

              {!tempMarkerCoords ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', border: '1px dashed var(--border-medium)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                  <MapPin size={32} style={{ margin: '0 auto 12px', color: '#f59e0b', display: 'block' }} />
                  Haga clic en cualquier punto del mapa para establecer las coordenadas del nuevo elemento.
                </div>
              ) : (
                <form onSubmit={handleSavePoint} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Coordenadas informativas */}
                  <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>Latitud:</strong> {tempMarkerCoords.lat.toFixed(6)}</div>
                    <div><strong>Longitud:</strong> {tempMarkerCoords.lng.toFixed(6)}</div>
                  </div>

                  {/* 1. Tipo de punto (Searchable con datalist) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tipo de Punto</label>
                    <input
                      list="tipos-punto"
                      value={createForm.type === 'event' ? 'Pin / Evento Colaborativo' : createForm.type === 'branch' ? 'Tienda / Sucursal Comercial' : createForm.type}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes('Evento')) setCreateForm(prev => ({ ...prev, type: 'event', category: '' }));
                        else if (val.includes('Tienda')) setCreateForm(prev => ({ ...prev, type: 'branch', category: '' }));
                        else setCreateForm(prev => ({ ...prev, type: val as any, category: '' }));
                      }}
                      placeholder="Seleccione o escriba..."
                      style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                    />
                    <datalist id="tipos-punto">
                      <option value="Pin / Evento Colaborativo" />
                      <option value="Tienda / Sucursal Comercial" />
                      <option value="Fauna" />
                    </datalist>
                  </div>

                  {/* 2. Categoría (Searchable con datalist) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Categoría</label>
                    <input
                      list="categorias-list"
                      value={createForm.category}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'nuevo +') {
                          const newFauna = window.prompt("Ingrese el nombre de la nueva fauna:");
                          if (newFauna) {
                            const addPromise = api.post('/admin/api/v1/fauna-types', { name: newFauna })
                              .then(() => {
                                fetchData();
                                setCreateForm(prev => ({ ...prev, category: newFauna }));
                              });

                            sileo.promise(addPromise, {
                              loading: {
                                title: 'Añadiendo tipo de fauna...',
                                description: 'Guardando el nuevo tipo de fauna en la base de datos...'
                              },
                              success: {
                                title: 'Tipo de fauna añadido',
                                description: `Se ha registrado "${newFauna}" correctamente.`
                              },
                              error: {
                                title: 'Error al añadir fauna',
                                description: 'Ocurrió un problema al guardar.'
                              }
                            });
                          }
                          return;
                        }
                        setCreateForm(prev => ({ ...prev, category: val }))
                      }}
                      required
                      placeholder={createForm.type === 'Fauna' ? "Seleccione o añada tipo de fauna..." : "Seleccione o escriba categoría..."}
                      style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                    />
                    <datalist id="categorias-list">
                      {createForm.type === 'Fauna' ? (
                        <>
                          {faunaTypes.map(f => <option key={f.id} value={f.name} />)}
                          <option value="nuevo +" />
                        </>
                      ) : (
                        <>
                          <option value="cultura" />
                          <option value="naturaleza" />
                          <option value="gastronomia" />
                          <option value="musica" />
                          <option value="deportes" />
                          <option value="publico" />
                          <option value="museo" />
                          <option value="teatro" />
                          <option value="puerto" />
                          <option value="choque" />
                          <option value="incendio" />
                          <option value="calle_cortada" />
                          <option value="tienda" />
                          <option value="Hotel" />
                          <option value="Atracción" />
                        </>
                      )}
                    </datalist>
                  </div>

                  {/* 3. Público Objetivo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Público Objetivo</label>
                    <select
                      value={createForm.targetAudience}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, targetAudience: e.target.value as any }))}
                      style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                    >
                      <option value="all">Todo Público</option>
                      <option value="local">Local</option>
                      <option value="tourist">Turista</option>
                    </select>
                  </div>

                  {/* 4. Título */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre / Título</label>
                    <input
                      type="text"
                      required
                      placeholder={createForm.type === 'event' ? "Ej. Evento Cultural de Selva" : "Ej. Boutique de Souvenirs"}
                      value={createForm.title}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                      style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                    />
                  </div>

                  {/* 5. Descripción */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Descripción</label>
                    <textarea
                      placeholder="Breve reseña del punto..."
                      value={createForm.description}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem', resize: 'none' }}
                    />
                  </div>

                  {/* 6. Icono SVG | Imagen (Si aplica) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {createForm.type === 'Fauna' ? 'Imagen / Banner de Fauna (URL)' : 'Icono SVG | Imagen (Ruta o URL)'}
                    </label>
                    <input
                      type="text"
                      placeholder={createForm.type === 'Fauna' ? 'Ej. https://images.unsplash.com/... (Opcional)' : 'Ej. /assets/icon.svg o https://...'}
                      value={createForm.imageUrl}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                    />
                  </div>

                  {/* 7. Fecha Inicio | Fecha Fin (Ocultar si es Fauna) */}
                  {createForm.type !== 'Fauna' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha Inicio</label>
                        <input
                          type="datetime-local"
                          value={createForm.startTime ? new Date(createForm.startTime).toISOString().slice(0,16) : ''}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, startTime: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                          style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha Fin</label>
                        <input
                          type="datetime-local"
                          value={createForm.endTime ? new Date(createForm.endTime).toISOString().slice(0,16) : ''}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, endTime: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                          style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Campos de Tienda */}
                  {createForm.type === 'branch' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Dirección</label>
                        <input
                          type="text"
                          placeholder="Ej. Arturo Prat 1025, Valdivia"
                          value={createForm.address}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, address: e.target.value }))}
                          style={{
                            padding: '8px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8125rem'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Teléfono</label>
                        <input
                          type="text"
                          placeholder="Ej. +5663220110"
                          value={createForm.phone}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                          style={{
                            padding: '8px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8125rem'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>URL de Imagen</label>
                        <input
                          type="text"
                          placeholder="https://ejemplo.com/imagen.jpg"
                          value={createForm.imageUrl}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                          style={{
                            padding: '8px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8125rem'
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* Campos de Evento */}
                  {createForm.type === 'event' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha Inicio</label>
                        <input
                          type="datetime-local"
                          value={createForm.startTime}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, startTime: e.target.value }))}
                          style={{
                            padding: '8px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8125rem'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha Término</label>
                        <input
                          type="datetime-local"
                          value={createForm.endTime}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, endTime: e.target.value }))}
                          style={{
                            padding: '8px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8125rem'
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* Público Objetivo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Público Objetivo</label>
                    <select
                      value={createForm.targetAudience}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, targetAudience: e.target.value as 'all' | 'local' | 'tourist' }))}
                      style={{
                        padding: '8px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '0.8125rem'
                      }}
                    >
                      <option value="all">Todo público</option>
                      <option value="local">Residentes locales</option>
                      <option value="tourist">Sólo Turistas</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPoint}
                    style={{
                      marginTop: '8px',
                      padding: '10px',
                      background: 'var(--accent-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    {savingPoint ? 'Guardando...' : 'Guardar Punto'}
                  </button>
                </form>
              )}
            </div>
          ) : selectedCycleway ? (
            <div className="selected-event-details" style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(0, 210, 255, 0.03)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: 'rgba(0, 210, 255, 0.15)',
                  color: '#00d2ff',
                  border: '1px solid #00d2ff'
                }}>
                  Ciclovía
                </span>
                <button
                  onClick={() => setSelectedCycleway(null)}
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none'
                  }}
                >
                  Cerrar
                </button>
              </div>

              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                🚲 {selectedCycleway.eje || 'Ciclovía sin nombre'}
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                <div>Desde: <strong>{selectedCycleway.inicio || 'No especificado'}</strong></div>
                <div>Hasta: <strong>{selectedCycleway.fin || 'No especificado'}</strong></div>
                <div>Largo: <strong>{selectedCycleway.km} km</strong></div>
                <div>Puntos de coordenadas: <strong>{selectedCycleway.coordinates.length}</strong></div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setCyclewayForm({ ...selectedCycleway });
                    setIsEditingCycleway(true);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'rgba(52, 211, 153, 0.1)',
                    color: 'var(--success)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteCycleway(selectedCycleway.id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ) : selectedEvent ? (
            <div className="selected-event-details" style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(52, 211, 153, 0.03)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: selectedEvent.emitterType === 'business' ? 'rgba(37, 100, 135, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                  color: selectedEvent.emitterType === 'business' ? 'var(--info)' : 'var(--success)',
                  border: '1px solid ' + (selectedEvent.emitterType === 'business' ? 'var(--info)' : 'var(--border-accent)')
                }}>
                  {selectedEvent.emitterType === 'business' ? 'Empresa' : 'Ciudadano'}
                </span>
                <button
                  onClick={() => setSelectedEvent(null)}
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>
              </div>

              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                {selectedEvent.title}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '16px' }}>
                {selectedEvent.description || 'Sin descripción detallada.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={12} />
                  <span>Inicio: {new Date(selectedEvent.startTime).toLocaleString('es-ES')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={12} />
                  <span>Categoría: <strong>{selectedEvent.category}</strong></span>
                </div>
                {selectedEvent.sectorName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={12} style={{ color: 'var(--text-accent)' }} />
                    <span>Sector: <strong style={{ color: 'var(--text-accent)' }}>{selectedEvent.sectorName}</strong></span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={12} />
                  <span>Coordenadas: {selectedEvent.latitude.toFixed(5)}, {selectedEvent.longitude.toFixed(5)}</span>
                </div>
              </div>

              <button
                onClick={() => handleDeleteEvent(selectedEvent.id)}
                disabled={deletingId === selectedEvent.id}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Trash2 size={14} />
                <span>{deletingId === selectedEvent.id ? 'Eliminando...' : 'Eliminar Pin del Mapa'}</span>
              </button>
              
              <button
                onClick={() => handleToggleLiveEvent(selectedEvent.id, selectedEvent.isLive || false)}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '10px',
                  background: selectedEvent.isLive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                  color: selectedEvent.isLive ? 'var(--danger)' : 'var(--success)',
                  border: `1px solid ${selectedEvent.isLive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(52, 211, 153, 0.25)'}`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <span>{selectedEvent.isLive ? '🔴 Quitar estado "En Vivo"' : '▶️ Marcar como "En Vivo"'}</span>
              </button>
            </div>
          ) : selectedBranch ? (
            <div className="selected-event-details" style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(79, 70, 229, 0.03)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: 'rgba(79, 70, 229, 0.15)',
                  color: '#818cf8',
                  border: '1px solid rgba(79, 70, 229, 0.3)'
                }}>
                  Tienda / Comercio
                </span>
                <button
                  onClick={() => setSelectedBranch(null)}
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>
              </div>

              {selectedBranch.imageUrl && (
                <img
                  src={selectedBranch.imageUrl}
                  alt={selectedBranch.branchName}
                  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }}
                />
              )}

              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                {selectedBranch.branchName}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '16px' }}>
                {selectedBranch.description || 'Sin descripción detallada.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                {selectedBranch.address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={12} />
                    <span>Dirección: {selectedBranch.address}</span>
                  </div>
                )}
                {selectedBranch.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📞</span>
                    <span>Teléfono: {selectedBranch.phone}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={12} />
                  <span>Categoría: <strong>{selectedBranch.category}</strong></span>
                </div>
                {selectedBranch.sectorName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={12} style={{ color: 'var(--text-accent)' }} />
                    <span>Sector: <strong style={{ color: 'var(--text-accent)' }}>{selectedBranch.sectorName}</strong></span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={12} />
                  <span>Empresa: <strong>{selectedBranch.companyName}</strong></span>
                </div>
              </div>

              <button
                onClick={() => handleDeleteBranch(selectedBranch.id)}
                disabled={deletingBranchId === selectedBranch.id}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Trash2 size={14} />
                <span>{deletingBranchId === selectedBranch.id ? 'Eliminando...' : 'Eliminar Tienda'}</span>
              </button>
            </div>
          ) : (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.8125rem'
            }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 8px', color: 'var(--warning)' }} />
              Seleccione un elemento en el mapa o en la lista inferior, o active el botón de marcador (MapPin) arriba a la derecha para crear puntos.
            </div>
          )}

          {/* List of active events / zones / branches - HIDE when editing or creating */}
          {(!isEditingZone && !isEditingCycleway && !createMode) && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Selector de Público / Vista */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid var(--border-subtle)',
                gap: '8px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtro Audiencia:</span>
                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  {(['all', 'local', 'tourist'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => handleToggleViewMode(mode)}
                      disabled={togglingMode}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: 'none',
                        background: viewMode === mode ? 'var(--accent-primary)' : 'transparent',
                        color: viewMode === mode ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      {mode === 'all' ? 'Todos' : mode === 'local' ? 'Locales' : 'Turistas'}
                    </button>
                  ))}
                </div>
              </div>

            <div style={{
              display: 'flex',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <button
                onClick={() => setActiveSidebarTab('events')}
                style={{
                  flex: 1,
                  padding: '12px 4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: activeSidebarTab === 'events' ? 'var(--text-accent)' : 'var(--text-muted)',
                  borderBottom: activeSidebarTab === 'events' ? '2px solid var(--text-accent)' : 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Pines ({filteredEvents.length})
              </button>
              <button
                onClick={() => setActiveSidebarTab('branches')}
                style={{
                  flex: 1,
                  padding: '12px 4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: activeSidebarTab === 'branches' ? 'var(--text-accent)' : 'var(--text-muted)',
                  borderBottom: activeSidebarTab === 'branches' ? '2px solid var(--text-accent)' : 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Tiendas ({filteredBranches.length})
              </button>
              <button
                onClick={() => setActiveSidebarTab('sectors')}
                style={{
                  flex: 1,
                  padding: '12px 4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: activeSidebarTab === 'sectors' ? 'var(--text-accent)' : 'var(--text-muted)',
                  borderBottom: activeSidebarTab === 'sectors' ? '2px solid var(--text-accent)' : 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Sectores ({zones.length})
              </button>
              <button
                onClick={() => setActiveSidebarTab('cycleways')}
                style={{
                  flex: 1,
                  padding: '12px 4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: activeSidebarTab === 'cycleways' ? 'var(--text-accent)' : 'var(--text-muted)',
                  borderBottom: activeSidebarTab === 'cycleways' ? '2px solid var(--text-accent)' : 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Ciclovías ({cycleways.length})
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeSidebarTab === 'events' ? (
                filteredEvents.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    No hay pines activos para esta vista.
                  </div>
                ) : (
                  filteredEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => handleSelectEvent(event)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: selectedEvent?.id === event.id ? 'rgba(52, 211, 153, 0.05)' : 'transparent',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                        <MapPin size={16} style={{
                          marginTop: '2px',
                          color: event.emitterType === 'business' ? 'var(--info)' : 'var(--success)'
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: selectedEvent?.id === event.id ? 'var(--text-accent)' : 'var(--text-primary)'
                          }}>
                            {event.title} {event.isLive && <span style={{color: '#ef4444', fontSize: '10px', marginLeft: '4px', verticalAlign: 'middle'}}>🔴 EN VIVO</span>}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Categoría: {event.category}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : activeSidebarTab === 'branches' ? (
                filteredBranches.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    No hay tiendas registradas para esta vista.
                  </div>
                ) : (
                  filteredBranches.map(branch => (
                    <div
                      key={branch.id}
                      onClick={() => handleSelectBranch(branch)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: selectedBranch?.id === branch.id ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                        <span style={{ fontSize: '16px', marginTop: '1px' }}>🏪</span>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: selectedBranch?.id === branch.id ? '#818cf8' : 'var(--text-primary)'
                          }}>
                            {branch.branchName}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Categoría: {branch.category} ({branch.companyName})
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : activeSidebarTab === 'sectors' ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button
                      onClick={() => {
                        setZoneForm({
                          name: '',
                          description: '',
                          category: 'ciudad',
                          color: '#EC4899',
                          coordinates: []
                        });
                        setIsEditingZone(true);
                      }}
                      style={{
                        margin: '12px 16px',
                        padding: '8px',
                        background: 'rgba(52, 211, 153, 0.1)',
                        color: 'var(--success)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.85rem'
                      }}
                    >
                      + Nuevo Sector
                    </button>
                    {zones.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        No hay sectores delimitados.
                      </div>
                    ) : (
                      zones.map(zone => (
                        <div
                          key={zone.id}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: 'transparent'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '3px',
                              background: zone.color,
                              opacity: zone.isActive ? 1 : 0.3
                            }} />
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: zone.isActive ? 'var(--text-primary)' : 'var(--text-muted)'
                              }}>
                                {zone.name}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'capitalize' }}>
                                {zone.category || 'Sector'} • <strong style={{ color: 'var(--text-accent)' }}>{zone.eventsCount ?? 0}</strong> {zone.eventsCount === 1 ? 'evento' : 'eventos'}
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleZone(zone)}
                              disabled={togglingZoneId === zone.id}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.65rem',
                                borderRadius: '4px',
                                background: zone.isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: zone.isActive ? 'var(--danger)' : 'var(--success)',
                                border: '1px solid currentColor',
                                cursor: 'pointer'
                              }}
                            >
                              {togglingZoneId === zone.id ? '...' : (zone.isActive ? 'Desactivar' : 'Activar')}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <button
                    onClick={() => {
                      setCyclewayForm({
                        id: 'new-' + Date.now(),
                        eje: '',
                        inicio: '',
                        fin: '',
                        km: 0,
                        coordinates: []
                      });
                      setIsEditingCycleway(true);
                      setSelectedCycleway(null);
                      setSelectedEvent(null);
                      setSelectedBranch(null);
                    }}
                    style={{
                      margin: '12px 16px',
                      padding: '8px',
                      background: 'rgba(52, 211, 153, 0.1)',
                      color: 'var(--success)',
                      border: '1px solid var(--border-accent)',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> Nueva Ciclovía
                  </button>
                  {cycleways.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      No hay ciclovías registradas.
                    </div>
                  ) : (
                    cycleways.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCycleway(c);
                          setSelectedEvent(null);
                          setSelectedBranch(null);
                          setIsEditingCycleway(false);
                          if (c.coordinates.length > 0 && mapInstanceRef.current) {
                            const [lng, lat] = c.coordinates[0];
                            mapInstanceRef.current.setView([lat, lng], 15);
                          }
                        }}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: selectedCycleway?.id === c.id ? 'rgba(52, 211, 153, 0.05)' : 'transparent',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                          <span style={{ fontSize: '16px', marginTop: '1px' }}>🚲</span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: selectedCycleway?.id === c.id ? 'var(--text-accent)' : 'var(--text-primary)'
                            }}>
                              {c.eje}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Desde: {c.inicio || 'N/A'} — Hasta: {c.fin || 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                              Largo: {c.km} km ({c.coordinates.length} pts)
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
