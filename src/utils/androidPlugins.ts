import { registerPlugin } from '@capacitor/core'

export interface TimeTrackingPlugin {
  startTimeTracking(options: {
    projectId: string
    projectName?: string
    description?: string
  }): Promise<{
    success: boolean
    startTime: number
    message: string
  }>
  
  stopTimeTracking(options?: {
    notes?: string
  }): Promise<{
    success: boolean
    endTime: number
    duration: number
    durationMinutes: number
    message: string
  }>
  
  getActiveTimeTracking(): Promise<{
    active: boolean
    session?: {
      projectId: string
      projectName: string
      description: string
      startTime: number
      duration: number
      durationMinutes: number
    }
  }>
  
  pauseTimeTracking(): Promise<{
    success: boolean
    endTime: number
    duration: number
    durationMinutes: number
    message: string
  }>
}

export interface DeliveryNotesPlugin {
  getPendingDeliveryNotes(): Promise<{
    deliveryNotes: Array<{
      id: string
      number: string
      projectName: string
      customerName: string
      status: string
      createdAt: number
    }>
  }>
  
  signDeliveryNote(options: {
    deliveryNoteId: string
    signerName: string
    signatureData: {
      paths: Array<{
        points: Array<{ x: number; y: number }>
      }>
      width?: number
      height?: number
    }
  }): Promise<{
    success: boolean
    deliveryNoteId: string
    signatureBase64: string
    signedAt: number
    message: string
  }>
  
  getPendingSignatures(): Promise<{
    pendingSignatures: Array<{
      deliveryNoteId: string
      signerName: string
      signedAt: number
    }>
  }>
  
  clearPendingSignatures(): Promise<{
    success: boolean
    message: string
  }>
  
  createSignatureBitmap(options: {
    paths: Array<{
      points: Array<{ x: number; y: number }>
    }>
    width?: number
    height?: number
  }): Promise<{
    success: boolean
    base64: string
  }>
}

export interface OfflineSyncPlugin {
  addOfflineAction(options: {
    actionType: string
    actionData: any
  }): Promise<{
    success: boolean
    actionId: string
    queueLength: number
  }>
  
  getPendingActions(): Promise<{
    pendingActions: Array<{
      id: string
      actionType: string
      actionData: any
      timestamp: number
    }>
    count: number
  }>
  
  markActionSynced(options: {
    actionId: string
  }): Promise<{
    success: boolean
  }>
  
  clearSyncedActions(): Promise<{
    success: boolean
    remainingActions: number
  }>
  
  getNetworkStatus(): Promise<{
    connected: boolean
    connectionType: 'wifi' | 'cellular' | 'other' | 'none'
  }>
  
  saveOfflineTimeEntry(options: {
    timeEntry: {
      projectId: string
      startTime: number
      endTime?: number
      description?: string
      location?: { lat: number; lng: number }
    }
  }): Promise<{
    success: boolean
    entryId: string
  }>
  
  getOfflineTimeEntries(): Promise<{
    timeEntries: Array<any>
    count: number
  }>
  
  getQueueLength(): Promise<{
    length: number
  }>
}

// Register plugins
export const TimeTracking = registerPlugin<TimeTrackingPlugin>('TimeTracking')
export const DeliveryNotes = registerPlugin<DeliveryNotesPlugin>('DeliveryNotes')
export const OfflineSync = registerPlugin<OfflineSyncPlugin>('OfflineSync')

// Helper functions for Android integration
export class AndroidTimeTrackingService {
  private static instance: AndroidTimeTrackingService
  
  public static getInstance(): AndroidTimeTrackingService {
    if (!AndroidTimeTrackingService.instance) {
      AndroidTimeTrackingService.instance = new AndroidTimeTrackingService()
    }
    return AndroidTimeTrackingService.instance
  }
  
  async startTracking(projectId: string, projectName: string, description?: string) {
    try {
      const result = await TimeTracking.startTimeTracking({
        projectId,
        projectName,
        description
      })
      return result
    } catch (error) {
      console.error('Android time tracking start failed:', error)
      throw error
    }
  }
  
  async stopTracking(notes?: string) {
    try {
      const result = await TimeTracking.stopTimeTracking({ notes })
      return result
    } catch (error) {
      console.error('Android time tracking stop failed:', error)
      throw error
    }
  }
  
  async getActiveSession() {
    try {
      const result = await TimeTracking.getActiveTimeTracking()
      return result
    } catch (error) {
      console.error('Android get active session failed:', error)
      throw error
    }
  }
}

export class AndroidDeliveryNotesService {
  private static instance: AndroidDeliveryNotesService
  
  public static getInstance(): AndroidDeliveryNotesService {
    if (!AndroidDeliveryNotesService.instance) {
      AndroidDeliveryNotesService.instance = new AndroidDeliveryNotesService()
    }
    return AndroidDeliveryNotesService.instance
  }
  
  async getPendingNotes() {
    try {
      const result = await DeliveryNotes.getPendingDeliveryNotes()
      return result.deliveryNotes
    } catch (error) {
      console.error('Android get pending delivery notes failed:', error)
      throw error
    }
  }
  
  async signNote(deliveryNoteId: string, signerName: string, signatureData: any) {
    try {
      const result = await DeliveryNotes.signDeliveryNote({
        deliveryNoteId,
        signerName,
        signatureData
      })
      return result
    } catch (error) {
      console.error('Android sign delivery note failed:', error)
      throw error
    }
  }
  
  async getPendingSignatures() {
    try {
      const result = await DeliveryNotes.getPendingSignatures()
      return result.pendingSignatures
    } catch (error) {
      console.error('Android get pending signatures failed:', error)
      throw error
    }
  }
}

export class AndroidOfflineSyncService {
  private static instance: AndroidOfflineSyncService
  
  public static getInstance(): AndroidOfflineSyncService {
    if (!AndroidOfflineSyncService.instance) {
      AndroidOfflineSyncService.instance = new AndroidOfflineSyncService()
    }
    return AndroidOfflineSyncService.instance
  }
  
  async addOfflineAction(actionType: string, actionData: any) {
    try {
      const result = await OfflineSync.addOfflineAction({ actionType, actionData })
      return result
    } catch (error) {
      console.error('Android add offline action failed:', error)
      throw error
    }
  }
  
  async getNetworkStatus() {
    try {
      const result = await OfflineSync.getNetworkStatus()
      return result
    } catch (error) {
      console.error('Android get network status failed:', error)
      return { connected: false, connectionType: 'none' as const }
    }
  }
  
  async getPendingActions() {
    try {
      const result = await OfflineSync.getPendingActions()
      return result.pendingActions
    } catch (error) {
      console.error('Android get pending actions failed:', error)
      throw error
    }
  }
  
  async markActionSynced(actionId: string) {
    try {
      await OfflineSync.markActionSynced({ actionId })
    } catch (error) {
      console.error('Android mark action synced failed:', error)
      throw error
    }
  }
  
  async getQueueLength() {
    try {
      const result = await OfflineSync.getQueueLength()
      return result.length
    } catch (error) {
      console.error('Android get queue length failed:', error)
      return 0
    }
  }
  
  async saveOfflineTimeEntry(timeEntry: any) {
    try {
      const result = await OfflineSync.saveOfflineTimeEntry({ timeEntry })
      return result
    } catch (error) {
      console.error('Android save offline time entry failed:', error)
      throw error
    }
  }
}

// Platform detection helper
export const isAndroid = () => {
  return window.Capacitor && window.Capacitor.getPlatform() === 'android'
}

// Integration with existing hooks
export const useAndroidTimeTracking = () => {
  const timeTrackingService = AndroidTimeTrackingService.getInstance()
  const offlineSyncService = AndroidOfflineSyncService.getInstance()
  
  return {
    startTracking: timeTrackingService.startTracking.bind(timeTrackingService),
    stopTracking: timeTrackingService.stopTracking.bind(timeTrackingService),
    getActiveSession: timeTrackingService.getActiveSession.bind(timeTrackingService),
    addOfflineAction: offlineSyncService.addOfflineAction.bind(offlineSyncService),
    getNetworkStatus: offlineSyncService.getNetworkStatus.bind(offlineSyncService),
    getQueueLength: offlineSyncService.getQueueLength.bind(offlineSyncService)
  }
}

export const useAndroidDeliveryNotes = () => {
  const deliveryNotesService = AndroidDeliveryNotesService.getInstance()
  const offlineSyncService = AndroidOfflineSyncService.getInstance()
  
  return {
    getPendingNotes: deliveryNotesService.getPendingNotes.bind(deliveryNotesService),
    signNote: deliveryNotesService.signNote.bind(deliveryNotesService),
    getPendingSignatures: deliveryNotesService.getPendingSignatures.bind(deliveryNotesService),
    addOfflineAction: offlineSyncService.addOfflineAction.bind(offlineSyncService)
  }
}