import { useEffect, useRef } from 'react'
import L from 'leaflet'

// Centro por defecto: Valdivia.
const DEFAULT_CENTER: L.LatLngTuple = [-39.8142, -73.2459]

export interface Coord {
  latitude: number
  longitude: number
}

interface Props {
  value: Coord | null
  onChange: (c: Coord) => void
  color?: string
  height?: number
}

function pinIcon(color: string) {
  return L.divIcon({
    className: 'pin-icon',
    html: `<svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 0C7.6 0 0 7.4 0 16.5 0 29 17 44 17 44s17-15 17-27.5C34 7.4 26.4 0 17 0z" fill="${color}"/><circle cx="17" cy="16.5" r="6.5" fill="#fff"/></svg>`,
    iconSize: [34, 44],
    iconAnchor: [17, 44],
  })
}

/** Mapa Leaflet para elegir un punto: click o arrastre del pin. */
export default function LocationPicker({ value, onChange, color = '#1a4335', height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      value ? [value.latitude, value.longitude] : DEFAULT_CENTER,
      value ? 16 : 14,
    )
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => {
      onChangeRef.current({ latitude: e.latlng.lat, longitude: e.latlng.lng })
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // El centro inicial solo se usa al montar; los cambios posteriores se sincronizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const pos: L.LatLngTuple = [value.latitude, value.longitude]
    if (!markerRef.current) {
      markerRef.current = L.marker(pos, { draggable: true, icon: pinIcon(color) }).addTo(map)
      markerRef.current.on('dragend', () => {
        const ll = markerRef.current!.getLatLng()
        onChangeRef.current({ latitude: ll.lat, longitude: ll.lng })
      })
    } else {
      markerRef.current.setLatLng(pos)
    }
    if (!map.getBounds().contains(pos)) map.setView(pos, Math.max(map.getZoom(), 15))
  }, [value, color])

  useEffect(() => {
    markerRef.current?.setIcon(pinIcon(color))
  }, [color])

  return <div ref={containerRef} className="map" style={{ height }} />
}
