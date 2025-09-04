import React, { useRef, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  PenTool, 
  RotateCcw, 
  Save, 
  X,
  CheckCircle2,
  Smartphone,
  Users
} from "lucide-react"
import { toast } from "sonner"

interface Point {
  x: number
  y: number
}

interface SignatureCaptureProps {
  isOpen: boolean
  onClose: () => void
  onSave: (signature: { svg: string; name: string }) => Promise<void>
  title?: string
  description?: string
  placeholder?: string
  signerName?: string
  onSignerNameChange?: (name: string) => void
}

const SignatureCapture: React.FC<SignatureCaptureProps> = ({
  isOpen,
  onClose,
  onSave,
  title = "Lieferschein signieren",
  description = "Bitte unterschreiben Sie zur Bestätigung des Erhalts der Leistungen",
  placeholder = "Name des Unterzeichners",
  signerName: propSignerName,
  onSignerNameChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [internalSignerName, setInternalSignerName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  
  // Use controlled or internal state for signer name
  const signerName = propSignerName !== undefined ? propSignerName : internalSignerName
  const setSignerName = onSignerNameChange || setInternalSignerName
  
  // Drawing state
  const [currentPath, setCurrentPath] = useState<Point[]>([])
  const [allPaths, setAllPaths] = useState<Point[][]>([])
  
  // Canvas dimensions
  const CANVAS_WIDTH = 400
  const CANVAS_HEIGHT = 200
  
  // Initialize canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set up canvas
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    
    // Set drawing styles
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Add background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Add signature line
    ctx.beginPath()
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.moveTo(20, CANVAS_HEIGHT - 30)
    ctx.lineTo(CANVAS_WIDTH - 20, CANVAS_HEIGHT - 30)
    ctx.stroke()
    ctx.setLineDash([])
    
    // Add text
    ctx.font = '12px system-ui'
    ctx.fillStyle = '#6b7280'
    ctx.textAlign = 'center'
    ctx.fillText('Unterschrift', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10)
    
    // Reset drawing style
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    
    // Redraw existing paths
    allPaths.forEach(path => {
      if (path.length > 1) {
        ctx.beginPath()
        ctx.moveTo(path[0].x, path[0].y)
        path.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y)
        })
        ctx.stroke()
      }
    })
    
  }, [isOpen, allPaths])
  
  // Get coordinates from event
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    
    let clientX: number, clientY: number
    
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      // Mouse event
      clientX = e.clientX
      clientY = e.clientY
    }
    
    return {
      x: ((clientX - rect.left) * CANVAS_WIDTH) / rect.width,
      y: ((clientY - rect.top) * CANVAS_HEIGHT) / rect.height
    }
  }
  
  // Start drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    setHasSignature(true)
    
    const point = getCoordinates(e)
    setCurrentPath([point])
  }
  
  // Continue drawing
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    
    const point = getCoordinates(e)
    const newPath = [...currentPath, point]
    setCurrentPath(newPath)
    
    // Draw line to new point
    if (currentPath.length > 0) {
      const lastPoint = currentPath[currentPath.length - 1]
      ctx.beginPath()
      ctx.moveTo(lastPoint.x, lastPoint.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
  }
  
  // Stop drawing
  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    
    if (currentPath.length > 0) {
      setAllPaths(prev => [...prev, currentPath])
      setCurrentPath([])
    }
  }
  
  // Clear signature
  const clearSignature = () => {
    setAllPaths([])
    setCurrentPath([])
    setHasSignature(false)
    
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    
    // Clear and redraw background
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Signature line
    ctx.beginPath()
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.moveTo(20, CANVAS_HEIGHT - 30)
    ctx.lineTo(CANVAS_WIDTH - 20, CANVAS_HEIGHT - 30)
    ctx.stroke()
    ctx.setLineDash([])
    
    // Text
    ctx.font = '12px system-ui'
    ctx.fillStyle = '#6b7280'
    ctx.textAlign = 'center'
    ctx.fillText('Unterschrift', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10)
    
    // Reset drawing style
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
  }
  
  // Generate SVG from paths
  const generateSVG = (): string => {
    if (allPaths.length === 0) return ''
    
    let svgPaths = ''
    
    allPaths.forEach(path => {
      if (path.length > 1) {
        let pathData = `M ${path[0].x} ${path[0].y}`
        path.slice(1).forEach(point => {
          pathData += ` L ${point.x} ${point.y}`
        })
        
        svgPaths += `<path d="${pathData}" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      }
    })
    
    return `
      <svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        ${svgPaths}
        <line x1="20" y1="${CANVAS_HEIGHT - 30}" x2="${CANVAS_WIDTH - 20}" y2="${CANVAS_HEIGHT - 30}" 
              stroke="#e5e7eb" stroke-width="1" stroke-dasharray="5,5"/>
        <text x="${CANVAS_WIDTH / 2}" y="${CANVAS_HEIGHT - 10}" text-anchor="middle" 
              font-family="system-ui" font-size="12" fill="#6b7280">Unterschrift</text>
      </svg>
    `.trim()
  }
  
  // Save signature
  const handleSave = async () => {
    if (!hasSignature) {
      toast.error('Bitte erstellen Sie zuerst eine Unterschrift')
      return
    }
    
    if (!signerName.trim()) {
      toast.error('Bitte geben Sie Ihren Namen ein')
      return
    }
    
    try {
      setIsLoading(true)
      
      const svg = generateSVG()
      await onSave({
        svg,
        name: signerName.trim()
      })
      
      // Reset state
      clearSignature()
      setSignerName('')
      onClose()
      
    } catch (error: any) {
      console.error('Error saving signature:', error)
      toast.error(error.message || 'Fehler beim Speichern der Unterschrift')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Handle dialog close
  const handleClose = () => {
    clearSignature()
    if (!onSignerNameChange) {
      setInternalSignerName('')
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="signer-name">Name des Unterzeichners *</Label>
            <Input
              id="signer-name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder={placeholder}
              required
            />
          </div>
          
          {/* Signature Canvas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Unterschrift *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSignature}
                disabled={!hasSignature}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Löschen
              </Button>
            </div>
            
            <Card className="relative">
              <CardContent className="p-4">
                <canvas
                  ref={canvasRef}
                  className="border border-gray-200 rounded-lg w-full cursor-crosshair touch-none"
                  style={{ 
                    maxWidth: '100%',
                    height: 'auto',
                    aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`
                  }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                
                {!hasSignature && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-muted-foreground">
                      <PenTool className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Hier unterschreiben</p>
                      <p className="text-xs mt-1 hidden sm:block">
                        Klicken und ziehen oder mit dem Finger zeichnen
                      </p>
                      <p className="text-xs mt-1 sm:hidden">
                        Mit dem Finger zeichnen
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Mobile hint */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
              <Smartphone className="h-3 w-3" />
              <span>Tipp: Drehen Sie das Gerät für eine größere Signaturfläche</span>
            </div>
          </div>
          
          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-blue-900 dark:text-blue-100 font-medium">
                  Rechtsgültigkeit
                </p>
                <p className="text-blue-700 dark:text-blue-300 text-xs">
                  Ihre digitale Unterschrift hat die gleiche Rechtsgültigkeit wie eine handschriftliche Unterschrift 
                  und bestätigt den Erhalt der erbrachten Leistungen.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasSignature || !signerName.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Speichere...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Unterschrift speichern
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SignatureCapture