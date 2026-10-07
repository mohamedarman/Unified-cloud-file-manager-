// :domain - PURE KOTLIN. No Android plugin. No AndroidX dependency.
//
// This is not a convention. Applying `kotlin-jvm` rather than `kotlin-android`
// means an `import android.*` here is a COMPILE ERROR. That is the mechanical
// enforcement of Rules.md L-1/L-2 and ADR-10: the highest-severity architectural
// rule in the project is enforced by the build rather than by reviewer memory.
//
// If a change ever requires Android types here, the dependency is wrong, not the
// rule (Rules.md L-6). The root `verifyDomainPurity` task re-checks this
// configuration so the guarantee cannot be quietly removed.

plugins {
    alias(libs.plugins.kotlin.jvm)
}

kotlin {
    // Explicit, so a JDK upgrade is a deliberate change rather than a surprise.
    jvmToolchain(17)

    compilerOptions {
        allWarningsAsErrors.set(true)
        // Any accidental Android import should fail loudly even before the
        // module-type check does.
        freeCompilerArgs.add("-Xjvm-default=all")
    }
}

dependencies {
    // Coroutines and Flow are language-level concerns, not Android ones, so they
    // are permitted here. Everything else is forbidden.
    api(libs.coroutines.core)

    // The provider abstraction returns java.io.InputStream (see ContentSource).
    // That is JDK, not Android, and is available in a pure JVM module.

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
}

tasks.withType<Test>().configureEach {
    useJUnit()
    testLogging {
        events("failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}
