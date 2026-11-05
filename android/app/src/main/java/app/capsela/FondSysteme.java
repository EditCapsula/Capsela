package app.capsela;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * LE FOND DES BARRES SYSTÈME (05/11/2026, signalé : l'app n'est pas « full », barres grises en haut et en bas).
 *
 * Capacitor place la page entre la barre d'état et la barre de navigation ; derrière elles, on voit le fond de la fenêtre. Le thème
 * le met au crème de l'app (styles.xml) ; l'écran d'accueil, sur fond encre, demande l'encre et des icônes claires. Appelé par
 * src/lib/fondSysteme.ts à chaque changement d'écran.
 */
@CapacitorPlugin(name = "FondSysteme")
public class FondSysteme extends Plugin {

    @PluginMethod
    public void poser(PluginCall call) {
        String couleur = call.getString("couleur", "#F3EEE5");
        boolean sombre = Boolean.TRUE.equals(call.getBoolean("sombre", false));
        getActivity().runOnUiThread(() -> {
            try {
                Window fenetre = getActivity().getWindow();
                fenetre.getDecorView().setBackgroundColor(Color.parseColor(couleur));
                WindowInsetsControllerCompat icones = WindowCompat.getInsetsController(fenetre, fenetre.getDecorView());
                icones.setAppearanceLightStatusBars(!sombre);
                icones.setAppearanceLightNavigationBars(!sombre);
                call.resolve();
            } catch (IllegalArgumentException e) {
                call.reject("Couleur illisible : " + couleur);
            }
        });
    }
}
