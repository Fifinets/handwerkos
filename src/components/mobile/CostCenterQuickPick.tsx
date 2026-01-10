/**
 * Cost Center Quick Pick Component
 * Quick access buttons for booking time to cost centers
 * (Fahrt, Werkstatt, Schulung, etc.)
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Car, Wrench, GraduationCap, Plus } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface CostCenter {
  id: string
  code: string
  name: string
  description: string
  billable: boolean
  payroll: boolean
  color: string
  icon: string
}

interface CostCenterQuickPickProps {
  employeeId: string
  onCostCenterSelect?: (costCenterId: string, costCenter: CostCenter) => void
  compact?: boolean
}

// Icon mapping
const iconMap: { [key: string]: any } = {
  Car,
  Wrench,
  GraduationCap,
  Plus
}

export const CostCenterQuickPick: React.FC<CostCenterQuickPickProps> = ({
  employeeId,
  onCostCenterSelect,
  compact = false
}) => {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Load cost centers
  useEffect(() => {
    loadCostCenters()
  }, [])

  const loadCostCenters = async () => {
    try {
      // Get user's company
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return

      // Get cost centers
      const { data, error } = await supabase
        .from('cost_centers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('sort_order')

      if (error) throw error
      setCostCenters(data || [])
    } catch (error) {
      console.error('Error loading cost centers:', error)
    }
  }

  const handleSelect = (costCenter: CostCenter) => {
    onCostCenterSelect?.(costCenter.id, costCenter)
    toast.success(`${costCenter.name} ausgewählt`)
  }

  // Get icon component
  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || Plus
    return IconComponent
  }

  // Quick pick buttons (top 3)
  const topCostCenters = costCenters.slice(0, 3)

  if (compact) {
    return (
      <div className="flex gap-2 flex-wrap">
        {topCostCenters.map((cc) => {
          const Icon = getIcon(cc.icon)
          return (
            <Button
              key={cc.id}
              variant="outline"
              size="sm"
              onClick={() => handleSelect(cc)}
              disabled={isLoading}
              style={{
                borderColor: cc.color,
                color: cc.color
              }}
            >
              <Icon className="h-4 w-4 mr-1" />
              {cc.name}
            </Button>
          )
        })}

        {costCenters.length > 3 && (
          <Sheet open={showAll} onOpenChange={setShowAll}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Mehr
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle>Kostenstellen</SheetTitle>
                <SheetDescription>
                  Wähle eine Kostenstelle für die Zeitbuchung
                </SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {costCenters.map((cc) => {
                  const Icon = getIcon(cc.icon)
                  return (
                    <Button
                      key={cc.id}
                      variant="outline"
                      className="h-auto py-4 flex-col gap-2"
                      onClick={() => {
                        handleSelect(cc)
                        setShowAll(false)
                      }}
                      style={{
                        borderColor: cc.color
                      }}
                    >
                      <Icon className="h-6 w-6" style={{ color: cc.color }} />
                      <div className="text-sm font-medium">{cc.name}</div>
                      {cc.billable && (
                        <Badge variant="secondary" className="text-xs">
                          Abrechenbar
                        </Badge>
                      )}
                    </Button>
                  )
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    )
  }

  // Full card view
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Schnellzugriff
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {topCostCenters.map((cc) => {
            const Icon = getIcon(cc.icon)
            return (
              <Button
                key={cc.id}
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => handleSelect(cc)}
                disabled={isLoading}
                style={{
                  borderColor: cc.color
                }}
              >
                <Icon className="h-6 w-6" style={{ color: cc.color }} />
                <div className="text-sm font-medium">{cc.name}</div>
                {cc.billable && (
                  <Badge variant="secondary" className="text-xs">
                    Abrechenbar
                  </Badge>
                )}
              </Button>
            )
          })}

          {costCenters.length > 3 && (
            <Sheet open={showAll} onOpenChange={setShowAll}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                >
                  <Plus className="h-6 w-6" />
                  <div className="text-sm font-medium">Mehr</div>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Alle Kostenstellen</SheetTitle>
                  <SheetDescription>
                    Wähle eine Kostenstelle für die Zeitbuchung
                  </SheetDescription>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {costCenters.map((cc) => {
                    const Icon = getIcon(cc.icon)
                    return (
                      <Button
                        key={cc.id}
                        variant="outline"
                        className="h-auto py-4 flex-col gap-2"
                        onClick={() => {
                          handleSelect(cc)
                          setShowAll(false)
                        }}
                        style={{
                          borderColor: cc.color
                        }}
                      >
                        <Icon className="h-6 w-6" style={{ color: cc.color }} />
                        <div className="text-sm font-medium">{cc.name}</div>
                        <div className="text-xs text-muted-foreground text-center">
                          {cc.description}
                        </div>
                        {cc.billable && (
                          <Badge variant="secondary" className="text-xs">
                            Abrechenbar
                          </Badge>
                        )}
                      </Button>
                    )
                  })}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
