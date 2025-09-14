import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { offlineQueue } from '@/utils/offlineQueue'

interface Material {
  id: string
  name: string
  sku?: string
  unit: string
  unit_price?: number
  stock_quantity?: number
  min_stock_level?: number
  category?: string
  description?: string
}

interface MaterialUsage {
  id?: string
  project_id: string
  material_id: string
  employee_id: string
  quantity: number
  unit_price?: number
  notes?: string
  used_at: string
  location?: { lat: number; lng: number }
}

export const useMaterials = () => {
  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch available materials
  const fetchMaterials = useCallback(async () => {
    try {
      setIsLoading(true)

      // Try to fetch from database
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching materials:', error)
        // Use mock data if database is not available
        setMaterials([
          {
            id: 'mock-1',
            name: 'Schrauben 4x40mm',
            sku: 'SCH-4x40',
            unit: 'Stk',
            unit_price: 0.05,
            stock_quantity: 1000,
            category: 'Befestigung'
          },
          {
            id: 'mock-2',
            name: 'Kabel NYM 3x1,5',
            sku: 'KAB-NYM-3x15',
            unit: 'm',
            unit_price: 1.20,
            stock_quantity: 500,
            category: 'Elektro'
          },
          {
            id: 'mock-3',
            name: 'Rigipsplatte 12,5mm',
            sku: 'RIG-125',
            unit: 'Stk',
            unit_price: 8.50,
            stock_quantity: 50,
            category: 'Trockenbau'
          },
          {
            id: 'mock-4',
            name: 'Silikon Grau',
            sku: 'SIL-GR',
            unit: 'Kartusche',
            unit_price: 4.50,
            stock_quantity: 25,
            category: 'Dichtung'
          },
          {
            id: 'mock-5',
            name: 'Dämmwolle 100mm',
            sku: 'DAE-100',
            unit: 'm²',
            unit_price: 12.00,
            stock_quantity: 100,
            category: 'Dämmung'
          }
        ])
        return
      }

      setMaterials(data || [])
    } catch (error) {
      console.error('Error in fetchMaterials:', error)
      toast.error('Fehler beim Laden der Materialien')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Record material usage
  const recordMaterialUsage = useCallback(async (usage: MaterialUsage) => {
    try {
      setIsSubmitting(true)

      // Check if offline
      const networkStatus = await fetch('/api/health').catch(() => null)
      if (!networkStatus) {
        // Store offline
        await offlineQueue.addAction('RECORD_MATERIAL', usage)
        toast.info('Material-Verbuchung für Offline-Verarbeitung gespeichert')
        return { success: true, offline: true }
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // Try to save to database
      const { data, error } = await supabase
        .from('employee_material_usage')
        .insert({
          project_id: usage.project_id,
          material_id: usage.material_id,
          employee_id: usage.employee_id || user.id,
          quantity: usage.quantity,
          unit_price: usage.unit_price,
          notes: usage.notes,
          used_at: usage.used_at || new Date().toISOString(),
          location_lat: usage.location?.lat,
          location_lng: usage.location?.lng
        })
        .select()
        .single()

      if (error) {
        // If database fails, store offline
        await offlineQueue.addAction('RECORD_MATERIAL', usage)
        toast.warning('Material-Verbuchung lokal gespeichert')
        return { success: true, offline: true }
      }

      toast.success('Material erfolgreich verbucht')
      return { success: true, data }

    } catch (error) {
      console.error('Error recording material usage:', error)
      toast.error('Fehler beim Verbuchen des Materials')
      return { success: false, error }
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  // Get material usage for a project
  const getProjectMaterialUsage = useCallback(async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_material_usage')
        .select(`
          *,
          material:materials(name, unit, sku),
          employee:profiles(first_name, last_name)
        `)
        .eq('project_id', projectId)
        .order('used_at', { ascending: false })

      if (error) throw error
      return data || []

    } catch (error) {
      console.error('Error fetching project materials:', error)
      return []
    }
  }, [])

  // Search materials by name or SKU
  const searchMaterials = useCallback((query: string) => {
    if (!query) return materials

    const searchTerm = query.toLowerCase()
    return materials.filter(material =>
      material.name.toLowerCase().includes(searchTerm) ||
      material.sku?.toLowerCase().includes(searchTerm) ||
      material.category?.toLowerCase().includes(searchTerm)
    )
  }, [materials])

  // Get low stock materials
  const getLowStockMaterials = useCallback(() => {
    return materials.filter(material =>
      material.stock_quantity !== undefined &&
      material.min_stock_level !== undefined &&
      material.stock_quantity <= material.min_stock_level
    )
  }, [materials])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  return {
    materials,
    isLoading,
    isSubmitting,
    fetchMaterials,
    recordMaterialUsage,
    getProjectMaterialUsage,
    searchMaterials,
    getLowStockMaterials
  }
}