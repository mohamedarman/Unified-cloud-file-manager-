// :cloud - provider abstraction implementation. Android library.
//
// The INTERFACE lives in :domain (Architecture.md §6.1). This module holds the
// Google Drive implementation only. No other provider exists, and none may be
// stubbed (Rules.md §33, FP-1).
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.unifiedcloud.filemanager.cloud"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        minSdk = libs.versions.minSdk.get().toInt()
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
    compilerOptions { allWarningsAsErrors.set(true) }
}

dependencies {
    api(project(":domain"))
    implementation(project(":core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.coroutines.android)
    implementation(libs.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // Q-01 / V-05 UNVALIDATED (Memory.md §2). AuthorizationClient's ability to
    // yield a Drive-suitable refresh token is the open question. If Q-01 AND Q-02
    // both resolve against a custom flow, AppAuth replaces this - do not add it
    // speculatively (Architecture.md §4.2).
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services)

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
    // Provider tests run against recorded/sanitised responses and scripted
    // failures. The live Drive API is NEVER called in CI (Rules.md TS-3).
    testImplementation(libs.okhttp.mockwebserver)
}
