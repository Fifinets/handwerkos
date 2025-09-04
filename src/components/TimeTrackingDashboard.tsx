import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  Play, 
  Square, 
  RotateCcw, 
  Clock, 
  MapPin,
  Calendar,
  Coffee,
  Car,
  AlertCircle,
  CheckCircle2,
  Timer,
  MoreHorizontal
} from "lucide-react"
import { useTimeTracking } from "@/hooks/useTimeTracking"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface Project {
  id: string
  name: string
  customer?: {
    name: string
  }
}

const TimeTrackingDashboard: React.FC = () => {
  const { 
    activeTime, 
    isLoading, 
    segments,
    startTracking, 
    stopTracking, 
    switchProject,
    fetchTimeSegments
  } = useTimeTracking()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [segmentType, setSegmentType] = useState<'work' | 'break' | 'drive'>('work')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [showStopDialog, setShowStopDialog] = useState(false)
  
  // Aktuelle Zeit für Live-Updates
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Projekte laden
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            customer:customers(name)
          `)
          .eq('status', 'active')
          .order('name')
        
        if (error) throw error
        setProjects(data || [])
      } catch (error) {
        console.error('Error fetching projects:', error)
        toast.error('Fehler beim Laden der Projekte')
      }
    }
    
    fetchProjects()
    fetchTimeSegments() // Load recent segments
  }, [fetchTimeSegments])
  
  // Live Zeit-Updates alle Sekunde
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Berechnete Live-Duration
  const getLiveDuration = () => {
    if (!activeTime.active || !activeTime.segment?.started_at) return 0
    
    const start = new Date(activeTime.segment.started_at)
    const diff = Math.floor((currentTime.getTime() - start.getTime()) / 1000 / 60)
    return Math.max(0, diff)
  }
  
  // Format duration helper
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
    
    await startTracking(selectedProject, segmentType, description || undefined)
    setDescription('')
  }
  
  // Handle stop tracking
  const handleStop = async () => {
    await stopTracking(notes || undefined)
    setNotes('')
    setShowStopDialog(false)
  }
  
  // Handle project switch
  const handleSwitch = async () => {
    if (!selectedProject) {
      toast.error('Bitte wählen Sie ein Projekt aus')
      return
    }
    
    await switchProject(selectedProject, segmentType, description || undefined, notes || undefined)
    setDescription('')
    setNotes('')
  }
  
  // Get segment type icon
  const getSegmentIcon = (type: string) => {
    switch (type) {
      case 'work': return <Clock className="h-4 w-4" />
      case 'break': return <Coffee className="h-4 w-4" />
      case 'drive': return <Car className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'completed': return 'bg-blue-500'
      case 'paused': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <Card className={`transition-all duration-300 ${
        activeTime.active 
          ? 'border-green-500 bg-green-50 dark:bg-green-950' 
          : 'border-gray-200'
      }`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {activeTime.active ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                      Aktiv
                    </div>
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    Zeiterfassung
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {activeTime.active
                  ? `Läuft seit ${new Date(activeTime.segment!.started_at).toLocaleTimeString('de-DE')}`
                  : 'Keine aktive Zeiterfassung'
                }
              </CardDescription>
            </div>
            
            {activeTime.active && (
              <div className="text-right">
                <div className="text-2xl font-mono font-bold text-green-600 dark:text-green-400">
                  {formatDuration(getLiveDuration())}
                </div>
                <div className="text-sm text-muted-foreground">
                  {activeTime.segment?.project_name || 'Kein Projekt'}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Active Session Info */}
          {activeTime.active && activeTime.segment && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white dark:bg-gray-900 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">PROJEKT</Label>
                <div className="font-medium">{activeTime.segment.project_name || 'Kein Projekt'}</div>
                {activeTime.segment.customer_name && (
                  <div className="text-sm text-muted-foreground">{activeTime.segment.customer_name}</div>
                )}
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">TYP</Label>
                <Badge variant="outline" className="w-fit">
                  {getSegmentIcon(activeTime.segment.segment_type)}
                  <span className="ml-1 capitalize">{activeTime.segment.segment_type}</span>
                </Badge>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">BESCHREIBUNG</Label>
                <div className="text-sm">
                  {activeTime.segment.description || 'Keine Beschreibung'}
                </div>
              </div>
            </div>
          )}
          
          {/* Controls */}
          <div className="space-y-4">
            {/* Project Selection */}
            {!activeTime.active && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project">Projekt auswählen</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Projekt wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex flex-col items-start">
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
                  <Label htmlFor="type">Typ</Label>
                  <Select value={segmentType} onValueChange={(value: any) => setSegmentType(value)}>
                    <SelectTrigger>
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
              </div>
            )}
            
            {/* Description Input */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {activeTime.active ? 'Notizen hinzufügen' : 'Beschreibung (optional)'}
              </Label>
              <Textarea
                id="description"
                value={activeTime.active ? notes : description}
                onChange={(e) => activeTime.active ? setNotes(e.target.value) : setDescription(e.target.value)}
                placeholder={activeTime.active ? 'Notizen für diese Session...' : 'Beschreibung der Tätigkeit...'}
                rows={2}
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              {!activeTime.active ? (
                <Button 
                  onClick={handleStart} 
                  disabled={!selectedProject || isLoading}
                  className="flex-1"
                  size="lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Starten
                </Button>
              ) : (
                <>
                  <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="lg" className="flex-1">
                        <Square className="h-4 w-4 mr-2" />
                        Stoppen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Zeiterfassung beenden</DialogTitle>
                        <DialogDescription>
                          Möchten Sie die aktuelle Zeiterfassung beenden?
                          <div className="mt-2 p-3 bg-muted rounded-lg">
                            <div className="text-sm">
                              <strong>Dauer:</strong> {formatDuration(getLiveDuration())}<br/>
                              <strong>Projekt:</strong> {activeTime.segment?.project_name}<br/>
                              <strong>Typ:</strong> {activeTime.segment?.segment_type}
                            </div>
                          </div>
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="stop-notes">Abschließende Notizen</Label>
                          <Textarea
                            id="stop-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional: Notizen zum Abschluss..."
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowStopDialog(false)}>
                          Abbrechen
                        </Button>
                        <Button onClick={handleStop} disabled={isLoading}>
                          <Square className="h-4 w-4 mr-2" />
                          Beenden
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  {selectedProject && selectedProject !== activeTime.segment?.project_id && (
                    <Button onClick={handleSwitch} disabled={isLoading} size="lg" className="flex-1">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Wechseln
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Recent Time Segments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Letzte Zeiterfassungen
          </CardTitle>
          <CardDescription>
            Ihre letzten Arbeitszeiten im Überblick
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {segments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Zeiterfassungen gefunden</p>
                <p className="text-sm">Starten Sie Ihre erste Zeiterfassung oben</p>
              </div>
            ) : (
              segments.slice(0, 10).map((segment) => (
                <div
                  key={segment.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${getStatusColor(segment.status)}`} />
                    
                    <div className="space-y-1">
                      <div className="font-medium">
                        {segment.project?.name || 'Kein Projekt'}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(segment.started_at).toLocaleDateString('de-DE')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(segment.started_at).toLocaleTimeString('de-DE', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                          {segment.ended_at && (
                            <> - {new Date(segment.ended_at).toLocaleTimeString('de-DE', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}</>
                          )}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getSegmentIcon(segment.segment_type)}
                          <span className="ml-1">{segment.segment_type}</span>
                        </Badge>
                      </div>
                      {segment.description && (
                        <div className="text-sm text-muted-foreground">
                          {segment.description}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right space-y-1">
                    <div className="font-mono font-medium">
                      {segment.duration_minutes_computed 
                        ? formatDuration(segment.duration_minutes_computed)
                        : segment.status === 'active' 
                          ? 'Läuft...'
                          : '-'
                      }
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {segment.status === 'active' && <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />}
                      <span className="capitalize">{segment.status}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {segments.length > 10 && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => fetchTimeSegments()}>
                Mehr anzeigen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TimeTrackingDashboard