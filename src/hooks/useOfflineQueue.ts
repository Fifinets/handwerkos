import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

interface OfflineTimeEntry {
  id: string
  type: 'start' | 'stop' | 'switch'
  timestamp: string
  projectId?: string
  segmentType: 'work' | 'break' | 'drive'
  description?: string
  location?: {
    lat: number
    lng: number
    accuracy?: number
  }
  deviceId: string
  localId: string
  syncAttempts: number
  lastSyncAttempt?: string
}

interface QueueStats {
  totalEntries: number
  pendingSync: number
  failed: number
  oldestEntry?: string
}

const STORAGE_KEY = 'handwerkos_offline_queue'
const MAX_SYNC_ATTEMPTS = 5
const SYNC_RETRY_DELAY = 30000 // 30 Sekunden

export const useOfflineQueue = () => {
  const [queue, setQueue] = useState<OfflineTimeEntry[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [stats, setStats] = useState<QueueStats>({
    totalEntries: 0,
    pendingSync: 0,
    failed: 0
  })

  // Online-Status überwachen
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Queue aus LocalStorage laden
  const loadQueue = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const entries: OfflineTimeEntry[] = JSON.parse(stored)
        setQueue(entries)
        updateStats(entries)
      }
    } catch (error) {
      console.error('Error loading offline queue:', error)
    }
  }, [])

  // Queue in LocalStorage speichern
  const saveQueue = useCallback((entries: OfflineTimeEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
      updateStats(entries)
    } catch (error) {
      console.error('Error saving offline queue:', error)
    }
  }, [])

  // Statistiken aktualisieren
  const updateStats = (entries: OfflineTimeEntry[]) => {
    const failed = entries.filter(e => e.syncAttempts >= MAX_SYNC_ATTEMPTS).length
    const pending = entries.filter(e => e.syncAttempts < MAX_SYNC_ATTEMPTS).length
    const oldest = entries.length > 0 ? entries[0]?.timestamp : undefined
    
    setStats({
      totalEntries: entries.length,
      pendingSync: pending,
      failed,
      oldestEntry: oldest
    })
  }

  // Eintrag zur Queue hinzufügen
  const addToQueue = useCallback((entry: Omit<OfflineTimeEntry, 'id' | 'deviceId' | 'localId' | 'syncAttempts'>) => {
    const deviceId = getDeviceId()
    const newEntry: OfflineTimeEntry = {
      ...entry,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deviceId,
      localId: `local_${Date.now()}`,
      syncAttempts: 0
    }
    
    const updatedQueue = [...queue, newEntry]
    setQueue(updatedQueue)
    saveQueue(updatedQueue)
    
    console.log('Added to offline queue:', newEntry)
    
    // Sofort sync versuchen wenn online
    if (isOnline) {
      syncQueue()
    }
    
    return newEntry
  }, [queue, saveQueue, isOnline])

  // Device-ID generieren/abrufen
  const getDeviceId = () => {
    let deviceId = localStorage.getItem('handwerkos_device_id')
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('handwerkos_device_id', deviceId)
    }
    return deviceId
  }

  // Einzelnen Eintrag synchronisieren
  const syncEntry = async (entry: OfflineTimeEntry): Promise<boolean> => {
    try {
      switch (entry.type) {
        case 'start':
          const { error: startError } = await supabase.rpc('rpc_start_time_segment', {
            p_project_id: entry.projectId,
            p_work_type: entry.segmentType,
            p_description: entry.description || null
          })
          if (startError) throw startError
          break
          
        case 'stop':
          const { error: stopError } = await supabase.rpc('rpc_stop_time_segment', {
            p_segment_id: entry.localId // TODO: Resolve actual segment ID
          })
          if (stopError) throw stopError
          break
          
        case 'switch':
          const { error: switchError } = await supabase.rpc('rpc_switch_project', {
            p_from_segment_id: 'current', // TODO: Handle better
            p_to_project_id: entry.projectId,
            p_to_work_type: entry.segmentType
          })
          if (switchError) throw switchError
          break
      }
      
      return true
    } catch (error) {
      console.error('Sync entry failed:', error)
      return false
    }
  }

  // Queue synchronisieren
  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing || queue.length === 0) {
      return
    }
    
    setIsSyncing(true)
    console.log(`Starting sync of ${queue.length} entries`)
    
    const updatedQueue = [...queue]
    let syncedCount = 0
    let failedCount = 0
    
    for (let i = 0; i < updatedQueue.length; i++) {
      const entry = updatedQueue[i]
      
      // Skip bereits zu oft fehlgeschlagene Einträge
      if (entry.syncAttempts >= MAX_SYNC_ATTEMPTS) {
        continue
      }
      
      const success = await syncEntry(entry)
      
      if (success) {
        // Eintrag aus Queue entfernen
        updatedQueue.splice(i, 1)
        i-- // Index anpassen nach Entfernung
        syncedCount++
      } else {
        // Sync-Versuche erhöhen
        entry.syncAttempts++
        entry.lastSyncAttempt = new Date().toISOString()
        failedCount++
      }
    }
    
    // Queue aktualisieren
    setQueue(updatedQueue)
    saveQueue(updatedQueue)
    setIsSyncing(false)
    
    // Feedback geben
    if (syncedCount > 0) {
      toast.success(`${syncedCount} Einträge synchronisiert`)
    }
    
    if (failedCount > 0) {
      console.warn(`${failedCount} Einträge konnten nicht synchronisiert werden`)
    }
    
    console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed, ${updatedQueue.length} remaining`)
    
  }, [isOnline, isSyncing, queue, saveQueue])

  // Auto-Sync wenn online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      // Kurze Verzögerung nach Online-Übergang
      const timer = setTimeout(syncQueue, 2000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, queue.length, syncQueue])

  // Regelmäßiger Sync-Versuch
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && queue.some(e => e.syncAttempts < MAX_SYNC_ATTEMPTS)) {
        syncQueue()
      }
    }, SYNC_RETRY_DELAY)
    
    return () => clearInterval(interval)
  }, [isOnline, syncQueue]) // queue entfernt aus Dependencies

  // Queue beim Laden initialisieren - nur beim Mount
  useEffect(() => {
    loadQueue()
  }, []) // Nur beim Mount laden

  // Queue leeren (nur für Debug/Admin)
  const clearQueue = useCallback(() => {
    setQueue([])
    localStorage.removeItem(STORAGE_KEY)
    setStats({ totalEntries: 0, pendingSync: 0, failed: 0 })
    toast.success('Offline-Queue geleert')
  }, [])

  // Failed Entries retry
  const retryFailedEntries = useCallback(() => {
    const updatedQueue = queue.map(entry => ({
      ...entry,
      syncAttempts: 0,
      lastSyncAttempt: undefined
    }))
    setQueue(updatedQueue)
    saveQueue(updatedQueue)
    
    if (isOnline) {
      syncQueue()
    }
    toast.info('Fehlgeschlagene Einträge zurückgesetzt')
  }, [queue, saveQueue, isOnline, syncQueue])

  // Conflict-free merge helper
  const resolveConflicts = useCallback((localEntries: OfflineTimeEntry[]) => {
    // Sortiere nach Timestamp für chronologische Reihenfolge
    const sorted = [...localEntries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    
    // Entferne Duplikate basierend auf Timestamp + Type + ProjectId
    const deduplicated = sorted.filter((entry, index, arr) => {
      const key = `${entry.timestamp}_${entry.type}_${entry.projectId}`
      return arr.findIndex(e => 
        `${e.timestamp}_${e.type}_${e.projectId}` === key
      ) === index
    })
    
    // Validiere Sequenz (start -> stop, kein start nach start ohne stop)
    const validated = []
    let lastAction = null
    
    for (const entry of deduplicated) {
      if (entry.type === 'start') {
        if (lastAction !== 'stop' && lastAction !== null) {
          // Füge impliziten Stop hinzu
          validated.push({
            ...entry,
            type: 'stop' as const,
            timestamp: new Date(new Date(entry.timestamp).getTime() - 1000).toISOString()
          })
        }
        validated.push(entry)
        lastAction = 'start'
      } else if (entry.type === 'stop') {
        if (lastAction === 'start') {
          validated.push(entry)
          lastAction = 'stop'
        }
        // Ignoriere stop ohne vorherigen start
      } else if (entry.type === 'switch') {
        // Switch fungiert als stop + start
        if (lastAction === 'start') {
          // Impliziter Stop
          validated.push({
            ...entry,
            type: 'stop' as const,
            timestamp: new Date(new Date(entry.timestamp).getTime() - 500).toISOString()
          })
        }
        validated.push(entry)
        lastAction = 'start'
      }
    }
    
    return validated
  }, [])

  return {
    // State
    queue,
    isOnline,
    isSyncing,
    stats,
    
    // Actions
    addToQueue,
    syncQueue,
    clearQueue,
    retryFailedEntries,
    
    // Helpers
    resolveConflicts
  }
}