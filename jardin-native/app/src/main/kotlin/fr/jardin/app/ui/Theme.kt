package fr.jardin.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Couleurs reprises de jardin/style.css (:root et mode sombre).
private val LightColors = lightColorScheme(
    primary = Color(0xFF2F7D4F),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFD4EBDC),
    onPrimaryContainer = Color(0xFF0E3A20),
    background = Color(0xFFF4F7F2),
    onBackground = Color(0xFF1D2A21),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1D2A21),
    surfaceVariant = Color(0xFFE6EDE7),
    onSurfaceVariant = Color(0xFF56655B),
    outline = Color(0xFFD3DDD5),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFE6F1FB),
    onSecondaryContainer = Color(0xFF1D2A21),
    tertiaryContainer = Color(0xFFFFF4D6),
    onTertiaryContainer = Color(0xFF1D2A21),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF5FBF84),
    onPrimary = Color(0xFF08140C),
    primaryContainer = Color(0xFF1F4A31),
    onPrimaryContainer = Color(0xFFD4EBDC),
    background = Color(0xFF0F1A14),
    onBackground = Color(0xFFE4EFE6),
    surface = Color(0xFF172319),
    onSurface = Color(0xFFE4EFE6),
    surfaceVariant = Color(0xFF22332A),
    onSurfaceVariant = Color(0xFF9DB3A2),
    outline = Color(0xFF2C3D30),
    error = Color(0xFFF2877F),
    onError = Color(0xFF3A0B07),
    secondaryContainer = Color(0xFF14283A),
    onSecondaryContainer = Color(0xFFE4EFE6),
    tertiaryContainer = Color(0xFF3A3014),
    onTertiaryContainer = Color(0xFFE4EFE6),
)

@Composable
fun JardinTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, content = content)
}
