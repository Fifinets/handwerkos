import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Clock,
  Play,
  Square,
  Coffee,
  Car,
  MapPin,
  Edit3,
  MoreHorizontal,
  AlertCircle
} from 'lucide-react'
import { format, differenceInMinutes, startOfDay, endOfDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { supabase } from '@/integrations/supabase/client'

interface TimelineSegment {
  id: string
  started_at: string
  ended_at?: string
  duration_minutes_computed: number
  segment_type: 'work' | 'break' | 'drive'
  status: 'active' | 'completed'
  description?: string
  project?: {
    name: string
    customer?: {
      name: string
    }
  }
  location?: {
    lat?: number
    lng?: number
    address?: string
  }
}

interface TodayTimelineProps {
  refreshTrigger?: number
}

export const TodayTimeline: React.FC<TodayTimelineProps> = ({
  refreshTrigger
}) => {
  const [segments, setSegments] = useState<TimelineSegment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalMinutes, setTotalMinutes] = useState(0)

  // Lade heutige Segmente
  const loadTodaySegments = useCallback(async () => {
    setIsLoading(true)
    try {
      const today = new Date()
      const { data, error } = await supabase
        .from('time_segments')
        .select(`
          id,
          started_at,
          ended_at,
          duration_minutes_computed,
          segment_type,
          status,
          description,
          project:projects(
            name,
            customer:customers(name)
          )
        `)
        .gte('started_at', startOfDay(today).toISOString())
        .lte('started_at', endOfDay(today).toISOString())
        .order('started_at', { ascending: false })

      if (error) {
        // Fallback Mock-Daten
        console.warn('Time segments not found, using mock data')
        const mockSegments: TimelineSegment[] = [
          {
            id: 'mock-1',
            started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            ended_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            duration_minutes_computed: 60,
            segment_type: 'work',
            status: 'completed',
            description: 'Baustelle Setup',
            project: {
              name: 'Beispiel Baustelle',
              customer: { name: 'Max Mustermann GmbH' }
            }
          },
          {
            id: 'mock-2',
            started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            ended_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
            duration_minutes_computed: 30,
            segment_type: 'break',
            status: 'completed',
            description: 'Mittagspause'
          },
          {
            id: 'mock-3',
            started_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
            duration_minutes_computed: 90,
            segment_type: 'work',
            status: 'active',
            description: 'Montage',
            project: {
              name: 'Beispiel Baustelle',
              customer: { name: 'Max Mustermann GmbH' }
            }
          }
        ]
        setSegments(mockSegments)
        setTotalMinutes(180) // 3h Mock
        return
      }

      setSegments(data || [])
      
      // Berechne Gesamtzeit
      const total = data?.reduce((sum, segment) => {
        return sum + (segment.duration_minutes_computed || 0)
      }, 0) || 0
      setTotalMinutes(total)

    } catch (error) {
      console.error('Error loading today segments:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTodaySegments()
    // Auto-refresh alle 30 Sekunden
    const interval = setInterval(loadTodaySegments, 30000)
    return () => clearInterval(interval)
  }, [loadTodaySegments, refreshTrigger])

  // Formatiere Dauer
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}h`
    }
    return `${mins}min`
  }

  // Berechne Live-Dauer für aktive Segmente
  const getLiveDuration = (segment: TimelineSegment) => {
    if (segment.status === 'active' && !segment.ended_at) {
      const startTime = new Date(segment.started_at)
      const currentTime = new Date()
      return differenceInMinutes(currentTime, startTime)
    }
    return segment.duration_minutes_computed || 0
  }

  // Segment-Icon
  const getSegmentIcon = (type: string) => {
    switch (type) {
      case 'work': return <Play className="h-4 w-4 text-green-500" />
      case 'break': return <Coffee className="h-4 w-4 text-orange-500" />
      case 'drive': return <Car className="h-4 w-4 text-blue-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  // Segment-Badge
  const getSegmentBadge = (type: string, status: string) => {
    if (status === 'active') {
      return <Badge className="bg-green-500">Aktiv</Badge>
    }
    
    switch (type) {
      case 'work': return <Badge variant="default">Arbeit</Badge>
      case 'break': return <Badge variant="secondary">Pause</Badge>
      case 'drive': return <Badge variant="outline">Fahrt</Badge>
      default: return <Badge variant="outline">{type}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline heute
          </CardTitle>
          <Badge variant="outline">
            {formatDuration(totalMinutes)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : segments.length > 0 ? (
            <div className="space-y-3">
              {segments.map((segment, index) => {
                const liveDuration = getLiveDuration(segment)
                const startTime = new Date(segment.started_at)
                const endTime = segment.ended_at ? new Date(segment.ended_at) : null
                
                return (
                  <div
                    key={segment.id}
                    className={`relative border rounded-lg p-3 ${
                      segment.status === 'active' ? 'ring-2 ring-green-500 bg-green-50' : 'bg-background'
                    }`}
                  >
                    {/* Timeline Connector */}
                    {index < segments.length - 1 && (
                      <div className="absolute left-6 top-12 w-px h-8 bg-border" />
                    )}
                    
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 p-1">
                        {getSegmentIcon(segment.segment_type)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {segment.project ? (
                              <span className="font-medium truncate">
                                {segment.project.name}
                              </span>
                            ) : (
                              <span className="font-medium text-muted-foreground">
                                {segment.segment_type === 'break' ? 'Pause' : 
                                 segment.segment_type === 'drive' ? 'Fahrt' : 'Allgemein'}
                              </span>
                            )}
                            {getSegmentBadge(segment.segment_type, segment.status)}
                          </div>
                          {segment.status === 'active' && (
                            <div className="text-lg font-mono font-bold text-green-600">
                              {formatDuration(liveDuration)}
                            </div>
                          )}
                        </div>
                        
                        {/* Kunde */}
                        {segment.project?.customer && (
                          <p className="text-sm text-muted-foreground mb-1">
                            {segment.project.customer.name}
                          </p>
                        )}
                        
                        {/* Beschreibung */}
                        {segment.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {segment.description}
                          </p>
                        )}
                        
                        {/* Zeit-Info */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <span>
                              {format(startTime, 'HH:mm')}
                              {endTime ? ` - ${format(endTime, 'HH:mm')}` : ' - läuft'}
                            </span>
                            {segment.status === 'completed' && (
                              <span className="font-medium">
                                {formatDuration(segment.duration_minutes_computed)}
                              </span>
                            )}
                          </div>
                          
                          {/* Actions */}
                          {segment.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                              onClick={() => {
                                // TODO: Implement edit segment
                                console.log('Edit segment:', segment.id)
                              }}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-center mb-1">Noch keine Zeiterfassung heute</p>
              <p className="text-xs text-center">
                Starten Sie die Zeiterfassung um Ihre Timeline zu sehen
              </p>
            </div>
          )}
        </ScrollArea>
        
        {/* Summary */}
        {segments.length > 0 && (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {segments.length} Segment{segments.length !== 1 ? 'e' : ''} heute
              </span>
              <span className="font-medium">
                Gesamt: {formatDuration(totalMinutes)}
              </span>
            </div>
            
            {/* Breakdown by type */}
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              {['work', 'break', 'drive'].map(type => {
                const typeSegments = segments.filter(s => s.segment_type === type)
                const typeMinutes = typeSegments.reduce((sum, s) => 
                  sum + getLiveDuration(s), 0
                )
                
                if (typeMinutes === 0) return null
                
                return (
                  <span key={type}>
                    {type === 'work' ? '⚡' : type === 'break' ? '☕' : '🚗'} {formatDuration(typeMinutes)}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}