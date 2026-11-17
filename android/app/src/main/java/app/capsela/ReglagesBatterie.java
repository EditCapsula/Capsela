package app.capsela;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * LES RESTRICTIONS DE BATTERIE DE CAPSELA (17/11/2026, signalé : notification programmée à 7 h, reçue après 10 h).
 *
 * La notification de la tenue du jour est une alarme inexacte (src/lib/notifications.ts) : quand le téléphone restreint la batterie de
 * l'app, Android la retient jusqu'au réveil du téléphone. Réglages dit comment lever la restriction et ouvre la page de l'app dans les
 * paramètres du téléphone (où se trouve « Batterie »).
 *
 * Volontairement SANS l'autorisation REQUEST_IGNORE_BATTERY_OPTIMIZATIONS ni sa demande directe, que Google Play restreint : on lit
 * seulement l'état (PowerManager, sans autorisation) et on ouvre la fiche de l'app ; la personne choisit elle-même.
 */
@CapacitorPlugin(name = "ReglagesBatterie")
public class ReglagesBatterie extends Plugin {

    /** { libre: true } quand Capsela n'est pas soumise à l'optimisation de batterie (« Non restreinte »). */
    @PluginMethod
    public void etat(PluginCall call) {
        Context contexte = getContext();
        PowerManager energie = (PowerManager) contexte.getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("libre", energie != null && energie.isIgnoringBatteryOptimizations(contexte.getPackageName()));
        call.resolve(r);
    }

    /** Ouvre la fiche de Capsela dans les paramètres du téléphone. */
    @PluginMethod
    public void ouvrir(PluginCall call) {
        Intent fiche = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        fiche.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(fiche);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Paramètres introuvables");
        }
    }
}
