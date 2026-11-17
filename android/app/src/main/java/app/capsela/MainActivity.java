package app.capsela;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Le fond des barres système (FondSysteme.java) : enregistré avant le démarrage de Capacitor.
        registerPlugin(FondSysteme.class);
        // Les restrictions de batterie (ReglagesBatterie.java) : la notification de la tenue du jour arrive à l'heure sans elles.
        registerPlugin(ReglagesBatterie.class);
        super.onCreate(savedInstanceState);
    }
}
