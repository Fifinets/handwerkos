package app.lovable.a0eb28b7447b47a280fca8181ec925b9;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;

@CapacitorPlugin(name = "OfflineSync")
public class OfflineSyncPlugin extends Plugin {
    
    private static final String PREFS_NAME = "OfflineSyncPrefs";
    private static final String KEY_PENDING_ACTIONS = "pending_actions";
    private static final String KEY_TIME_ENTRIES = "offline_time_entries";
    private static final String KEY_MATERIAL_ENTRIES = "offline_material_entries";

    @PluginMethod
    public void addOfflineAction(PluginCall call) {
        String actionType = call.getString("actionType");
        JSObject actionData = call.getObject("actionData");
        
        if (actionType == null || actionData == null) {
            call.reject("Action type and data are required");
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String pendingActionsJson = prefs.getString(KEY_PENDING_ACTIONS, "[]");
            
            JSONArray pendingArray = new JSONArray(pendingActionsJson);
            
            JSONObject newAction = new JSONObject();
            newAction.put("id", System.currentTimeMillis() + "_" + (int)(Math.random() * 1000));
            newAction.put("actionType", actionType);
            newAction.put("actionData", new JSONObject(actionData.toString()));
            newAction.put("timestamp", new Date().getTime());
            newAction.put("synced", false);
            
            pendingArray.put(newAction);
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_PENDING_ACTIONS, pendingArray.toString());
            editor.apply();
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("actionId", newAction.getString("id"));
            result.put("queueLength", pendingArray.length());
            call.resolve(result);
            
        } catch (JSONException e) {
            call.reject("Fehler beim Speichern der Offline-Aktion: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingActions(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String pendingActionsJson = prefs.getString(KEY_PENDING_ACTIONS, "[]");
        
        try {
            JSONArray pendingArray = new JSONArray(pendingActionsJson);
            JSArray result = new JSArray();
            
            for (int i = 0; i < pendingArray.length(); i++) {
                JSONObject action = pendingArray.getJSONObject(i);
                if (!action.getBoolean("synced")) {
                    JSObject actionObj = new JSObject();
                    actionObj.put("id", action.getString("id"));
                    actionObj.put("actionType", action.getString("actionType"));
                    actionObj.put("actionData", new JSObject(action.getJSONObject("actionData").toString()));
                    actionObj.put("timestamp", action.getLong("timestamp"));
                    result.put(actionObj);
                }
            }
            
            JSObject response = new JSObject();
            response.put("pendingActions", result);
            response.put("count", result.length());
            call.resolve(response);
            
        } catch (JSONException e) {
            call.reject("Fehler beim Laden der ausstehenden Aktionen: " + e.getMessage());
        }
    }

    @PluginMethod
    public void markActionSynced(PluginCall call) {
        String actionId = call.getString("actionId");
        
        if (actionId == null) {
            call.reject("Action ID ist erforderlich");
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String pendingActionsJson = prefs.getString(KEY_PENDING_ACTIONS, "[]");
            
            JSONArray pendingArray = new JSONArray(pendingActionsJson);
            
            for (int i = 0; i < pendingArray.length(); i++) {
                JSONObject action = pendingArray.getJSONObject(i);
                if (action.getString("id").equals(actionId)) {
                    action.put("synced", true);
                    action.put("syncedAt", new Date().getTime());
                    break;
                }
            }
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_PENDING_ACTIONS, pendingArray.toString());
            editor.apply();
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (JSONException e) {
            call.reject("Fehler beim Markieren der Aktion als synchronisiert: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearSyncedActions(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String pendingActionsJson = prefs.getString(KEY_PENDING_ACTIONS, "[]");
            
            JSONArray pendingArray = new JSONArray(pendingActionsJson);
            JSONArray unSyncedArray = new JSONArray();
            
            for (int i = 0; i < pendingArray.length(); i++) {
                JSONObject action = pendingArray.getJSONObject(i);
                if (!action.getBoolean("synced")) {
                    unSyncedArray.put(action);
                }
            }
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_PENDING_ACTIONS, unSyncedArray.toString());
            editor.apply();
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("remainingActions", unSyncedArray.length());
            call.resolve(result);
            
        } catch (JSONException e) {
            call.reject("Fehler beim Löschen synchronisierter Aktionen: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getNetworkStatus(PluginCall call) {
        ConnectivityManager connectivityManager = (ConnectivityManager) 
            getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        
        boolean isConnected = false;
        String connectionType = "none";
        
        if (connectivityManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                NetworkCapabilities capabilities = connectivityManager
                    .getNetworkCapabilities(connectivityManager.getActiveNetwork());
                if (capabilities != null) {
                    isConnected = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                    if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                        connectionType = "wifi";
                    } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                        connectionType = "cellular";
                    }
                }
            } else {
                NetworkInfo activeNetwork = connectivityManager.getActiveNetworkInfo();
                if (activeNetwork != null) {
                    isConnected = activeNetwork.isConnectedOrConnecting();
                    switch (activeNetwork.getType()) {
                        case ConnectivityManager.TYPE_WIFI:
                            connectionType = "wifi";
                            break;
                        case ConnectivityManager.TYPE_MOBILE:
                            connectionType = "cellular";
                            break;
                        default:
                            connectionType = "other";
                            break;
                    }
                }
            }
        }
        
        JSObject result = new JSObject();
        result.put("connected", isConnected);
        result.put("connectionType", connectionType);
        call.resolve(result);
    }

    @PluginMethod
    public void saveOfflineTimeEntry(PluginCall call) {
        JSObject timeEntry = call.getObject("timeEntry");
        
        if (timeEntry == null) {
            call.reject("Time entry data is required");
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String timeEntriesJson = prefs.getString(KEY_TIME_ENTRIES, "[]");
            
            JSONArray entriesArray = new JSONArray(timeEntriesJson);
            
            JSONObject newEntry = new JSONObject(timeEntry.toString());
            newEntry.put("id", System.currentTimeMillis() + "_" + (int)(Math.random() * 1000));
            newEntry.put("createdAt", new Date().getTime());
            newEntry.put("synced", false);
            
            entriesArray.put(newEntry);
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_TIME_ENTRIES, entriesArray.toString());
            editor.apply();
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("entryId", newEntry.getString("id"));
            call.resolve(result);
            
        } catch (JSONException e) {
            call.reject("Fehler beim Speichern des Offline-Zeiteintrags: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getOfflineTimeEntries(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String timeEntriesJson = prefs.getString(KEY_TIME_ENTRIES, "[]");
        
        try {
            JSONArray entriesArray = new JSONArray(timeEntriesJson);
            JSArray result = new JSArray();
            
            for (int i = 0; i < entriesArray.length(); i++) {
                JSONObject entry = entriesArray.getJSONObject(i);
                if (!entry.getBoolean("synced")) {
                    result.put(new JSObject(entry.toString()));
                }
            }
            
            JSObject response = new JSObject();
            response.put("timeEntries", result);
            response.put("count", result.length());
            call.resolve(response);
            
        } catch (JSONException e) {
            call.reject("Fehler beim Laden der Offline-Zeiteinträge: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getQueueLength(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String pendingActionsJson = prefs.getString(KEY_PENDING_ACTIONS, "[]");
        
        try {
            JSONArray pendingArray = new JSONArray(pendingActionsJson);
            int unSyncedCount = 0;
            
            for (int i = 0; i < pendingArray.length(); i++) {
                JSONObject action = pendingArray.getJSONObject(i);
                if (!action.getBoolean("synced")) {
                    unSyncedCount++;
                }
            }
            
            JSObject result = new JSObject();
            result.put("length", unSyncedCount);
            call.resolve(result);
            
        } catch (JSONException e) {
            call.reject("Fehler beim Ermitteln der Warteschlangenlänge: " + e.getMessage());
        }
    }
}