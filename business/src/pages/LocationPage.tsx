import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Crosshair, ExternalLink, FileText, Save, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { CATEGORIES } from '../lib/catalog'
import { deleteMenuPdf, formatBytes, getCompanyLocation, uploadMenuPdf } from '../lib/company'
import { usePin } from '../lib/usePin'
import LocationPicker from '../components/LocationPicker'
import CategoryPicker from '../components/CategoryPicker'
import Notice from '../components/Notice'

export default function LocationPage() {
  const { user } = useAuth()
  const isIndependent = ['independent', 'independiente'].includes(user?.company?.entityType ?? '')
  const { pin, setPin, address, setAddress, resolving, movePin, locateWithGps } = usePin()
  const [branchName, setBranchName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('gastronomia')
  const [phone, setPhone] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [menu, setMenu] = useState<{ url: string; size: number } | null>(null)
  const [menuBusy, setMenuBusy] = useState(false)
  const menuInput = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    getCompanyLocation()
      .then((d) => {
        if (d.hasLocation) {
          setPin({ latitude: d.latitude, longitude: d.longitude })
          setAddress(d.address || '')
        }
        setBranchName(d.branchName || '')
        setDescription(d.description || '')
        setCategory(d.category || 'gastronomia')
        setPhone(d.phone || '')
        setImageUrl(d.imageUrl || '')
        setWhatsapp(d.whatsapp || '')
        setWhatsappMessage(d.whatsappMessage || '')
        setWebsiteUrl(d.websiteUrl || '')
        setMenu(d.menuPdfUrl ? { url: d.menuPdfUrl, size: d.menuPdfSize } : null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [setPin, setAddress])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!pin) return setError('Selecciona la ubicación de tu negocio en el mapa.')
    setSaving(true)
    try {
      await api.post('/api/v1/business/location/update', {
        latitude: pin.latitude,
        longitude: pin.longitude,
        address: address.trim(),
        branchName: branchName.trim(),
        description: description.trim(),
        category,
        phone: phone.trim(),
        imageUrl: imageUrl.trim(),
        whatsapp: whatsapp.trim(),
        whatsappMessage: whatsappMessage.trim(),
        websiteUrl: websiteUrl.trim(),
      })
      setSuccess('Ubicación guardada. Tu negocio ya aparece en el mapa turístico.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la ubicación.')
    } finally {
      setSaving(false)
    }
  }

  const onMenuSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setSuccess('')
    setMenuBusy(true)
    try {
      const r = await uploadMenuPdf(file)
      setMenu({ url: r.menuPdfUrl, size: r.menuPdfSize })
      setSuccess('Carta publicada. Los clientes ya pueden verla desde el mapa.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la carta.')
    } finally {
      setMenuBusy(false)
    }
  }

  const onMenuDelete = async () => {
    setError('')
    setSuccess('')
    setMenuBusy(true)
    try {
      await deleteMenuPdf()
      setMenu(null)
      setSuccess('Carta eliminada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la carta.')
    } finally {
      setMenuBusy(false)
    }
  }

  if (loading) return <div className="page-loading"><span className="spinner" /></div>

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Presencia en el mapa</p>
          <h1>{isIndependent ? 'Mi ubicación' : 'Geolocalizar empresa'}</h1>
        </div>
      </header>

      <form className="split" onSubmit={onSubmit} noValidate>
        <div className="card form">
          <label className="label">
            Nombre de la sucursal
            <input className="input" value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Ej. Casa Matriz" />
          </label>
          <label className="label">
            Dirección
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Se completa al mover el pin" />
          </label>
          <label className="label">
            Descripción
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="label">
            Categoría
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
          <div className="row">
            <label className="label">
              Teléfono
              <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="label">
              URL de imagen
              <input className="input" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </label>
          </div>
          {imageUrl && <img className="preview" src={imageUrl} alt="Vista previa" onError={(e) => (e.currentTarget.style.display = 'none')} />}

          <h3>Enlaces para clientes</h3>
          <p className="muted">Aparecen como botones en el pin de tu negocio.</p>
          <div className="row">
            <label className="label">
              WhatsApp
              <input className="input" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+56 9 1234 5678" />
            </label>
            <label className="label">
              Sitio web
              <input className="input" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://minegocio.cl" />
            </label>
          </div>
          <label className="label">
            Mensaje inicial de WhatsApp <span className="counter">{whatsappMessage.length}/300</span>
            <input className="input" maxLength={300} value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} placeholder="Hola, vi su negocio en el mapa turístico y quiero consultar…" />
          </label>

          <div className="label">
            Carta (PDF, máx. 5 MB)
            {menu ? (
              <div className="row">
                <a className="btn btn-ghost" href={menu.url} target="_blank" rel="noreferrer">
                  <FileText size={16} /> Ver carta · {formatBytes(menu.size)} <ExternalLink size={14} />
                </a>
                <div className="row">
                  <button type="button" className="btn btn-ghost" disabled={menuBusy} onClick={() => menuInput.current?.click()}>
                    <Upload size={16} /> Reemplazar
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={menuBusy} onClick={onMenuDelete}>
                    <Trash2 size={16} /> Quitar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost" disabled={menuBusy} onClick={() => menuInput.current?.click()}>
                {menuBusy ? <span className="spinner sm" /> : <><Upload size={16} /> Subir carta PDF</>}
              </button>
            )}
            <input ref={menuInput} type="file" accept="application/pdf" hidden onChange={onMenuSelected} />
          </div>

          {error && <Notice kind="error">{error}</Notice>}
          {success && <Notice kind="success">{success}</Notice>}
          <button className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner sm" /> : <><Save size={16} /> Guardar ubicación</>}
          </button>
        </div>

        <div className="card map-card">
          <div className="map-head">
            <div>
              <h3>Punto en el mapa</h3>
              <p className="muted">{resolving ? 'Buscando dirección…' : 'Haz click o arrastra el pin'}</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => locateWithGps().catch(() => setError('No se pudo obtener tu ubicación GPS.'))}>
              <Crosshair size={16} /> Mi ubicación
            </button>
          </div>
          <LocationPicker value={pin} onChange={movePin} color={CATEGORIES.find((c) => c.id === category)?.color} height={460} />
        </div>
      </form>
    </div>
  )
}
