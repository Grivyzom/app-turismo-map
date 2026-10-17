import { api } from './api'

export interface CompanyLocation {
  success: boolean
  hasLocation: boolean
  latitude: number
  longitude: number
  address: string
  branchName: string
  description: string
  category: string
  phone: string
  imageUrl: string
  whatsapp: string
  whatsappMessage: string
  websiteUrl: string
  menuPdfUrl: string
  menuPdfSize: number
}

export const getCompanyLocation = () => api.get<CompanyLocation>('/api/v1/business/location')

export const MENU_MAX_BYTES = 5 * 1024 * 1024

interface MenuUploadTicket {
  uploadUrl: string
  headers: Record<string, string>
  key: string
}

/**
 * Sube la carta en 3 pasos: el backend firma, el navegador sube el PDF directo
 * al bucket (el backend no toca los bytes) y el backend verifica y lo asocia.
 */
export async function uploadMenuPdf(file: File): Promise<{ menuPdfUrl: string; menuPdfSize: number }> {
  if (file.type !== 'application/pdf') throw new Error('La carta debe ser un archivo PDF.')
  if (file.size > MENU_MAX_BYTES) throw new Error('La carta debe pesar como máximo 5 MB.')

  const ticket = await api.post<MenuUploadTicket>('/api/v1/business/menu/upload-url', {
    contentType: file.type,
    size: file.size,
  })

  let res: Response
  try {
    res = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: file })
  } catch {
    throw new Error('No se pudo subir el archivo al almacenamiento.')
  }
  if (!res.ok) throw new Error(`No se pudo subir el archivo (error ${res.status}).`)

  return api.post('/api/v1/business/menu/confirm', { key: ticket.key })
}

export const deleteMenuPdf = () => api.delete('/api/v1/business/menu')

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
