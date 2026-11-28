package fr.jardin.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import fr.jardin.core.CORE_VERSION

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { JardinTheme { Accueil() } }
    }
}

@Composable
fun JardinTheme(content: @Composable () -> Unit) = MaterialTheme(content = content)

@Composable
fun Accueil() {
    Surface(Modifier.fillMaxSize()) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.Start) {
            Text("Jardin", style = MaterialTheme.typography.headlineLarge)
            Text("Version native (noyau $CORE_VERSION) : en construction.", style = MaterialTheme.typography.bodyLarge)
        }
    }
}
