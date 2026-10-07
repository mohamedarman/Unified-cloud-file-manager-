// :core - cross-cutting, domain-agnostic utilities. Pure Kotlin JVM.
//
// Depends on NOTHING internal (Rules.md L-6). This is enforced by the module
// graph in settings.gradle.kts, and it is why `Redactor` takes and returns
// primitives rather than domain types: the moment a helper here needs
// `AppError` or a `FileRef`, it belongs in :domain, not here. A `:core` that
// depended on :domain would invert the layering and make "core" a second domain
// module under a misleading name.
plugins {
    alias(libs.plugins.kotlin.jvm)
}

kotlin {
    jvmToolchain(17)
    compilerOptions { allWarningsAsErrors.set(true) }
}

dependencies {
    api(libs.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
}
