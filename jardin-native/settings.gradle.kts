pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositories { google(); mavenCentral() } }
rootProject.name = "jardin-native"
include(":core")
// Le module Android n'est inclus que si un SDK Android est disponible (CI, poste de dev) ; le noyau se teste sans.
if (System.getenv("ANDROID_HOME") != null || System.getenv("ANDROID_SDK_ROOT") != null || file("local.properties").exists()) include(":app")
