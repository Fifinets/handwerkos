/**
 * Offline Storage Utility für die Mobile Employee App
 * Verwaltet lokale Datenspeicherung und Synchronisation
 */

export interface OfflineTimeEntry {
  id: string;
  projectId: string;
  projectName: string;
  employeeId: string;
  startTime: string;
  endTime?: string;
  duration?: number; // in minutes
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  description?: string;
  category: 'planung' | 'ausfuehrung' | 'nacharbeit' | 'dokumentation' | 'sonstiges';
  isActive: boolean;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineMaterialEntry {
  id: string;
  projectId: string;
  projectName: string;
  employeeId: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  category: 'baumaterial' | 'werkzeug' | 'verbrauchsmaterial' | 'sonstiges';
  supplier?: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  photo?: string; // Base64 encoded photo
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfflinePhoto {
  id: string;
  projectId: string;
  employeeId: string;
  filename: string;
  data: string; // Base64 encoded image
  type: string; // MIME type
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  description?: string;
  category: 'baufortschritt' | 'material' | 'problem' | 'abnahme' | 'sonstiges';
  synced: boolean;
  createdAt: string;
}

class OfflineStorageManager {
  private dbName = 'HandwerkOSEmployeeApp';
  private version = 1;
  private db: IDBDatabase | null = null;

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Time Entries Store
        if (!db.objectStoreNames.contains('timeEntries')) {
          const timeStore = db.createObjectStore('timeEntries', { keyPath: 'id' });
          timeStore.createIndex('projectId', 'projectId', { unique: false });
          timeStore.createIndex('employeeId', 'employeeId', { unique: false });
          timeStore.createIndex('synced', 'synced', { unique: false });
          timeStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Material Entries Store
        if (!db.objectStoreNames.contains('materialEntries')) {
          const materialStore = db.createObjectStore('materialEntries', { keyPath: 'id' });
          materialStore.createIndex('projectId', 'projectId', { unique: false });
          materialStore.createIndex('employeeId', 'employeeId', { unique: false });
          materialStore.createIndex('synced', 'synced', { unique: false });
          materialStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Photos Store
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
          photoStore.createIndex('projectId', 'projectId', { unique: false });
          photoStore.createIndex('employeeId', 'employeeId', { unique: false });
          photoStore.createIndex('synced', 'synced', { unique: false });
          photoStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // Time Entry Methods
  async saveTimeEntry(entry: OfflineTimeEntry): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['timeEntries'], 'readwrite');
      const store = transaction.objectStore('timeEntries');
      
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTimeEntries(employeeId: string): Promise<OfflineTimeEntry[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['timeEntries'], 'readonly');
      const store = transaction.objectStore('timeEntries');
      const index = store.index('employeeId');
      
      const request = index.getAll(employeeId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedTimeEntries(): Promise<OfflineTimeEntry[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['timeEntries'], 'readonly');
      const store = transaction.objectStore('timeEntries');
      const index = store.index('synced');
      
      const request = index.getAll(false as any);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async markTimeEntrySynced(id: string): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['timeEntries'], 'readwrite');
      const store = transaction.objectStore('timeEntries');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const entry = getRequest.result;
        if (entry) {
          entry.synced = true;
          entry.updatedAt = new Date().toISOString();
          
          const putRequest = store.put(entry);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Time entry not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Material Entry Methods
  async saveMaterialEntry(entry: OfflineMaterialEntry): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['materialEntries'], 'readwrite');
      const store = transaction.objectStore('materialEntries');
      
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMaterialEntries(employeeId: string): Promise<OfflineMaterialEntry[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['materialEntries'], 'readonly');
      const store = transaction.objectStore('materialEntries');
      const index = store.index('employeeId');
      
      const request = index.getAll(employeeId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedMaterialEntries(): Promise<OfflineMaterialEntry[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['materialEntries'], 'readonly');
      const store = transaction.objectStore('materialEntries');
      const index = store.index('synced');
      
      const request = index.getAll(false as any);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Photo Methods
  async savePhoto(photo: OfflinePhoto): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');
      
      const request = store.put(photo);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedPhotos(): Promise<OfflinePhoto[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['photos'], 'readonly');
      const store = transaction.objectStore('photos');
      const index = store.index('synced');
      
      const request = index.getAll(false as any);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Sync Methods
  async getOfflineDataSummary(): Promise<{
    timeEntries: number;
    materialEntries: number;
    photos: number;
    totalSize: string;
  }> {
    const [timeEntries, materialEntries, photos] = await Promise.all([
      this.getUnsyncedTimeEntries(),
      this.getUnsyncedMaterialEntries(),
      this.getUnsyncedPhotos()
    ]);

    // Estimate data size (rough calculation)
    const timeSize = timeEntries.length * 0.5; // ~0.5KB per entry
    const materialSize = materialEntries.length * 0.3; // ~0.3KB per entry
    const photoSize = photos.reduce((sum, photo) => 
      sum + (photo.data.length * 0.75 / 1024), 0); // Base64 to KB conversion

    const totalSizeKB = timeSize + materialSize + photoSize;
    const totalSize = totalSizeKB > 1024 
      ? `${(totalSizeKB / 1024).toFixed(1)} MB`
      : `${totalSizeKB.toFixed(1)} KB`;

    return {
      timeEntries: timeEntries.length,
      materialEntries: materialEntries.length,
      photos: photos.length,
      totalSize
    };
  }

  // Settings Methods
  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      const request = store.put({ key, value, updatedAt: new Date().toISOString() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key: string): Promise<any> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Utility Methods
  async clearAllData(): Promise<void> {
    if (!this.db) await this.initDB();
    
    const storeNames = ['timeEntries', 'materialEntries', 'photos'];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeNames, 'readwrite');
      
      let completed = 0;
      const total = storeNames.length;
      
      storeNames.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async exportData(): Promise<string> {
    const [timeEntries, materialEntries, photos, summary] = await Promise.all([
      this.getUnsyncedTimeEntries(),
      this.getUnsyncedMaterialEntries(),
      this.getUnsyncedPhotos(),
      this.getOfflineDataSummary()
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      summary,
      data: {
        timeEntries,
        materialEntries: materialEntries.map(entry => ({
          ...entry,
          photo: entry.photo ? `[${entry.photo.substring(0, 50)}...]` : undefined
        })), // Truncate photos for export readability
        photos: photos.map(photo => ({
          ...photo,
          data: `[Base64 Image Data - ${(photo.data.length * 0.75 / 1024).toFixed(1)}KB]`
        }))
      }
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorageManager();

// Utility functions for easy usage
export const createTimeEntry = (
  projectId: string,
  projectName: string,
  employeeId: string,
  startTime: Date,
  location?: { lat: number; lng: number; address: string }
): OfflineTimeEntry => ({
  id: `time_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  projectId,
  projectName,
  employeeId,
  startTime: startTime.toISOString(),
  category: 'ausfuehrung',
  isActive: true,
  synced: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  location
});

export const createMaterialEntry = (
  projectId: string,
  projectName: string,
  employeeId: string,
  materialName: string,
  quantity: number,
  unit: string,
  location?: { lat: number; lng: number; address: string }
): OfflineMaterialEntry => ({
  id: `material_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  projectId,
  projectName,
  employeeId,
  materialName,
  quantity,
  unit,
  category: 'baumaterial',
  synced: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  location
});

export const createPhoto = (
  projectId: string,
  employeeId: string,
  data: string,
  type: string,
  location?: { lat: number; lng: number; address: string }
): OfflinePhoto => ({
  id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  projectId,
  employeeId,
  filename: `photo_${Date.now()}.jpg`,
  data,
  type,
  category: 'baufortschritt',
  synced: false,
  createdAt: new Date().toISOString(),
  location
});

// Initialize on app start
if (typeof window !== 'undefined') {
  offlineStorage.initDB().catch(console.error);
}