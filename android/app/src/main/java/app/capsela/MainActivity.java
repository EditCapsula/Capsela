package app.capsela;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Le fond des barres système (FondSysteme.java) : enregistré avant le démarrage de Capacitor.
        registerPlugin(FondSysteme.class);
        super.onCreate(savedInstanceState);
    }
}
