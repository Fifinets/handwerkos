package app.lovable.a0eb28b7447b47a280fca8181ec925b9;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.Environment;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(
    name = "DeliveryNotes",
    permissions = {
        @Permission(
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE },
            alias = "storage"
        )
    }
)
public class DeliveryNotesPlugin extends Plugin {
    
    private static final String PREFS_NAME = "DeliveryNotesPrefs";
    private static final String KEY_PENDING_SIGNATURES = "pending_signatures";

    @PluginMethod
    public void getPendingDeliveryNotes(PluginCall call) {
        // In a real implementation, this would fetch from a local database or API
        // For now, we'll return mock data
        JSArray deliveryNotes = new JSArray();
        
        try {
            JSObject note1 = new JSObject();
            note1.put("id", "DN-2025-001");
            note1.put("number", "DN-2025-001");
            note1.put("projectName", "Baustelle Nord");
            note1.put("customerName", "Mustermann GmbH");
            note1.put("status", "sent");
            note1.put("createdAt", new Date().getTime());
            deliveryNotes.put(note1);
            
            JSObject note2 = new JSObject();
            note2.put("id", "DN-2025-002");
            note2.put("number", "DN-2025-002");
            note2.put("projectName", "Bürogebäude Zentrum");
            note2.put("customerName", "Bau AG");
            note2.put("status", "sent");
            note2.put("createdAt", new Date().getTime() - 86400000); // 1 day ago
            deliveryNotes.put(note2);
            
        } catch (Exception e) {
            call.reject("Fehler beim Laden der Lieferscheine: " + e.getMessage());
            return;
        }
        
        JSObject result = new JSObject();
        result.put("deliveryNotes", deliveryNotes);
        call.resolve(result);
    }

    @PluginMethod
    public void signDeliveryNote(PluginCall call) {
        String deliveryNoteId = call.getString("deliveryNoteId");
        String signerName = call.getString("signerName");
        JSObject signatureData = call.getObject("signatureData");
        
        if (deliveryNoteId == null || signerName == null || signatureData == null) {
            call.reject("Lieferschein-ID, Unterzeichner-Name und Signaturdaten sind erforderlich");
            return;
        }

        try {
            // Convert signature data to bitmap and save
            String signatureBase64 = convertSignatureToBitmap(signatureData);
            
            if (signatureBase64 == null) {
                call.reject("Fehler beim Konvertieren der Signatur");
                return;
            }

            // Save signature to local storage for offline sync
            savePendingSignature(deliveryNoteId, signerName, signatureBase64);
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("deliveryNoteId", deliveryNoteId);
            result.put("signatureBase64", signatureBase64);
            result.put("signedAt", new Date().getTime());
            result.put("message", "Lieferschein erfolgreich signiert");
            
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Fehler beim Signieren des Lieferscheins: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingSignatures(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String pendingSignaturesJson = prefs.getString(KEY_PENDING_SIGNATURES, "[]");
        
        try {
            JSONArray pendingArray = new JSONArray(pendingSignaturesJson);
            JSArray result = new JSArray();
            
            for (int i = 0; i < pendingArray.length(); i++) {
                JSONObject signature = pendingArray.getJSONObject(i);
                JSObject signatureObj = new JSObject();
                signatureObj.put("deliveryNoteId", signature.getString("deliveryNoteId"));
                signatureObj.put("signerName", signature.getString("signerName"));
                signatureObj.put("signedAt", signature.getLong("signedAt"));
                result.put(signatureObj);
            }
            
            JSObject response = new JSObject();
            response.put("pendingSignatures", result);
            call.resolve(response);
            
        } catch (JSONException e) {
            call.reject("Fehler beim Laden der ausstehenden Signaturen: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearPendingSignatures(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.remove(KEY_PENDING_SIGNATURES);
        editor.apply();
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Ausstehende Signaturen gelöscht");
        call.resolve(result);
    }

    @PluginMethod
    public void createSignatureBitmap(PluginCall call) {
        JSArray pathsArray = call.getArray("paths");
        int width = call.getInt("width") != null ? call.getInt("width") : 400;
        int height = call.getInt("height") != null ? call.getInt("height") : 200;
        
        if (pathsArray == null) {
            call.reject("Pfad-Daten sind erforderlich");
            return;
        }

        try {
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);
            
            Paint paint = new Paint();
            paint.setAntiAlias(true);
            paint.setColor(Color.BLACK);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(3f);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
            
            // Draw signature paths
            for (int i = 0; i < pathsArray.length(); i++) {
                JSObject pathObj = new JSObject(pathsArray.getJSONObject(i).toString());
                JSArray points = new JSArray(pathObj.getJSONArray("points").toString());
                
                if (points != null && points.length() > 1) {
                    Path path = new Path();
                    JSObject firstPoint = new JSObject(points.getJSONObject(0).toString());
                    path.moveTo((float) firstPoint.getDouble("x"), (float) firstPoint.getDouble("y"));
                    
                    for (int j = 1; j < points.length(); j++) {
                        JSObject point = new JSObject(points.getJSONObject(j).toString());
                        path.lineTo((float) point.getDouble("x"), (float) point.getDouble("y"));
                    }
                    
                    canvas.drawPath(path, paint);
                }
            }
            
            // Convert to base64
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos);
            byte[] byteArray = baos.toByteArray();
            String base64 = Base64.encodeToString(byteArray, Base64.DEFAULT);
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("base64", base64);
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Fehler beim Erstellen des Signatur-Bitmaps: " + e.getMessage());
        }
    }

    private String convertSignatureToBitmap(JSObject signatureData) {
        try {
            // Extract signature path data
            JSArray paths = new JSArray(signatureData.getJSONArray("paths").toString());
            if (paths == null) return null;
            
            int width = signatureData.getInteger("width") != null ? signatureData.getInteger("width") : 400;
            int height = signatureData.getInteger("height") != null ? signatureData.getInteger("height") : 200;
            
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);
            
            Paint paint = new Paint();
            paint.setAntiAlias(true);
            paint.setColor(Color.BLACK);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(3f);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
            
            // Draw signature paths
            for (int i = 0; i < paths.length(); i++) {
                JSObject pathObj = new JSObject(paths.getJSONObject(i).toString());
                JSArray points = new JSArray(pathObj.getJSONArray("points").toString());
                
                if (points != null && points.length() > 1) {
                    Path path = new Path();
                    JSObject firstPoint = new JSObject(points.getJSONObject(0).toString());
                    path.moveTo((float) firstPoint.getDouble("x"), (float) firstPoint.getDouble("y"));
                    
                    for (int j = 1; j < points.length(); j++) {
                        JSObject point = new JSObject(points.getJSONObject(j).toString());
                        path.lineTo((float) point.getDouble("x"), (float) point.getDouble("y"));
                    }
                    
                    canvas.drawPath(path, paint);
                }
            }
            
            // Convert to base64
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos);
            byte[] byteArray = baos.toByteArray();
            return Base64.encodeToString(byteArray, Base64.DEFAULT);
            
        } catch (Exception e) {
            return null;
        }
    }

    private void savePendingSignature(String deliveryNoteId, String signerName, String signatureBase64) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String pendingSignaturesJson = prefs.getString(KEY_PENDING_SIGNATURES, "[]");
        
        try {
            JSONArray pendingArray = new JSONArray(pendingSignaturesJson);
            
            JSONObject newSignature = new JSONObject();
            newSignature.put("deliveryNoteId", deliveryNoteId);
            newSignature.put("signerName", signerName);
            newSignature.put("signatureBase64", signatureBase64);
            newSignature.put("signedAt", new Date().getTime());
            
            pendingArray.put(newSignature);
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_PENDING_SIGNATURES, pendingArray.toString());
            editor.apply();
            
        } catch (JSONException e) {
            // Handle error silently for now
        }
    }
}