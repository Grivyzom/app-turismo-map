import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import '@smastrom/react-rating/style.css'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/dev">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
