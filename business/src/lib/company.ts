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
}

export const getCompanyLocation = () => api.get<CompanyLocation>('/api/v1/business/location')
