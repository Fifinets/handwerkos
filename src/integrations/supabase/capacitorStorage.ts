import { Preferences } from '@capacitor/preferences';
import type { SupabaseClientOptions } from '@supabase/supabase-js';

/**
 * Capacitor Storage Adapter for Supabase Auth
 *
 * This adapter uses @capacitor/preferences instead of localStorage
 * to properly persist auth sessions in native mobile apps.
 *
 * localStorage doesn't work reliably in Capacitor apps and can cause:
 * - Session loss
 * - Auto-logout
 * - App crashes
 *
 * IMPORTANT: All methods MUST return Promises and handle errors gracefully
 * to prevent Supabase auth from hanging.
 */
export const capacitorStorage: SupabaseClientOptions<'public'>['auth']['storage'] = {
  async getItem(key: string): Promise<string | null> {
    try {
      console.log(`[CapacitorStorage] 🔍 getItem START: ${key}`);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.error(`[CapacitorStorage] ⏱️ TIMEOUT getting ${key}`);
          resolve(null);
        }, 5000);
      });

      const getPromise = Preferences.get({ key }).then(({ value }) => {
        console.log(`[CapacitorStorage] ✅ getItem SUCCESS: ${key} -> ${value ? 'found' : 'null'}`);
        return value;
      });

      const result = await Promise.race([getPromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error(`[CapacitorStorage] ❌ ERROR getting item ${key}:`, error);
      console.error(`[CapacitorStorage] ❌ Error type:`, typeof error);
      console.error(`[CapacitorStorage] ❌ Error message:`, error?.message);
      console.error(`[CapacitorStorage] ❌ Error stack:`, error?.stack);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      console.log(`[CapacitorStorage] 💾 setItem START: ${key}`);

      // Add timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.error(`[CapacitorStorage] ⏱️ TIMEOUT setting ${key}`);
          resolve();
        }, 5000);
      });

      const setPromise = Preferences.set({ key, value }).then(() => {
        console.log(`[CapacitorStorage] ✅ setItem SUCCESS: ${key} -> saved`);
      });

      await Promise.race([setPromise, timeoutPromise]);
    } catch (error) {
      console.error(`[CapacitorStorage] ❌ ERROR setting item ${key}:`, error);
      console.error(`[CapacitorStorage] ❌ Error type:`, typeof error);
      console.error(`[CapacitorStorage] ❌ Error message:`, error?.message);
      // Don't throw - Supabase needs this to succeed silently
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      console.log(`[CapacitorStorage] 🗑️ removeItem START: ${key}`);

      // Add timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.error(`[CapacitorStorage] ⏱️ TIMEOUT removing ${key}`);
          resolve();
        }, 5000);
      });

      const removePromise = Preferences.remove({ key }).then(() => {
        console.log(`[CapacitorStorage] ✅ removeItem SUCCESS: ${key} -> removed`);
      });

      await Promise.race([removePromise, timeoutPromise]);
    } catch (error) {
      console.error(`[CapacitorStorage] ❌ ERROR removing item ${key}:`, error);
      console.error(`[CapacitorStorage] ❌ Error type:`, typeof error);
      console.error(`[CapacitorStorage] ❌ Error message:`, error?.message);
      // Don't throw - Supabase needs this to succeed silently
    }
  },
};
