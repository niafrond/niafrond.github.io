package fr.jardin.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxSize
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import fr.jardin.app.ui.HomeScreen
import fr.jardin.app.ui.WizardScreen

private const val ROUTE_HOME = "home"
private const val ROUTE_GARDEN = "garden/{id}"

/** Navigation : accueil → assistant (les étapes sont gérées dans l'assistant). */
@Composable
fun JardinApp() {
    val nav = rememberNavController()
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        NavHost(navController = nav, startDestination = ROUTE_HOME) {
            composable(ROUTE_HOME) {
                HomeScreen(onOpen = { id -> nav.navigate("garden/$id") })
            }
            composable(ROUTE_GARDEN, arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                val id = entry.arguments?.getString("id") ?: ""
                WizardScreen(gardenId = id, onBack = { nav.popBackStack() })
            }
        }
    }
}
