import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey="pk_test_Y3JlZGlibGUtY293LTI5LmNsZXJrLmFjY291bnRzLmRldiQ" afterSignOutUrl="/">
    <App />
  </ClerkProvider>
)
