// :app - Compose UI, navigation, DI container, DocumentsProvider, workers.
import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.unifiedcloud.filemanager"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.unifiedcloud.filemanager"
        minSdk = libs.versions.minSdk.get().toInt()
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField(
            "String",
            "GOOGLE_OAUTH_CLIENT_ID",
            "\"${providers.gradleProperty("GOOGLE_OAUTH_CLIENT_ID").orElse("").get()}\"",
        )
        buildConfigField(
            "String",
            "ONEDRIVE_CLIENT_ID",
            "\"${providers.gradleProperty("ONEDRIVE_CLIENT_ID").orElse("").get()}\"",
        )
        buildConfigField(
            "String",
            "DROPBOX_CLIENT_ID",
            "\"${providers.gradleProperty("DROPBOX_CLIENT_ID").orElse("").get()}\"",
        )
        buildConfigField(
            "String",
            "BOX_CLIENT_ID",
            "\"${providers.gradleProperty("BOX_CLIENT_ID").orElse("").get()}\"",
        )

        // SEC-14: debug logging is compiled out of release builds. The token
        // store is excluded from backup (Rules.md ST-5); a missing allowBackup
        // rule here would be a security defect, not a configuration gap.
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // No debug logging in release. The redacting logger is stripped.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    jvmToolchain(17)
    compilerOptions { allWarningsAsErrors.set(true) }
}

abstract class BuildFrontendTask : DefaultTask() {
    @get:Inject
    abstract val execOperations: ExecOperations

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webSrcDir: DirectoryProperty

    @get:InputDirectory
    @get:Optional
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webPublicDir: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webConfigFiles: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun build() {
        val rootDir = projectRoot.get().asFile
        val isWindows = System.getProperty("os.name").lowercase().contains("windows")
        val nodeModules = File(rootDir, "node_modules")
        val lockFile = File(rootDir, "package-lock.json")

        if (!nodeModules.exists()) {
            execOperations.exec {
                workingDir = rootDir
                if (isWindows) {
                    if (lockFile.exists()) {
                        commandLine("cmd", "/c", "npm ci")
                    } else {
                        commandLine("cmd", "/c", "npm install")
                    }
                } else {
                    if (lockFile.exists()) {
                        commandLine("npm", "ci")
                    } else {
                        commandLine("npm", "install")
                    }
                }
            }
        }

        execOperations.exec {
            workingDir = rootDir
            if (isWindows) {
                commandLine("cmd", "/c", "npm run build")
            } else {
                commandLine("npm", "run", "build")
            }
        }
    }
}

abstract class CopyFrontendAssetsTask : DefaultTask() {
    @get:Inject
    abstract val fileSystemOperations: FileSystemOperations

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sourceDir: DirectoryProperty

    @get:OutputDirectory
    abstract val targetDir: DirectoryProperty

    @TaskAction
    fun copyAssets() {
        fileSystemOperations.sync {
            from(sourceDir)
            into(targetDir)
        }
    }
}

val buildFrontend =
    tasks.register<BuildFrontendTask>("buildFrontend") {
        projectRoot.set(layout.projectDirectory.dir(".."))
        webSrcDir.set(layout.projectDirectory.dir("../src"))
        val publicDir = layout.projectDirectory.dir("../public")
        if (publicDir.asFile.exists()) {
            webPublicDir.set(publicDir)
        }
        webConfigFiles.from(
            layout.projectDirectory.file("../index.html"),
            layout.projectDirectory.file("../package.json"),
            layout.projectDirectory.file("../package-lock.json"),
            layout.projectDirectory.file("../vite.config.ts"),
            layout.projectDirectory.file("../tsconfig.json"),
        )
        outputDir.set(layout.projectDirectory.dir("../dist"))
    }

val copyFrontendAssets =
    tasks.register<CopyFrontendAssetsTask>("copyFrontendAssets") {
        dependsOn(buildFrontend)
        sourceDir.set(buildFrontend.flatMap { it.outputDir })
        targetDir.set(layout.projectDirectory.dir("src/main/assets"))
    }

tasks.named("preBuild") {
    dependsOn(copyFrontendAssets)
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":data"))
    implementation(project(":cloud"))
    implementation(project(":core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.browser)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.coroutines.android)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.coil.compose)

    implementation(libs.androidx.documentfile)
    implementation(libs.androidx.work.runtime)
    implementation(libs.androidx.paging.runtime)
    implementation(libs.androidx.paging.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.serialization.json)
    implementation(libs.okhttp)

    // No Hilt/Koin. The AppContainer is hand-written (Architecture.md §4.2).
    // No Firebase/Crashlytics until Phase 17 (Rules.md TM-1).

    debugImplementation(libs.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
