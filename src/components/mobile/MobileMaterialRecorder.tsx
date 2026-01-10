import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Package,
  Plus,
  Search,
  MapPin,
  Check,
  X,
  AlertTriangle,
  Camera,
  Boxes,
  TrendingDown
} from "lucide-react"
import { useMaterials } from "@/hooks/useMaterials"
import { toast } from "sonner"
import { Geolocation } from '@capacitor/geolocation'
import { Camera as CapacitorCamera, CameraResultType } from '@capacitor/camera'

interface MobileMaterialRecorderProps {
  projectId: string
  projectName?: string
  isOpen: boolean
  onClose: () => void
  onMaterialAdded?: () => void
}

const MobileMaterialRecorder: React.FC<MobileMaterialRecorderProps> = ({
  projectId,
  projectName,
  isOpen,
  onClose,
  onMaterialAdded
}) => {
  const {
    materials,
    isLoading,
    isSubmitting,
    recordMaterialUsage,
    searchMaterials,
    getLowStockMaterials
  } = useMaterials()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [photoData, setPhotoData] = useState<string | null>(null)

  // Get filtered materials
  const filteredMaterials = searchQuery ? searchMaterials(searchQuery) : materials
  const lowStockMaterials = getLowStockMaterials()

  // Get current location when opening
  useEffect(() => {
    if (isOpen) {
      getCurrentLocation()
    }
  }, [isOpen])

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
    } catch (error) {
      console.error('Location error:', error)
    }
  }

  const takePhoto = async () => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.Base64
      })

      if (image.base64String) {
        setPhotoData(image.base64String)
        toast.success('Foto aufgenommen')
      }
    } catch (error) {
      console.error('Camera error:', error)
      toast.error('Kamera konnte nicht geöffnet werden')
    }
  }

  const handleMaterialSelect = (material: any) => {
    setSelectedMaterial(material)
    setShowConfirm(true)
  }

  const handleSubmit = async () => {
    if (!selectedMaterial || !quantity) {
      toast.error('Bitte Material und Menge angeben')
      return
    }

    const quantityNum = parseFloat(quantity)
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast.error('Bitte gültige Menge eingeben')
      return
    }

    const result = await recordMaterialUsage({
      project_id: projectId,
      material_id: selectedMaterial.id,
      employee_id: '', // Will be set in hook
      quantity: quantityNum,
      unit_price: selectedMaterial.unit_price,
      notes: notes || undefined,
      used_at: new Date().toISOString(),
      location: currentLocation || undefined
    })

    if (result.success) {
      // Reset form
      setSelectedMaterial(null)
      setQuantity('')
      setNotes('')
      setShowConfirm(false)
      setPhotoData(null)

      if (onMaterialAdded) {
        onMaterialAdded()
      }

      if (!result.offline) {
        onClose()
      }
    }
  }

  const handleCancel = () => {
    setSelectedMaterial(null)
    setQuantity('')
    setNotes('')
    setShowConfirm(false)
    setPhotoData(null)
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-white flex items-center gap-2">
                <Package className="h-5 w-5" />
                Material verbuchen
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SheetDescription className="text-blue-100">
              {projectName || 'Projekt'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-auto p-4">
            {!showConfirm ? (
              <>
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Material suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Low Stock Warning */}
                {lowStockMaterials.length > 0 && !searchQuery && (
                  <Card className="mb-4 border-orange-200 bg-orange-50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {lowStockMaterials.length} Material(ien) mit niedrigem Bestand
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Material List */}
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredMaterials.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Boxes className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Keine Materialien gefunden</p>
                    </div>
                  ) : (
                    filteredMaterials.map((material) => {
                      const isLowStock = material.stock_quantity !== undefined &&
                                       material.min_stock_level !== undefined &&
                                       material.stock_quantity <= material.min_stock_level

                      return (
                        <Card
                          key={material.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleMaterialSelect(material)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{material.name}</div>
                                <div className="text-sm text-gray-500">
                                  {material.sku && <span className="mr-2">Art.Nr: {material.sku}</span>}
                                  <Badge variant="outline" className="text-xs">
                                    {material.unit}
                                  </Badge>
                                </div>
                                {material.category && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    {material.category}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right">
                                {material.stock_quantity !== undefined && (
                                  <div className={`text-sm ${isLowStock ? 'text-orange-600' : 'text-gray-600'}`}>
                                    {isLowStock && <TrendingDown className="inline h-3 w-3 mr-1" />}
                                    {material.stock_quantity} {material.unit}
                                  </div>
                                )}
                                {material.unit_price && (
                                  <div className="text-xs text-gray-500">
                                    {material.unit_price.toFixed(2)} €/{material.unit}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              /* Confirm Dialog */
              <div className="space-y-4">
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">{selectedMaterial.name}</h3>
                    {selectedMaterial.sku && (
                      <p className="text-sm text-gray-600">Art.Nr: {selectedMaterial.sku}</p>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="quantity">Menge *</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="quantity"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        placeholder="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="flex-1"
                      />
                      <div className="flex items-center px-3 bg-gray-100 rounded-md">
                        <span className="text-sm font-medium">{selectedMaterial.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notizen (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="z.B. Verwendungszweck, Raum, etc."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  {/* Location Status */}
                  {currentLocation && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <MapPin className="h-4 w-4" />
                      <span>Standort erfasst</span>
                    </div>
                  )}

                  {/* Photo Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={takePhoto}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {photoData ? 'Foto neu aufnehmen' : 'Foto aufnehmen'}
                  </Button>

                  {photoData && (
                    <div className="relative">
                      <img
                        src={`data:image/jpeg;base64,${photoData}`}
                        alt="Material"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={() => setPhotoData(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Calculated Price */}
                  {selectedMaterial.unit_price && quantity && !isNaN(parseFloat(quantity)) && (
                    <Card className="bg-gray-50">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Geschätzter Wert:</span>
                          <span className="font-semibold">
                            {(selectedMaterial.unit_price * parseFloat(quantity)).toFixed(2)} €
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !quantity}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Speichere...' : 'Verbuchen'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default MobileMaterialRecorder