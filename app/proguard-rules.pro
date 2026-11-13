# Unified Cloud File Manager - ProGuard / R8 Keep Rules

# Keep WebView @JavascriptInterface bridge methods called dynamically by JS
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep public class com.unifiedcloud.filemanager.NativeCloudBridge {
    public <methods>;
}

# Keep WorkManager worker classes instantiated via reflection
-keep class com.unifiedcloud.filemanager.CloudSyncWorker { *; }

# Keep kotlinx.serialization generated serializers and companions
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.unifiedcloud.filemanager.**$$serializer { *; }
-keepclassmembers class com.unifiedcloud.filemanager.** {
    *** Companion;
}
-keepclasseswithmembers class com.unifiedcloud.filemanager.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# OkHttp / Okio compile-only annotations
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Room & AndroidX safety
-keepclassmembers class * extends androidx.room.RoomDatabase {
    public <methods>;
}
-keep @androidx.annotation.Keep class * { *; }
-keepclassmembers class * {
    @androidx.annotation.Keep <fields>;
    @androidx.annotation.Keep <methods>;
}
