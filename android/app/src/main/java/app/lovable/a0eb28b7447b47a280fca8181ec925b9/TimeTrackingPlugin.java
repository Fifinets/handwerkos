package app.lovable.a0eb28b7447b47a280fca8181ec925b9;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Date;

@CapacitorPlugin(
    name = "TimeTracking",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            },
            alias = "location"
        )
    }
)
public class TimeTrackingPlugin extends Plugin {
    
    private static final String PREFS_NAME = "TimeTrackingPrefs";
    private static final String KEY_IS_TRACKING = "is_tracking";
    private static final String KEY_START_TIME = "start_time";
    private static final String KEY_PROJECT_ID = "project_id";
    private static final String KEY_PROJECT_NAME = "project_name";
    private static final String KEY_DESCRIPTION = "description";
    private static final String KEY_LOCATION_LAT = "location_lat";
    private static final String KEY_LOCATION_LNG = "location_lng";

    @PluginMethod
    public void startTimeTracking(PluginCall call) {
        String projectId = call.getString("projectId");
        String projectName = call.getString("projectName");
        String description = call.getString("description", "");
        
        if (projectId == null) {
            call.reject("Project ID is required");
            return;
        }

        // Request location permission if needed
        if (getPermissionState("location") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }

        // Get current location
        getCurrentLocation(new LocationCallback() {
            @Override
            public void onLocationReceived(Location location) {
                saveTrackingSession(projectId, projectName, description, location);
                
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("startTime", new Date().getTime());
                result.put("message", "Zeiterfassung gestartet");
                call.resolve(result);
            }

            @Override
            public void onLocationError(String error) {
                // Start without location
                saveTrackingSession(projectId, projectName, description, null);
                
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("startTime", new Date().getTime());
                result.put("message", "Zeiterfassung gestartet (ohne Standort)");
                call.resolve(result);
            }
        });
    }

    @PluginMethod
    public void stopTimeTracking(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        if (!prefs.getBoolean(KEY_IS_TRACKING, false)) {
            call.reject("Keine aktive Zeiterfassung gefunden");
            return;
        }

        long startTime = prefs.getLong(KEY_START_TIME, 0);
        long endTime = new Date().getTime();
        long duration = endTime - startTime;
        
        String notes = call.getString("notes", "");

        // Clear tracking session
        SharedPreferences.Editor editor = prefs.edit();
        editor.clear();
        editor.apply();

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("endTime", endTime);
        result.put("duration", duration);
        result.put("durationMinutes", Math.round(duration / (1000.0 * 60.0)));
        result.put("message", "Zeiterfassung beendet");
        call.resolve(result);
    }

    @PluginMethod
    public void getActiveTimeTracking(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        JSObject result = new JSObject();
        
        if (prefs.getBoolean(KEY_IS_TRACKING, false)) {
            long startTime = prefs.getLong(KEY_START_TIME, 0);
            long currentTime = new Date().getTime();
            long duration = currentTime - startTime;
            
            JSObject activeSession = new JSObject();
            activeSession.put("projectId", prefs.getString(KEY_PROJECT_ID, ""));
            activeSession.put("projectName", prefs.getString(KEY_PROJECT_NAME, ""));
            activeSession.put("description", prefs.getString(KEY_DESCRIPTION, ""));
            activeSession.put("startTime", startTime);
            activeSession.put("duration", duration);
            activeSession.put("durationMinutes", Math.round(duration / (1000.0 * 60.0)));
            
            result.put("active", true);
            result.put("session", activeSession);
        } else {
            result.put("active", false);
        }
        
        call.resolve(result);
    }

    @PluginMethod
    public void pauseTimeTracking(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        if (!prefs.getBoolean(KEY_IS_TRACKING, false)) {
            call.reject("Keine aktive Zeiterfassung gefunden");
            return;
        }

        // For now, we'll treat pause as stop
        // In a full implementation, you'd track pause/resume states
        stopTimeTracking(call);
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") == com.getcapacitor.PermissionState.GRANTED) {
            startTimeTracking(call);
        } else {
            call.reject("Standort-Berechtigung erforderlich");
        }
    }

    private void saveTrackingSession(String projectId, String projectName, String description, Location location) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        
        editor.putBoolean(KEY_IS_TRACKING, true);
        editor.putLong(KEY_START_TIME, new Date().getTime());
        editor.putString(KEY_PROJECT_ID, projectId);
        editor.putString(KEY_PROJECT_NAME, projectName != null ? projectName : "");
        editor.putString(KEY_DESCRIPTION, description != null ? description : "");
        
        if (location != null) {
            editor.putFloat(KEY_LOCATION_LAT, (float) location.getLatitude());
            editor.putFloat(KEY_LOCATION_LNG, (float) location.getLongitude());
        }
        
        editor.apply();
    }

    private void getCurrentLocation(LocationCallback callback) {
        try {
            LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            
            if (locationManager == null) {
                callback.onLocationError("LocationManager nicht verfügbar");
                return;
            }

            // Check permissions
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (getContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != 
                    android.content.pm.PackageManager.PERMISSION_GRANTED && 
                    getContext().checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != 
                    android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    callback.onLocationError("Standort-Berechtigung nicht erteilt");
                    return;
                }
            }

            // Get last known location
            Location lastKnown = null;
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lastKnown = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (lastKnown == null && locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lastKnown = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }

            if (lastKnown != null) {
                callback.onLocationReceived(lastKnown);
            } else {
                callback.onLocationError("Standort nicht verfügbar");
            }
            
        } catch (Exception e) {
            callback.onLocationError("Fehler beim Abrufen des Standorts: " + e.getMessage());
        }
    }

    private interface LocationCallback {
        void onLocationReceived(Location location);
        void onLocationError(String error);
    }
}