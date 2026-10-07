pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "unified-cloud-file-manager"

// Module graph. See Architecture.md §5 and §33.3.
//
// :domain is a PURE KOTLIN JVM MODULE. It has no Android plugin and therefore
// cannot compile against an Android type. This is the mechanical enforcement of
// Rules.md L-1/L-2 and ADR-10 - not a convention that a reviewer has to remember.
include(":app")
include(":domain")
include(":data")
include(":cloud")
include(":core")

// Dependency direction, inward only (Rules.md L-6):
//
//   :app  ->  :domain, :data, :cloud, :core
//   :data ->  :domain, :cloud, :core
//   :cloud ->  :domain, :core
//   :core ->  (nothing internal)
//
// :domain depends on nothing internal. If a change requires it to, the design
// is wrong, not the rule (Rules.md L-6).
