# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# LES AUTORISATIONS DES PLUGINS (14/11/2026, signalé dans l'app Android : la notification d'essai échoue avec « Cannot read
# properties of undefined (reading 'display') », « Prochaine notification : lecture impossible », et « Utiliser ma position
# actuelle » ne fait rien). Capacitor lit les autorisations de chaque plugin (« display » des notifications, « location » de la
# position) dans ses annotations @CapacitorPlugin / @Permission, par réflexion. R8, activé le 05/11/2026 (build.gradle), garde les
# classes des plugins mais pas les types d'annotation eux-mêmes : en mode complet, une annotation dont le type n'est pas conservé
# est retirée. Sans elles, checkPermissions() ne trouve aucune autorisation déclarée et rend undefined (Plugin.checkPermissions :
# « if no permissions are defined on the plugin, resolve undefined ») : c'est l'erreur vue. On garde donc les annotations, leurs
# types et les classes de Capacitor et des plugins officiels — le code de l'app reste réduit et obscurci.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep @interface com.getcapacitor.** { *; }
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
# La bibliothèque de position du plugin (io.ionic.libs, avec gson) : mêmes raisons, mêmes règles.
-keep class io.ionic.libs.** { *; }
