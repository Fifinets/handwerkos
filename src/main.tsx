import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.tsx'
import './index.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={clerkPubKey} afterSignOutUrl="/">
    <App />
  </ClerkProvider>
)
