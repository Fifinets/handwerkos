import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './hooks/useAuth'
import { SupabaseAuthProvider } from './hooks/useSupabaseAuth'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <SupabaseAuthProvider>
      <App />
    </SupabaseAuthProvider>
  </AuthProvider>
)
