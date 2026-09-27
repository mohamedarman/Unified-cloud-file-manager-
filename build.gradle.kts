// Root build file. Plugins are declared here with `apply false` so that the
// version is resolved once, centrally, and each module opts in.
//
// All versions live in gradle/libs.versions.toml. No version literal belongs in
// any module build file (docs/environment/toolchain.md §5).

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.compose.compiler) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.detekt) apply false
    alias(libs.plugins.ktlint) apply false
}

// ---------------------------------------------------------------------------
// Static analysis is applied to every module that compiles Kotlin, rather than
// repeated in five build files where it could be forgotten in the sixth.
//
// Architecture.md §27.2 makes these blocking gates. A gate declared per-module
// is a gate that eventually does not run.
// ---------------------------------------------------------------------------
subprojects {
    plugins.withId("org.jetbrains.kotlin.jvm") { configureKotlinQuality(isAndroid = false) }
    plugins.withId("org.jetbrains.kotlin.android") { configureKotlinQuality(isAndroid = true) }
}

fun Project.configureKotlinQuality(isAndroid: Boolean) {
    pluginManager.apply(libs.plugins.detekt.get().pluginId)
    pluginManager.apply(libs.plugins.ktlint.get().pluginId)

    extensions.configure<io.gitlab.arturbosch.detekt.extensions.DetektExtension> {
        buildUponDefaultConfig = true
        allRules = false
        config.setFrom(rootProject.file("config/detekt/detekt.yml"))
        baseline = rootProject.file("config/detekt/baseline.xml").takeIf { it.exists() }
    }

    extensions.configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        // :domain and :core are plain JVM. Telling ktlint they were Android
        // modules would apply Android import-ordering rules to code that has no
        // Android imports, which is both wrong and a source of confusing diffs.
        android.set(isAndroid)
        ignoreFailures.set(false)
        filter {
            exclude { element -> element.file.path.contains("${File.separator}build${File.separator}") }
        }
    }

    tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
        jvmTarget = "17"
        reports {
            html.required.set(true)
            xml.required.set(true)
            sarif.required.set(false)
        }
    }

    // detekt and ktlint are wired into `check` so a plain `./gradlew check`
    // is sufficient locally. CI calls the tasks directly for clearer logs.
    tasks.matching { it.name == "check" }.configureEach {
        dependsOn("detekt", "ktlintCheck")
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

// ---------------------------------------------------------------------------
// Domain purity - Rules.md L-1, L-2, ADR-10, PR-11
// ---------------------------------------------------------------------------
// :domain is a pure Kotlin JVM module, so an Android import there is a COMPILE
// ERROR rather than a review comment.
//
// This task is the second line of defence: it inspects the *configured* :domain
// project rather than grepping its build script, so it cannot be satisfied by a
// comment and cannot be broken by a reformat. An earlier version of this task
// string-matched "kotlin-jvm" in the build file, which was both fragile and
// quietly wrong - the file says `libs.plugins.kotlin.jvm`.
val verifyDomainPurity by tasks.registering {
    group = "verification"
    description = "Fails if :domain is not a pure Kotlin JVM module, or if it depends on Android."

    doLast {
        val domain = project(":domain")
        val errors = mutableListOf<String>()

        if (!domain.plugins.hasPlugin("org.jetbrains.kotlin.jvm")) {
            errors += ":domain does not apply org.jetbrains.kotlin.jvm. It must be a pure JVM module."
        }

        listOf(
            "org.jetbrains.kotlin.android",
            "com.android.application",
            "com.android.library",
            "com.android.dynamic-feature",
        ).forEach { id ->
            if (domain.plugins.hasPlugin(id)) {
                errors += ":domain must not apply '$id' (Rules.md L-1)."
            }
        }

        // Declared dependencies, read without resolving them - so this check
        // needs no network and no SDK, and cannot pass merely because a
        // repository was unreachable. Catches an AndroidX artifact sneaking in
        // even with no Android plugin applied (Rules.md L-2).
        val bannedPrefixes = listOf(
            "androidx.",
            "com.google.firebase",
            "com.google.android.gms",
            "com.google.android.material",
        )
        domain.configurations.forEach { configuration ->
            configuration.dependencies.forEach { dependency ->
                if (bannedPrefixes.any { dependency.name.startsWith(it) }) {
                    errors += ":${configuration.name} declares '${dependency.name}', " +
                        "which is an Android dependency (Rules.md L-2)."
                }
            }
        }

        if (errors.isNotEmpty()) {
            throw GradleException(
                "Domain purity violated:\n" + errors.joinToString("\n") { "  - $it" }
            )
        }

        logger.lifecycle("Domain purity OK: :domain is a pure Kotlin JVM module with no Android dependencies.")
    }
}

// ---------------------------------------------------------------------------
// Prohibited-phrasing scan - Rules.md §23, PS-1..PS-3, PR-10
// ---------------------------------------------------------------------------
// Banned terms derived from Rules.md §1. This is a BUILD-BLOCKING gate, not a
// review checklist item. It covers source, string resources, and analytics event
// names, because a banned term in an event name is still a banned term (PS-5).
val bannedPhrases = listOf(
    "unlimited google storage",
    "unlimited storage",
    "free extra storage",
    "free extra google storage",
    "extra google storage",
    "extra storage",
    "bypass google drive limits",
    "bypass drive limits",
    "pooled storage",
    "pool storage",
    "combined quota",
    "combined storage",
    "add storage",
    "more storage for free",
    "storage pool",
)

val scanProhibitedPhrasing by tasks.registering {
    group = "verification"
    description = "Rejects any banned storage claim in source, resources, or analytics names."

    val roots = listOf(
        rootProject.projectDir.resolve("app/src"),
        rootProject.projectDir.resolve("data/src"),
        rootProject.projectDir.resolve("cloud/src"),
        rootProject.projectDir.resolve("core/src"),
        rootProject.projectDir.resolve("domain/src"),
    )
    val terms = bannedPhrases
    val excludedDirNames = setOf("build", ".git", "node_modules")

    doLast {
        val findings = mutableListOf<String>()

        for (root in roots) {
            if (!root.exists()) continue
            root.walkTopDown()
                .onEnter { it.name !in excludedDirNames }
                .filter { it.isFile }
                .filter { it.extension in setOf("kt", "kts", "xml", "json", "txt", "md", "html") }
                .forEach { file ->
                    val lower = file.readText().lowercase()
                    for (term in terms) {
                        if (lower.contains(term)) {
                            findings += "${file.relativeTo(rootProject.projectDir)}: contains banned phrase \"$term\""
                        }
                    }
                }
        }

        if (findings.isNotEmpty()) {
            throw GradleException(
                "Prohibited phrasing found (Rules.md §1, §23). The product adds no storage " +
                    "and never claims to:\n" + findings.joinToString("\n") { "  - $it" }
            )
        }
    }
}

// ---------------------------------------------------------------------------
// APK secret scan - Rules.md TK-2, SEC-02, PR-6
// ---------------------------------------------------------------------------
val scanApkSecrets by tasks.registering {
    group = "verification"
    description = "Fails if a client secret or token-shaped literal is committed to source."

    val roots = listOf(
        rootProject.projectDir.resolve("app/src"),
        rootProject.projectDir.resolve("data/src"),
        rootProject.projectDir.resolve("cloud/src"),
        rootProject.projectDir.resolve("core/src"),
    )
    val excludedDirNames = setOf("build", ".git", "test", "androidTest")

    // Google OAuth client secrets begin with GOCSPX- (installed-app) or
    // GOCSPX- (web). Refresh tokens are opaque; we look for the structural
    // markers rather than attempting to validate a real token.
    val secretPatterns = listOf(
        Regex("""GOCSPX-[A-Za-z0-9_-]{10,}"""),
        Regex("""\b1//[A-Za-z0-9_-]{30,}"""),   // legacy API key style
        Regex("""\bya29\.[A-Za-z0-9_-]{20,}"""), // OAuth access token
        Regex("""\b1//0"""),                     // refresh token prefix
    )

    doLast {
        val findings = mutableListOf<String>()

        for (root in roots) {
            if (!root.exists()) continue
            root.walkTopDown()
                .onEnter { it.name !in excludedDirNames }
                .filter { it.isFile }
                .filter { it.extension in setOf("kt", "kts", "xml", "properties") }
                .forEach { file ->
                    val text = file.readText()
                    for (pattern in secretPatterns) {
                        if (pattern.containsMatchIn(text)) {
                            findings += "${file.relativeTo(rootProject.projectDir)}: matches ${pattern.pattern}"
                        }
                    }
                }
        }

        if (findings.isNotEmpty()) {
            throw GradleException(
                "Secret-shaped literal found in source (Rules.md TK-2, SEC-02):\n" +
                    findings.joinToString("\n") { "  - $it" }
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Source encoding - UTF-8, no BOM, and above all no NUL bytes
// ---------------------------------------------------------------------------
// This exists because of a real defect, not a hypothetical one.
// `core/.../logging/Redactor.kt` carried a raw NUL byte inside a string literal
// (a NUL used as a separator between the account id and the file id in a hash
// input). Git classified the whole file as binary: it could not be diffed,
// merged, or grepped, and the first commit recorded it as `Bin 0 -> 4555 bytes`
// instead of 107 lines of source. The Kotlin was probably fine. Everything
// around it silently was not.
//
// A NUL in source is invisible in an editor, survives review, and breaks tooling
// in ways that look like unrelated problems. `.gitattributes` cannot catch it -
// `text` normalisation does not remove NUL bytes, so the file stays binary in
// the repository however the attributes are set. Only a byte-level check does.
//
// The BOM half is the same class of problem: Gradle's Kotlin compilation accepts
// a BOM, but it defeats byte-offset tooling and has repeatedly caused
// "invisible character" diffs in Kotlin projects.
val verifySourceEncoding by tasks.registering {
    group = "verification"
    description = "Fails if a source file contains a NUL byte or a UTF-8 BOM."

    val roots = listOf("app", "cloud", "core", "data", "domain")
    val extensions = setOf("kt", "kts", "java", "xml", "md", "toml", "yml", "yaml", "json", "pro")
    val excludedDirNames = setOf("build", ".git", ".gradle", "node_modules")

    doLast {
        val findings = mutableListOf<String>()

        for (module in roots) {
            val root = rootProject.projectDir.resolve(module).resolve("src")
            if (!root.exists()) continue
            root.walkTopDown()
                .onEnter { it.name !in excludedDirNames }
                .filter { it.isFile }
                .filter { it.extension in extensions }
                .forEach { file ->
                    val bytes = file.readBytes()
                    if (bytes.size >= 3 &&
                        bytes[0] == 0xEF.toByte() &&
                        bytes[1] == 0xBB.toByte() &&
                        bytes[2] == 0xBF.toByte()
                    ) {
                        findings += "${file.relativeTo(rootProject.projectDir)}: starts with a UTF-8 BOM"
                    }
                    bytes.forEachIndexed { index, byte ->
                        if (byte == 0.toByte()) {
                            val offset = index
                            findings += "${file.relativeTo(rootProject.projectDir)}: " +
                                "NUL byte at offset $offset - git will treat this file as binary. " +
                                "Use an escape (\\u0000), not a literal control character."
                            return@forEachIndexed
                        }
                    }
                }
        }

        if (findings.isNotEmpty()) {
            throw GradleException(
                "Source encoding violations:\n" + findings.joinToString("\n") { "  - $it" }
            )
        }
    }
}

// The four policy gates above are registered on the ROOT project, so they need
// a root `check` to hang from. The root applies no plugin, and no plugin
// contributes a lifecycle task to a project that has none - so
// `tasks.named("check")` here failed at configuration time with
// "Task with name 'check' not found in root project".
//
// The alternative was `plugins { base }`, which does supply `check` - but it
// also supplies `clean`, and this file already registers its own `clean` a few
// lines up, so adopting it would mean deleting a working task to gain an
// equivalent one. Registering `check` directly is the smaller change.
//
// Note that `./gradlew check` still fans out to every subproject's `check`,
// which `configureKotlinQuality` has already wired to detekt and ktlint. So
// this task adds the four policy gates; it does not replace the per-module
// analysis.
tasks.register("check") {
    group = "verification"
    description = "Runs the repository policy gates: domain purity, prohibited phrasing, secrets, source encoding."
    dependsOn(verifyDomainPurity, scanProhibitedPhrasing, scanApkSecrets, verifySourceEncoding)
}
