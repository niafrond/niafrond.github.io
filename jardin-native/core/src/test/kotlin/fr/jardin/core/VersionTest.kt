package fr.jardin.core

import kotlin.test.Test
import kotlin.test.assertTrue

class VersionTest {
    @Test fun versionDefinie() = assertTrue(CORE_VERSION.isNotBlank())
}
