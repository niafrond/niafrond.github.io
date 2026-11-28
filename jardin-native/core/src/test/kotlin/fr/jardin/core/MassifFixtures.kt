package fr.jardin.core

// Jardins de test pour les massifs automatiques (port de jardin/tests/unit/massif-fixtures.js).

internal fun rectShape(x: Double, y: Double, w: Double, h: Double): PolygonShape =
    PolygonShape(listOf(Point(x, y), Point(x + w, y), Point(x + w, y + h), Point(x, y + h)))

private fun pts(vararg xy: Double): List<Point> = xy.toList().chunked(2).map { Point(it[0], it[1]) }

/** Rectangle 12 × 9 m : maison au nord, terrasse, pelouse, banc, piscine. */
internal fun gardenA(): Garden = createGarden("Test A").let { g ->
    g.copy(
        boundary = pts(0.0, 0.0, 12.0, 0.0, 12.0, 9.0, 0.0, 9.0), boundaryClosed = true,
        context = g.context.copy(departement = "75"),
        sun = SunInfo("uniform", "full", emptyList()),
        obstacles = listOf(Obstacle(id = "maison", kind = "house", points = pts(0.0, 0.0, 12.0, 0.0, 12.0, 1.6, 0.0, 1.6), height = 6.0)),
        zones = listOf(
            createZone("terrace", rectShape(3.0, 1.6, 5.0, 2.4)),
            createZone("lawn", rectShape(3.0, 5.0, 5.0, 3.0)),
            createZone("pool", CircleShape(Point(10.2, 6.2), 1.0)),
        ),
        items = listOf(createItem("bench", 1.0, 4.0, 0.0)),
    )
}

/** Grand jardin d'environ 300 m² (20 × 15) avec maison, terrasse, pelouse, mobilier, arbres et mare. */
internal fun gardenBig(): Garden = createGarden("Test grand").let { g ->
    g.copy(
        boundary = pts(0.0, 0.0, 20.0, 0.0, 20.0, 15.0, 0.0, 15.0), boundaryClosed = true,
        context = g.context.copy(departement = "69"),
        sun = SunInfo("uniform", "partial", emptyList()),
        boundaryEdges = listOf(BoundaryEdge("fence"), BoundaryEdge("hedge"), BoundaryEdge("wall"), BoundaryEdge("fence")),
        obstacles = listOf(
            Obstacle(id = "maison", kind = "house", points = pts(4.0, 0.0, 16.0, 0.0, 16.0, 3.0, 4.0, 3.0), height = 6.0),
            Obstacle(id = "abri", kind = "shed", points = pts(17.0, 11.0, 19.5, 11.0, 19.5, 13.5, 17.0, 13.5), height = 2.3),
            Obstacle(id = "arbre", kind = "tree", center = Point(3.0, 11.0), radius = 2.0, height = 7.0),
        ),
        zones = listOf(
            createZone("terrace", rectShape(6.0, 3.0, 8.0, 4.0)),
            createZone("lawn", rectShape(5.0, 8.5, 9.0, 5.0)),
            createZone("pond", CircleShape(Point(16.0, 7.0), 1.2)),
            createZone("path", LineShape(pts(10.0, 7.0, 10.0, 8.5), 1.0)),
        ),
        items = listOf(createItem("table", 9.0, 5.0, 0.0), createItem("bench", 2.0, 6.0, 90.0)),
    )
}
