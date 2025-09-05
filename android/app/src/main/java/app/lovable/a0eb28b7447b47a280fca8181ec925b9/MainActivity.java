package app.lovable.a0eb28b7447b47a280fca8181ec925b9;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register native plugins
        registerPlugin(TimeTrackingPlugin.class);
        registerPlugin(DeliveryNotesPlugin.class);
        registerPlugin(OfflineSyncPlugin.class);
    }
}