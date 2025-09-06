import React, { useState, useEffect, useCallback } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { de } from 'date-fns/locale'
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  User,
  Filter,
  Eye,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ConflictDetector } from './ConflictDetector'

interface TimeSegment {
  id: string
  employee_id: string
  project_id: string | null
  started_at: string
  ended_at: string | null
  duration_minutes_computed: number
  segment_type: 'work' | 'break' | 'drive'
  status: string
  description: string | null
  approved_minutes: number | null
  approved_at: string | null
  employee?: {
    first_name: string
    last_name: string
  }
  project?: {
    name: string
    customer?: {
      name: string
    }
  }
}

interface TimeRule {
  id: string
  name: string
  round_to_minutes: number
  round_direction: 'up' | 'down' | 'nearest'
  min_work_duration_minutes: number
  auto_break_after_minutes: number
  auto_break_duration_minutes: number
  is_active: boolean
}

interface ApprovalPreview {
  segment_id: string
  employee_name: string
  project_name: string
  date: string
  started_at: string
  ended_at: string
  segment_type: string
  original_minutes: number
  approved_minutes: number
  difference_minutes: number
  description: string | null
}

export const TimeApprovalManager: React.FC = () => {
  const [segments, setSegments] = useState<TimeSegment[]>([])
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [employees, setEmployees] = useState<any[]>([])
  const [timeRules, setTimeRules] = useState<TimeRule[]>([])
  const [selectedRule, setSelectedRule] = useState<string>('Standard')
  const [applyRules, setApplyRules] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState<{
    segments: ApprovalPreview[]
    summary: any
  } | null>(null)
  const [groupByEmployee, setGroupByEmployee] = useState(true)
  const [activeTab, setActiveTab] = useState('approval')

  // Lade Mitarbeiter
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, role')
        .order('first_name')
      
      if (error) {
        console.error('Error fetching employees:', error)
      } else {
        setEmployees(data || [])
      }
    }
    fetchEmployees()
  }, [])

  // Lade Zeitregeln
  useEffect(() => {
    const fetchTimeRules = async () => {
      const { data, error } = await supabase
        .from('time_rules')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      if (error) {
        console.error('Error fetching time rules:', error)
        setTimeRules([{
          id: 'default',
          name: 'Standard',
          round_to_minutes: 15,
          round_direction: 'nearest',
          min_work_duration_minutes: 0,
          auto_break_after_minutes: 360,
          auto_break_duration_minutes: 30,
          is_active: true
        }])
      } else {
        setTimeRules(data || [])
      }
    }
    fetchTimeRules()
  }, [])

  // Berechne Datumsgrenzen
  const getDateRange = useCallback(() => {
    const now = new Date()
    switch (dateRange) {
      case 'today':
        return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
      case 'week':
        return { 
          from: format(startOfWeek(now, { locale: de }), 'yyyy-MM-dd'),
          to: format(endOfWeek(now, { locale: de }), 'yyyy-MM-dd')
        }
      case 'month':
        return { 
          from: format(startOfMonth(now), 'yyyy-MM-dd'),
          to: format(endOfMonth(now), 'yyyy-MM-dd')
        }
    }
  }, [dateRange])

  // Lade Zeitsegmente
  const fetchSegments = useCallback(async () => {
    setIsLoading(true)
    const { from, to } = getDateRange()
    
    try {
      let query = supabase
        .from('time_segments')
        .select(`
          *,
          employee:employees(first_name, last_name),
          project:projects(name, customer:customers(name))
        `)
        .eq('status', 'completed')
        .is('approved_at', null)
        .gte('started_at', from + 'T00:00:00')
        .lte('started_at', to + 'T23:59:59')
        .order('started_at', { ascending: false })
      
      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching segments:', error)
        toast.error('Fehler beim Laden der Zeitsegmente')
      } else {
        setSegments(data || [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [getDateRange, selectedEmployee])

  useEffect(() => {
    fetchSegments()
  }, [fetchSegments])

  // Vorschau anzeigen
  const handlePreview = async () => {
    if (selectedSegments.size === 0) {
      toast.error('Bitte wählen Sie mindestens ein Segment aus')
      return
    }
    
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('rpc_preview_time_approval', {
        p_segment_ids: Array.from(selectedSegments),
        p_rule_name: selectedRule
      })
      
      if (error) throw error
      
      setPreview({
        segments: data.preview_segments || [],
        summary: data.summary || {}
      })
      setShowPreview(true)
    } catch (error: any) {
      console.error('Preview error:', error)
      toast.error('Fehler bei der Vorschau')
    } finally {
      setIsLoading(false)
    }
  }

  // Segmente genehmigen
  const handleApprove = async () => {
    if (selectedSegments.size === 0) {
      toast.error('Bitte wählen Sie mindestens ein Segment aus')
      return
    }
    
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('rpc_approve_time_segments', {
        p_segment_ids: Array.from(selectedSegments),
        p_apply_rules: applyRules,
        p_rule_name: selectedRule
      })
      
      if (error) throw error
      
      toast.success(`${data.approved_count} Segmente erfolgreich genehmigt`)
      
      // Reset und neu laden
      setSelectedSegments(new Set())
      setShowPreview(false)
      fetchSegments()
    } catch (error: any) {
      console.error('Approval error:', error)
      toast.error('Fehler bei der Genehmigung')
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle Segment-Auswahl
  const toggleSegmentSelection = (segmentId: string) => {
    const newSelection = new Set(selectedSegments)
    if (newSelection.has(segmentId)) {
      newSelection.delete(segmentId)
    } else {
      newSelection.add(segmentId)
    }
    setSelectedSegments(newSelection)
  }

  // Alle auswählen/abwählen
  const toggleAllSegments = () => {
    if (selectedSegments.size === segments.length) {
      setSelectedSegments(new Set())
    } else {
      setSelectedSegments(new Set(segments.map(s => s.id)))
    }
  }

  // Gruppiere Segmente nach Mitarbeiter
  const groupedSegments = React.useMemo(() => {
    if (!groupByEmployee) return { 'all': segments }
    
    return segments.reduce((acc, segment) => {
      const key = segment.employee 
        ? `${segment.employee.first_name} ${segment.employee.last_name}`
        : 'Unbekannt'
      if (!acc[key]) acc[key] = []
      acc[key].push(segment)
      return acc
    }, {} as Record<string, TimeSegment[]>)
  }, [segments, groupByEmployee])

  // Formatiere Minuten als Stunden:Minuten
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="conflicts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Konflikte prüfen
          </TabsTrigger>
          <TabsTrigger value="approval" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Zeiten freigeben
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Konfliktanalyse
              </CardTitle>
              <CardDescription>
                Automatische Erkennung von Zeiterfassungs-Konflikten und Anomalien
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filter für Konfliktanalyse */}
              <div className="flex flex-wrap gap-4 mb-6">
                <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Zeitraum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Heute</SelectItem>
                    <SelectItem value="week">Diese Woche</SelectItem>
                    <SelectItem value="month">Dieser Monat</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Mitarbeiter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ConflictDetector 
                dateFrom={getDateRange().from}
                dateTo={getDateRange().to}
                employeeId={selectedEmployee !== 'all' ? selectedEmployee : undefined}
                onRefresh={fetchSegments}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Zeitfreigabe Manager
              </CardTitle>
              <CardDescription>
                Prüfen und genehmigen Sie erfasste Arbeitszeiten
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filter-Bereich */}
              <div className="flex flex-wrap gap-4 mb-6">
                <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Zeitraum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Heute</SelectItem>
                    <SelectItem value="week">Diese Woche</SelectItem>
                    <SelectItem value="month">Dieser Monat</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Mitarbeiter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedRule} onValueChange={setSelectedRule}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Regel" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeRules.map(rule => (
                      <SelectItem key={rule.id} value={rule.name}>
                        {rule.name} ({rule.round_to_minutes} Min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="apply-rules"
                    checked={applyRules}
                    onCheckedChange={(checked) => setApplyRules(!!checked)}
                  />
                  <label htmlFor="apply-rules" className="text-sm font-medium">
                    Regeln anwenden
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="group-by-employee"
                    checked={groupByEmployee}
                    onCheckedChange={(checked) => setGroupByEmployee(!!checked)}
                  />
                  <label htmlFor="group-by-employee" className="text-sm font-medium">
                    Nach Mitarbeiter gruppieren
                  </label>
                </div>
              </div>

              {/* Statistik-Karten */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{segments.length}</div>
                    <p className="text-xs text-muted-foreground">Offene Segmente</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{selectedSegments.size}</div>
                    <p className="text-xs text-muted-foreground">Ausgewählt</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {formatMinutes(segments.reduce((sum, s) => sum + s.duration_minutes_computed, 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">Gesamt-Stunden</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {Object.keys(groupedSegments).length}
                    </div>
                    <p className="text-xs text-muted-foreground">Mitarbeiter</p>
                  </CardContent>
                </Card>
              </div>

              {/* Segment-Tabelle */}
              <ScrollArea className="h-[500px] border rounded-lg">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        checked={selectedSegments.size === segments.length && segments.length > 0}
                        onCheckedChange={toggleAllSegments}
                      />
                      <span className="text-sm font-medium">Alle auswählen</span>
                    </div>
                  </div>

                  {Object.entries(groupedSegments).map(([employeeName, employeeSegments]) => (
                    <div key={employeeName} className="mb-6">
                      {groupByEmployee && (
                        <div className="flex items-center gap-2 mb-3">
                          <User className="h-4 w-4" />
                          <h3 className="font-semibold">{employeeName}</h3>
                          <Badge variant="secondary">
                            {employeeSegments.length} Segmente
                          </Badge>
                          <Badge variant="outline">
                            {formatMinutes(employeeSegments.reduce((sum, s) => sum + s.duration_minutes_computed, 0))} Stunden
                          </Badge>
                        </div>
                      )}

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead>Von - Bis</TableHead>
                            <TableHead>Projekt</TableHead>
                            <TableHead>Typ</TableHead>
                            <TableHead>Beschreibung</TableHead>
                            <TableHead className="text-right">Dauer</TableHead>
                            {applyRules && (
                              <TableHead className="text-right">Gerundet</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeeSegments.map(segment => {
                            const isSelected = selectedSegments.has(segment.id)
                            const startTime = new Date(segment.started_at)
                            const endTime = segment.ended_at ? new Date(segment.ended_at) : null
                            
                            return (
                              <TableRow 
                                key={segment.id}
                                className={isSelected ? 'bg-muted/50' : ''}
                              >
                                <TableCell>
                                  <Checkbox 
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSegmentSelection(segment.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  {format(startTime, 'dd.MM.yyyy', { locale: de })}
                                </TableCell>
                                <TableCell>
                                  {format(startTime, 'HH:mm')} - {endTime ? format(endTime, 'HH:mm') : '...'}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">
                                      {segment.project?.name || 'Allgemein'}
                                    </div>
                                    {segment.project?.customer && (
                                      <div className="text-xs text-muted-foreground">
                                        {segment.project.customer.name}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    segment.segment_type === 'work' ? 'default' :
                                    segment.segment_type === 'break' ? 'secondary' : 'outline'
                                  }>
                                    {segment.segment_type === 'work' ? 'Arbeit' :
                                     segment.segment_type === 'break' ? 'Pause' : 'Fahrt'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {segment.description || '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatMinutes(segment.duration_minutes_computed)}
                                </TableCell>
                                {applyRules && (
                                  <TableCell className="text-right font-mono text-muted-foreground">
                                    ~{formatMinutes(
                                      Math.round(segment.duration_minutes_computed / 15) * 15
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-muted-foreground">
                  {selectedSegments.size > 0 && (
                    <span>
                      {selectedSegments.size} von {segments.length} Segmenten ausgewählt
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePreview}
                    disabled={selectedSegments.size === 0 || isLoading}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Vorschau
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={selectedSegments.size === 0 || isLoading}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Genehmigen ({selectedSegments.size})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vorschau-Dialog */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Freigabe-Vorschau</DialogTitle>
                <DialogDescription>
                  Prüfen Sie die Auswirkungen der Regelanwendung vor der Genehmigung
                </DialogDescription>
              </DialogHeader>
              
              {preview && (
                <div className="space-y-4">
                  {/* Zusammenfassung */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <span className="font-semibold">Angewendete Regel:</span>{' '}
                          {preview.summary.applied_rule?.name || 'Standard'}
                        </div>
                        <div>
                          <span className="font-semibold">Rundung:</span>{' '}
                          {preview.summary.applied_rule?.round_to_minutes} Min ({preview.summary.applied_rule?.round_direction})
                        </div>
                        <div>
                          <span className="font-semibold">Auto-Pause:</span>{' '}
                          Nach {preview.summary.applied_rule?.auto_break_after_minutes / 60}h → {preview.summary.applied_rule?.auto_break_duration_minutes} Min
                        </div>
                        <div>
                          <span className="font-semibold">Segmente:</span>{' '}
                          {preview.summary.total_segments}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Differenz-Übersicht */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold">
                            {formatMinutes(preview.summary.total_original_minutes)}
                          </div>
                          <p className="text-xs text-muted-foreground">Original</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {formatMinutes(preview.summary.total_approved_minutes)}
                          </div>
                          <p className="text-xs text-muted-foreground">Nach Genehmigung</p>
                        </div>
                        <div>
                          <div className={`text-2xl font-bold ${
                            preview.summary.total_difference_minutes > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {preview.summary.total_difference_minutes > 0 ? '+' : ''}
                            {formatMinutes(Math.abs(preview.summary.total_difference_minutes))}
                          </div>
                          <p className="text-xs text-muted-foreground">Differenz</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detail-Tabelle */}
                  <ScrollArea className="h-[300px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mitarbeiter</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead>Projekt</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead className="text-right">Original</TableHead>
                          <TableHead className="text-right">Genehmigt</TableHead>
                          <TableHead className="text-right">Differenz</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.segments.map((segment: ApprovalPreview) => (
                          <TableRow key={segment.segment_id}>
                            <TableCell>{segment.employee_name}</TableCell>
                            <TableCell>
                              {format(new Date(segment.date), 'dd.MM.yyyy', { locale: de })}
                            </TableCell>
                            <TableCell>{segment.project_name}</TableCell>
                            <TableCell>
                              <Badge variant={
                                segment.segment_type === 'work' ? 'default' : 'secondary'
                              }>
                                {segment.segment_type === 'work' ? 'Arbeit' : 
                                 segment.segment_type === 'break' ? 'Pause' : 'Fahrt'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMinutes(segment.original_minutes)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {formatMinutes(segment.approved_minutes)}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${
                              segment.difference_minutes > 0 ? 'text-green-600' : 
                              segment.difference_minutes < 0 ? 'text-red-600' : ''
                            }`}>
                              {segment.difference_minutes > 0 ? '+' : ''}
                              {formatMinutes(Math.abs(segment.difference_minutes))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleApprove}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Jetzt genehmigen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}