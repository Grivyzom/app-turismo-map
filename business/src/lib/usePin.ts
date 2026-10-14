import { useCallback, useRef, useState } from 'react'
import type { Coord } from '../components/LocationPicker'
import { formatCoords, getBrowserLocation, reverseGeocode } from './geocode'

/** Estado de un pin en el mapa + dirección resuelta por geocodificación inversa. */
export function usePin() {
  const [pin, setPin] = useState<Coord | null>(null)
  const [address, setAddress] = useState('')
  const [resolving, setResolving] = useState(false)
  const reqId = useRef(0)

  const movePin = useCallback(async (c: Coord) => {
    setPin(c)
    const id = ++reqId.current
    setResolving(true)
    const addr = await reverseGeocode(c.latitude, c.longitude)
    if (id !== reqId.current) return // respuesta obsoleta
    setAddress(addr ?? formatCoords(c.latitude, c.longitude))
    setResolving(false)
  }, [])

  const locateWithGps = useCallback(async () => {
    const c = await getBrowserLocation()
    await movePin(c)
  }, [movePin])

  return { pin, setPin, address, setAddress, resolving, movePin, locateWithGps }
}
