package fr.jardin.core.plan

import fr.jardin.core.Bounds
import fr.jardin.core.Point
import kotlin.math.max
import kotlin.math.min

/** Position écran en pixels. */
data class ScreenPoint(val x: Double, val y: Double)

/**
 * Transformation monde (mètres, x droite, y bas) <-> écran (pixels) d'un plan 2D.
 * `cx`/`cy` : point du monde au centre de la zone ; `scale` : pixels par mètre.
 * Immuable : chaque geste renvoie une nouvelle vue.
 */
data class PlanView(
    val cx: Double = 5.0,
    val cy: Double = 4.0,
    val scale: Double = 25.0,
    val width: Double = 390.0,
    val height: Double = 520.0,
) {
    fun toScreen(p: Point): ScreenPoint = ScreenPoint((p.x - cx) * scale + width / 2, (p.y - cy) * scale + height / 2)
    fun toWorld(sx: Double, sy: Double): Point = Point(cx + (sx - width / 2) / scale, cy + (sy - height / 2) / scale)

    /** Longueur en pixels -> mètres (tolérances de toucher indépendantes du zoom). */
    fun px(pixels: Double): Double = pixels / scale

    fun withSize(w: Double, h: Double): PlanView = if (w > 0 && h > 0) copy(width = w, height = h) else this

    /** Glissement d'un doigt de (dx, dy) pixels : le monde suit le doigt. */
    fun panBy(dx: Double, dy: Double): PlanView = copy(cx = cx - dx / scale, cy = cy - dy / scale)

    /** Zoom de `factor` autour du point écran (sx, sy) : le point du monde sous le doigt reste en place. */
    fun zoomAt(sx: Double, sy: Double, factor: Double): PlanView {
        if (!(factor > 0)) return this
        val before = toWorld(sx, sy)
        val s = (scale * factor).coerceIn(MIN_SCALE, MAX_SCALE)
        val tmp = copy(scale = s)
        val after = tmp.toWorld(sx, sy)
        return tmp.copy(cx = cx + (before.x - after.x), cy = cy + (before.y - after.y))
    }

    fun zoomCenter(factor: Double): PlanView = zoomAt(width / 2, height / 2, factor)

    /**
     * Cadre `b` dans la zone visible (marge `margin` > 1) ; `topInset`/`bottomInset` : bandes recouvertes par des barres
     * flottantes (le contenu est centré dans l'espace libre).
     */
    fun fit(b: Bounds, margin: Double = 1.35, topInset: Double = 0.0, bottomInset: Double = 0.0): PlanView {
        val usableH = max(1.0, height - topInset - bottomInset)
        val w = max(b.width, 2.0)
        val h = max(b.height, 2.0)
        val s = (min(width / w, usableH / h) / margin).coerceIn(MIN_SCALE, MAX_SCALE)
        val mx = b.minX + b.width / 2
        val my = b.minY + b.height / 2
        // le centre de l'espace libre est décalé de (topInset - bottomInset)/2 sous le centre de l'écran
        val shift = (topInset - bottomInset) / 2
        return copy(cx = mx, cy = my - shift / s, scale = s)
    }

    /** Cadrage d'un point seul (plan presque vide). */
    fun centerOn(p: Point, scale: Double = this.scale): PlanView = copy(cx = p.x, cy = p.y, scale = scale.coerceIn(MIN_SCALE, MAX_SCALE))

    companion object {
        const val MIN_SCALE = 2.0   // 0,5 m par pixel... jamais plus petit que 2 px/m
        const val MAX_SCALE = 700.0 // ~1,4 mm par pixel
    }
}
