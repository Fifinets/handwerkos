import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  Play, 
  Square, 
  RotateCcw, 
  Clock, 
  MapPin,
  Wifi,
  WifiOff,
  Coffee,
  Car,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Navigation,
  Calendar,
  User,
  Activity,
  Smartphone,
  PenTool
} from "lucide-react"
import { useMobileTimeTracking } from "@/hooks/useMobileTimeTracking"
import { useDeliveryNotes } from "@/hooks/useDeliveryNotes"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { formatMinutesToTime } from '@/utils/timeUtils'
import { 
  Geolocation,
  StatusBar, 
  Style as StatusBarStyle,
  KeepAwake,
  Haptics,
  ImpactStyle
} from '@/utils/capacitorMocks'
import SignatureCapture from '../SignatureCapture'
import { offlineQueue } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/utils/networkStatus'
import { pushNotificationManager } from '@/utils/pushNotifications'

interface Project {
  id: string
  name: string
  customer?: {
    id: string
    name: string
    email: string | null
  }
}


const EnhancedMobileTimeTracker: React.FC = () => {
  const { user } = useSupabaseAuth()
  const { 
    activeTime,
    segments,
    isLoading, 
    startTracking, 
    stopTracking,
    pauseTracking,
    refreshData 
  } = useMobileTimeTracking()
  
  const {
    deliveryNotes,
    signDeliveryNote,
    fetchDeliveryNotes
  } = useDeliveryNotes()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [segmentType, setSegmentType] = useState<'work' | 'break' | 'drive'>('work')
  
  // Mobile specific state
  const networkStatus = useNetworkStatus()
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingActionsCount, setPendingActionsCount] = useState(0)
  const [showProjectSheet, setShowProjectSheet] = useState(false)
  const [showSignatureDialog, setShowSignatureDialog] = useState(false)
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<any>(null)
  
  // Live timer
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Mobile setup and offline queue monitoring
  useEffect(() => {
    const setupMobile = async () => {
      try {
        // Configure status bar
        await StatusBar.setStyle({ style: StatusBarStyle.Light })
        await StatusBar.setBackgroundColor({ color: '#1f2937' })
        
        // Keep screen awake during active tracking
        if (activeTime.active) {
          await KeepAwake.keepAwake()
        } else {
          await KeepAwake.allowSleep()
        }
        
        // Get initial location
        await getCurrentLocation()
        
        // Update pending actions count
        const queueLength = await offlineQueue.getQueueLength()
        setPendingActionsCount(queueLength)
        
        // Initialize push notifications
        if (user?.id) {
          await pushNotificationManager.initialize(user.id)
          pushNotificationManager.setupListeners(user.id)
          
          // Schedule time tracking reminder
          await pushNotificationManager.scheduleTimeTrackingReminder()
        }
        
      } catch (error) {
        console.error('Mobile setup error:', error)
      }
    }
    
    setupMobile()
  }, [activeTime.active, user?.id])
  
  // Process offline queue when network comes back online
  useEffect(() => {
    if (networkStatus.connected && pendingActionsCount > 0) {
      processOfflineQueue()
    }
  }, [networkStatus.connected, pendingActionsCount])
  
  // Live timer updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Load data when online
  useEffect(() => {
    if (networkStatus.connected) {
      loadProjects()
      refreshData()
      fetchDeliveryNotes()
    }
  }, [networkStatus.connected, refreshData, fetchDeliveryNotes])
  
  // Get current location
  const getCurrentLocation = async () => {
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })
      
      setCurrentLocation({
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude
      })
      
      return coordinates
    } catch (error) {
      console.error('Location error:', error)
      return null
    }
  }
  
  // Load projects with fallback
  const loadProjects = async () => {
    try {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            customer:customers(
              id,
              name,
              email
            )
          `)
          .eq('status', 'active')
          .order('name')
        
        if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
          throw error
        }
        
        setProjects(data || [])
      } catch (error: any) {
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          console.warn('Projects table not found, using mock data')
          // Mock projects for demo
          setProjects([
            {
              id: 'mock-project-1',
              name: 'Demo Baustelle Nord',
              customer: {
                id: 'mock-customer-1',
                name: 'Mustermann GmbH',
                email: 'info@mustermann.de'
              }
            },
            {
              id: 'mock-project-2', 
              name: 'Bürogebäude Zentrum',
              customer: {
                id: 'mock-customer-2',
                name: 'Bau AG',
                email: 'contact@bau-ag.de'
              }
            },
            {
              id: 'mock-project-3',
              name: 'Wohnanlage Süd',
              customer: {
                id: 'mock-customer-3',
                name: 'Immobilien Partners',
                email: 'office@immobilien-partners.de'
              }
            }
          ])
        } else {
          throw error
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      setProjects([])
    }
  }
  
  // Process offline queue
  const processOfflineQueue = async () => {
    try {
      await offlineQueue.processQueue(supabase)
      const queueLength = await offlineQueue.getQueueLength()
      setPendingActionsCount(queueLength)
      
      if (queueLength === 0) {
        toast.success('Alle Offline-Aktionen erfolgreich synchronisiert')
      }
    } catch (error) {
      console.error('Error processing offline queue:', error)
    }
  }
  
  // Haptic feedback
  const triggerHaptic = (style: ImpactStyle = ImpactStyle.Medium) => {
    try {
      Haptics.impact({ style })
    } catch (error) {
      // Haptics not available
    }
  }
  
  // Calculate live duration
  const getLiveDuration = () => {
    if (!activeTime.active || !activeTime.segment?.started_at) return 0
    
    const start = new Date(activeTime.segment.started_at)
    const diff = Math.floor((currentTime.getTime() - start.getTime()) / 1000 / 60)
    return Math.max(0, diff)
  }
  
  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }
  
  // Handle start tracking
  const handleStart = async () => {
    if (!selectedProject) {
      toast.error('Bitte wählen Sie ein Projekt aus')
      return
    }
    
    triggerHaptic(ImpactStyle.Light)
    
    if (!networkStatus.connected) {
      await getCurrentLocation()
      await offlineQueue.addAction('START_TIME', {
        employee_id: user?.id,
        project_id: selectedProject,
        notes: description,
        location: currentLocation
      })
      
      const queueLength = await offlineQueue.getQueueLength()
      setPendingActionsCount(queueLength)
      toast.info('Aktion für Offline-Verarbeitung gespeichert')
      return
    }
    
    await getCurrentLocation()
    await startTracking(selectedProject, segmentType, description || undefined)
    setDescription('')
  }
  
  // Handle stop tracking
  const handleStop = async () => {
    triggerHaptic(ImpactStyle.Heavy)
    
    if (!networkStatus.connected) {
      await getCurrentLocation()
      await offlineQueue.addAction('STOP_TIME', {
        employee_id: user?.id,
        notes,
        location: currentLocation
      })
      
      const queueLength = await offlineQueue.getQueueLength()
      setPendingActionsCount(queueLength)
      toast.info('Aktion für Offline-Verarbeitung gespeichert')
      return
    }
    
    await stopTracking(notes || undefined)
    setNotes('')
  }
  
  // Handle switch project
  const handleSwitch = async () => {
    if (!selectedProject) {
      toast.error('Bitte wählen Sie ein Projekt aus')
      return
    }
    
    triggerHaptic(ImpactStyle.Light)
    
    if (!networkStatus.connected) {
      await getCurrentLocation()
      await offlineQueue.addAction('SWITCH_TIME', {
        employee_id: user?.id,
        project_id: selectedProject,
        notes: description,
        location: currentLocation
      })
      
      const queueLength = await offlineQueue.getQueueLength()
      setPendingActionsCount(queueLength)
      toast.info('Aktion für Offline-Verarbeitung gespeichert')
      return
    }
    
    // Stop current tracking if active, then start new
    if (activeTime.active) {
      await stopTracking(notes)
    }
    const project = projects.find(p => p.id === selectedProject)
    await startTracking(selectedProject, segmentType, description, project?.name)
    setDescription('')
    setNotes('')
    setShowProjectSheet(false)
  }
  
  // Handle signature save
  const handleSignatureSave = async (signature: { svg: string; name: string }) => {
    if (!selectedDeliveryNote) return
    
    if (!networkStatus.connected) {
      await getCurrentLocation()
      await offlineQueue.addAction('SIGN_DELIVERY_NOTE', {
        delivery_note_id: selectedDeliveryNote.id,
        signature_data: { svg: signature.svg },
        signer_name: signature.name,
        location: currentLocation
      })
      
      const queueLength = await offlineQueue.getQueueLength()
      setPendingActionsCount(queueLength)
      toast.info('Signatur für Offline-Verarbeitung gespeichert')
      setShowSignatureDialog(false)
      return
    }
    
    await signDeliveryNote(
      selectedDeliveryNote.id,
      { svg: signature.svg },
      signature.name
    )
    
    setShowSignatureDialog(false)
    setSelectedDeliveryNote(null)
  }
  
  // Get segment type icon and label
  const getSegmentConfig = (type: string) => {
    switch (type) {
      case 'work': return { icon: Clock, label: 'Arbeitszeit', color: 'bg-green-500' }
      case 'break': return { icon: Coffee, label: 'Pause', color: 'bg-orange-500' }
      case 'drive': return { icon: Car, label: 'Fahrtzeit', color: 'bg-blue-500' }
      default: return { icon: Clock, label: 'Arbeitszeit', color: 'bg-green-500' }
    }
  }
  
  // Get unsigned delivery notes for current user
  const unsignedDeliveryNotes = deliveryNotes?.filter(note => 
    note.status === 'sent' && !note.signed_at
  ) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 pb-20">
      
      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Time Tracking Controls */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              {activeTime.active ? 'Laufende Zeiterfassung' : 'Zeiterfassung starten'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeTime.active ? (
              <>
                {/* Project Selection */}
                <div className="space-y-2">
                  <Label>Projekt auswählen</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Projekt wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex flex-col items-start py-1">
                            <span className="font-medium">{project.name}</span>
                            {project.customer && (
                              <span className="text-sm text-muted-foreground">
                                {project.customer.name}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Segment Type */}
                <div className="space-y-2">
                  <Label>Typ der Erfassung</Label>
                  <Select value={segmentType} onValueChange={(value: any) => setSegmentType(value)}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Arbeitszeit
                        </div>
                      </SelectItem>
                      <SelectItem value="break">
                        <div className="flex items-center gap-2">
                          <Coffee className="h-4 w-4" />
                          Pause
                        </div>
                      </SelectItem>
                      <SelectItem value="drive">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          Fahrtzeit
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Description */}
                <div className="space-y-2">
                  <Label>Beschreibung (optional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Was werden Sie arbeiten?"
                    rows={2}
                    className="text-base resize-none"
                  />
                </div>
                
                {/* Start Button */}
                <Button 
                  onClick={handleStart}
                  disabled={!selectedProject || isLoading}
                  size="lg"
                  className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <Play className="h-6 w-6 mr-2" />
                  Zeiterfassung starten
                </Button>
              </>
            ) : (
              <>
                {/* Notes for active session */}
                <div className="space-y-2">
                  <Label>Notizen hinzufügen</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notizen für diese Arbeitszeit..."
                    rows={2}
                    className="text-base resize-none"
                  />
                </div>
                
                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button 
                    onClick={handleStop}
                    disabled={isLoading}
                    size="lg"
                    variant="destructive"
                    className="w-full h-14 text-lg"
                  >
                    <Square className="h-6 w-6 mr-2" />
                    Zeiterfassung beenden
                  </Button>
                  
                  <Sheet open={showProjectSheet} onOpenChange={setShowProjectSheet}>
                    <SheetTrigger asChild>
                      <Button 
                        variant="outline"
                        size="lg"
                        className="w-full h-12 text-base border-2"
                      >
                        <RotateCcw className="h-5 w-5 mr-2" />
                        Projekt wechseln
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80vh]">
                      <SheetHeader className="text-left pb-4">
                        <SheetTitle>Projekt wechseln</SheetTitle>
                        <SheetDescription>
                          Aktuelle Erfassung wird automatisch beendet und neue gestartet.
                        </SheetDescription>
                      </SheetHeader>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Neues Projekt</Label>
                          <Select value={selectedProject} onValueChange={setSelectedProject}>
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue placeholder="Neues Projekt wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  <div className="flex flex-col items-start py-1">
                                    <span className="font-medium">{project.name}</span>
                                    {project.customer && (
                                      <span className="text-sm text-muted-foreground">
                                        {project.customer.name}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Neue Beschreibung</Label>
                          <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Beschreibung für das neue Projekt..."
                            rows={2}
                            className="text-base resize-none"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Notizen für vorherige Erfassung</Label>
                          <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Abschlussnotizen..."
                            rows={2}
                            className="text-base resize-none"
                          />
                        </div>
                        
                        <Button 
                          onClick={handleSwitch}
                          disabled={!selectedProject || isLoading}
                          size="lg"
                          className="w-full h-14 text-lg bg-gradient-to-r from-blue-500 to-indigo-500"
                        >
                          <RotateCcw className="h-6 w-6 mr-2" />
                          Projekt wechseln
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Unsigned Delivery Notes */}
        {unsignedDeliveryNotes.length > 0 && (
          <Card className="border-0 shadow-lg border-orange-200 bg-orange-50 dark:bg-orange-950">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
                <PenTool className="h-5 w-5" />
                Zu signierende Lieferscheine ({unsignedDeliveryNotes.length})
              </CardTitle>
              <CardDescription className="text-orange-700 dark:text-orange-300">
                Diese Lieferscheine warten auf Ihre Unterschrift
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {unsignedDeliveryNotes.slice(0, 3).map((note) => (
                <div 
                  key={note.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{note.number}</div>
                    <div className="text-sm text-muted-foreground">
                      {note.project?.name} • {note.project?.customer.name}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedDeliveryNote(note)
                      setShowSignatureDialog(true)
                    }}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <PenTool className="h-4 w-4 mr-1" />
                    Signieren
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        
        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className={`inline-flex items-center gap-2 ${networkStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
                {networkStatus.connected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                <span className="font-medium">{networkStatus.connected ? 'Online' : 'Offline'}</span>
              </div>
              {pendingActionsCount > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {pendingActionsCount} wartende Aktion(en)
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className={`inline-flex items-center gap-2 ${currentLocation ? 'text-blue-600' : 'text-gray-400'}`}>
                <MapPin className="h-5 w-5" />
                <span className="font-medium">Standort</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {currentLocation ? 'Verfügbar' : 'Nicht verfügbar'}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Offline Warning */}
        {!networkStatus.connected && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-orange-900 dark:text-orange-100">
                    Offline-Modus aktiv
                  </div>
                  <div className="text-sm text-orange-700 dark:text-orange-300">
                    Alle Aktionen werden gespeichert und synchronisiert, sobald eine Internetverbindung verfügbar ist.
                  </div>
                  {pendingActionsCount > 0 && (
                    <div className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      {pendingActionsCount} Aktion(en) warten auf Synchronisation
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Success indicator */}
        {networkStatus.connected && pendingActionsCount === 0 && activeTime.active && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="font-medium text-green-900 dark:text-green-100">
                  Zeiterfassung läuft und wird live synchronisiert
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Signature Dialog */}
      <SignatureCapture
        isOpen={showSignatureDialog}
        onClose={() => {
          setShowSignatureDialog(false)
          setSelectedDeliveryNote(null)
        }}
        onSave={handleSignatureSave}
        title={`Lieferschein ${selectedDeliveryNote?.number} signieren`}
        description="Bitte unterschreiben Sie zur Bestätigung des Erhalts der Leistungen"
      />
    </div>
  )
}

export default EnhancedMobileTimeTracker