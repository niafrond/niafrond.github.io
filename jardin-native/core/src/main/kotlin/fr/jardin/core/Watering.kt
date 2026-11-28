package fr.jardin.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.max
import kotlin.math.min

// Arrosage (port de jardin/watering.js) : hydrozones, besoins, bilan hydrique, planification des notifications.
//
// BILAN HYDRIQUE (par zone, jour par jour, en mm = L/m²) :
//   ETc      = ET₀ × kc × facteur sol × facteur soleil × facteur reprise
//   pluie eff. = 80 % de la pluie si < 10 mm, sinon 60 %
//   déficit(j) = max(0, déficit(j-1) + ETc − pluie eff.) ; déclenchement au-delà du seuil (faible 15 / moyen 10 / élevé 6 mm).
//   Dose = déficit (plafonné à 25 mm) × surface.
// RÈGLES : pas d'arrosage si pluie ≥ 5 mm le jour même ou prévue ≥ 5 mm le lendemain ; jamais deux jours de suite sauf canicule
//   (tmax ≥ 35 °C) ; une notification groupée par jour ; veille d'un gel (tmin ≤ 2 °C) / d'une canicule : alerte ; vacances et report.
// SANS MÉTÉO : repli calendaire mensuel. Tout est ordre de grandeur.

/** Niveau d'eau (`low` | `medium` | `high`) et coefficient cultural d'une zone. */
data class ZoneWaterProfile(val level: String, val kc: Double)

data class Hydrozone(val id: String, val level: String, val zoneIds: List<String>, val areaM2: Double, val avgKc: Double)

data class MonthlyZone(val zoneId: String, val label: String, val level: String, val intervalDays: Int, val timesPerWeek: Double, val litersPerWatering: Int, val litersPerWeek: Int)
data class MonthlySchedule(val month: Int, val zones: List<MonthlyZone>)

/** État d'arrosage : dernière date arrosée par zone (`YYYY-MM-DD`) et report éventuel. */
data class WateringState(val lastWatered: Map<String, String> = emptyMap(), val snoozeUntil: String? = null)

/** Réglages de notification d'arrosage. */
data class NotifSettings(
    val hour: Int = 19, val minute: Int = 0, val enabled: Boolean = true,
    val vacationUntil: String? = null, val frost: Boolean = true, val heat: Boolean = true,
)

data class WateringNotification(val id: Int, val at: String, val title: String, val body: String, val zoneIds: List<String>, val kinds: List<String>)
data class WeekSummary(val zoneId: String, val litersPerWeek: Int)
data class SkippedDay(val date: String, val reason: String)
data class WateringPlan(val notifications: List<WateringNotification>, val summary: List<WeekSummary>, val skipped: List<SkippedDay>, val withoutWeather: Boolean)

object Watering {
    const val FROST_C = 2.0
    const val HEAT_C = 35.0
    const val RAIN_SKIP_MM = 5.0
    private const val MAX_DEPTH_MM = 25.0
    private val THRESHOLD_MM = mapOf("low" to 15.0, "medium" to 10.0, "high" to 6.0)
    private val DEPTH_MM = mapOf("low" to 10.0, "medium" to 15.0, "high" to 20.0)
    private val ET0_MONTH = listOf(0.5, 0.9, 1.7, 2.8, 3.8, 4.6, 5.0, 4.3, 2.9, 1.5, 0.7, 0.4)
    private val RAIN_MONTH = listOf(2.0, 1.7, 1.7, 1.9, 2.3, 2.0, 1.7, 1.8, 2.0, 2.4, 2.5, 2.4)
    private val SOIL_FACTOR = mapOf("sandy" to 1.15, "limestone" to 1.05, "loam" to 1.0, "clay" to 0.9, "humus" to 0.9)
    private val SUN_FACTOR = mapOf("full" to 1.1, "partial" to 1.0, "shade" to 0.85)
    private val NO_WATER = setOf("pond", "pool", "terrace", "path")
    private val TYPE_DEFAULT = mapOf(
        "lawn" to ZoneWaterProfile("medium", 0.8), "vegetable" to ZoneWaterProfile("high", 1.0), "orchard" to ZoneWaterProfile("medium", 0.7),
        "hedge" to ZoneWaterProfile("medium", 0.6), "trees" to ZoneWaterProfile("low", 0.6), "lowplants" to ZoneWaterProfile("medium", 0.6),
        "midplants" to ZoneWaterProfile("medium", 0.7), "tallplants" to ZoneWaterProfile("medium", 0.7),
    )
    private val RANK = mapOf("low" to 1, "medium" to 2, "high" to 3)
    private val LEVELS = listOf(null, "low", "medium", "high")
    private val TYPE_LABEL = mapOf(
        "pond" to "mare", "pool" to "piscine", "terrace" to "terrasse", "path" to "allée", "lawn" to "pelouse", "lowplants" to "couvre-sols",
        "midplants" to "massif", "tallplants" to "plantes hautes", "hedge" to "haie", "trees" to "arbres", "vegetable" to "potager",
        "orchard" to "verger", "other" to "zone",
    )

    private fun defaultLookup(): PlantById = { Catalog.getPlant(it) }

    // ── dates (clés locales 'YYYY-MM-DD') ──
    private fun pad(n: Int) = n.toString().padStart(2, '0')
    private fun keyOf(d: LocalDate) = "${d.year.toString().padStart(4, '0')}-${pad(d.monthValue)}-${pad(d.dayOfMonth)}"
    /** Clé de jour : les 10 premiers caractères d'une chaîne ISO. */
    fun dateKey(s: String): String = s.take(10)
    fun dateKey(d: LocalDate): String = keyOf(d)
    fun dateKey(instant: Instant, zone: ZoneId = ZoneId.systemDefault()): String = keyOf(instant.atZone(zone).toLocalDate())
    private fun parseKey(key: String): LocalDate? = try {
        val (y, m, d) = key.split('-').map { it.toInt() }
        LocalDate.of(y, m, d)
    } catch (_: Exception) { null }
    private fun addDays(key: String, n: Int): String = keyOf(parseKey(key)!!.plusDays(n.toLong()))
    private fun monthOf(key: String): Int = key.substring(5, 7).toInt()
    private fun daysBetween(a: String, b: String): Int? {
        val x = parseKey(a) ?: return null
        val y = parseKey(b) ?: return null
        return ChronoUnit.DAYS.between(x, y).toInt()
    }
    private val ISO_MS: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)
    private fun atInstant(key: String, hour: Int, minute: Int, zone: ZoneId): Instant =
        ZonedDateTime.of(java.time.LocalDateTime.of(parseKey(key)!!, java.time.LocalTime.MIDNIGHT).plusHours(hour.toLong()).plusMinutes(minute.toLong()), zone).toInstant()

    private fun effRain(mm: Double) = (if (mm < 10) 0.8 else 0.6) * mm
    private fun zoneLabel(z: Zone) = z.label.ifEmpty { TYPE_LABEL[z.type] ?: "zone" }

    /** Niveau d'eau et kc d'une zone (essences pondérées par le nombre de plants), null si pas d'arrosage. */
    fun zoneProfile(zone: Zone?, plantsById: PlantById = defaultLookup()): ZoneWaterProfile? {
        if (zone == null || zone.type in NO_WATER) return null
        var sw = 0.0; var sr = 0.0; var sk = 0.0
        for (pl in zone.plantings) {
            val p = plantsById(pl.plantId)
            if (p == null || p.category == "aquatic") continue
            val w = max(1, pl.count ?: 1).toDouble()
            sw += w; sr += w * (RANK[p.water] ?: 2); sk += w * p.kc
        }
        if (sw > 0) return ZoneWaterProfile(LEVELS[min(3, max(1, jsRound(sr / sw).toInt()))]!!, sk / sw)
        return TYPE_DEFAULT[zone.type]
    }

    private fun zoneArea(zone: Zone): Double = try { shapeArea(zone.shape) } catch (_: Exception) { 0.0 }

    private fun youngFactor(zone: Zone, day: String): Double {
        for (pl in zone.plantings) {
            val at = pl.plantedAt
            if (at.isNullOrEmpty()) continue
            val d = daysBetween(dateKey(at), day) ?: continue
            if (d >= 0 && d < 365) return 1.3
        }
        return 1.0
    }

    private fun sunFactor(garden: Garden?, zone: Zone): Double = try {
        if (garden == null) 1.0 else SUN_FACTOR[zoneSunLevel(garden, zone).level] ?: 1.0
    } catch (_: Exception) { 1.0 }

    private fun etcMm(zone: Zone, kc: Double, garden: Garden?, et0: Double, day: String): Double =
        et0 * kc * (SOIL_FACTOR[garden?.context?.soil] ?: 1.0) * sunFactor(garden, zone) * youngFactor(zone, day)

    private class Prof(val zone: Zone, val id: String, val label: String, val level: String, val kc: Double, val area: Double)

    private fun profiles(garden: Garden?, plantsById: PlantById): List<Prof> {
        val out = mutableListOf<Prof>()
        for (zone in garden?.zones ?: emptyList()) {
            val prof = zoneProfile(zone, plantsById)
            val area = zoneArea(zone)
            if (prof != null && area > 0) out.add(Prof(zone, zone.id, zoneLabel(zone), prof.level, prof.kc, area))
        }
        return out
    }

    /** Regroupe les zones arrosables par niveau de besoin. */
    fun hydrozones(garden: Garden?, plantsById: PlantById = defaultLookup()): List<Hydrozone> {
        class G(val level: String, val zoneIds: MutableList<String> = mutableListOf(), var area: Double = 0.0, var kcSum: Double = 0.0)
        val groups = LinkedHashMap<String, G>()
        for (p in profiles(garden, plantsById)) {
            val g = groups.getOrPut(p.level) { G(p.level) }
            g.zoneIds.add(p.id); g.area += p.area; g.kcSum += p.kc * p.area
        }
        return listOf("low", "medium", "high").filter { it in groups }.map { l -> groups.getValue(l).let { Hydrozone("hz-$l", it.level, it.zoneIds, it.area, it.kcSum / it.area) } }
    }

    /** Besoin d'une zone en L/jour un jour donné (sans pluie). `et0Mm` : ET₀ du jour (sinon climatologie du mois). */
    fun waterNeed(zone: Zone, garden: Garden?, day: LocalDate = LocalDate.now(), plantsById: PlantById = defaultLookup(), et0Mm: Double? = null): Double {
        val prof = zoneProfile(zone, plantsById)
        val area = zoneArea(zone)
        if (prof == null || area <= 0) return 0.0
        val key = keyOf(day)
        val et0 = et0Mm ?: ET0_MONTH[monthOf(key) - 1]
        return etcMm(zone, prof.kc, garden, et0, key) * area
    }

    /** Fréquence et litres par mois et par zone (repli sans météo). */
    fun monthlySchedule(garden: Garden?, plantsById: PlantById = defaultLookup(), year: Int = LocalDate.now().year): List<MonthlySchedule> {
        val profs = profiles(garden, plantsById)
        return ET0_MONTH.mapIndexed { i, et0 ->
            val month = i + 1
            val zones = profs.map { p ->
                val day = "$year-${pad(month)}-15"
                val netDay = max(0.0, etcMm(p.zone, p.kc, garden, et0, day) - effRain(RAIN_MONTH[i]))
                if (netDay * 7 < 2) MonthlyZone(p.id, p.label, p.level, 0, 0.0, 0, 0)
                else {
                    val depth = DEPTH_MM.getValue(p.level)
                    val interval = min(21.0, max(1.0, jsRound(depth / netDay))).toInt()
                    MonthlyZone(p.id, p.label, p.level, interval, jsRound((7.0 / interval) * 10) / 10,
                        jsRound(netDay * interval * p.area).toInt(), jsRound(netDay * 7 * p.area).toInt())
                }
            }
            MonthlySchedule(month, zones)
        }
    }

    // ── planification ──
    private fun roundL(x: Double): Long = max(1.0, jsRound(x)).toLong()
    private fun momentWord(hour: Int) = if (hour < 12) "ce matin" else if (hour < 17) "cet après-midi" else "ce soir"
    private fun joinLabels(l: List<String>): String = if (l.size <= 1) l.joinToString("") else "${l.dropLast(1).joinToString(", ")} et ${l.last()}"

    private class Due(val zoneId: String, val label: String, val liters: Double)

    private fun wateringLines(entries: List<Due>, profs: List<Prof>, hour: Int, suffix: String): List<String> {
        class G(val labels: MutableList<String> = mutableListOf(), var liters: Double = 0.0)
        val byLevel = LinkedHashMap<String, G>()
        for (e in entries) {
            val lvl = profs.first { it.id == e.zoneId }.level
            val g = byLevel.getOrPut(lvl) { G() }
            g.labels.add(e.label); g.liters += e.liters
        }
        return listOf("high", "medium", "low").filter { it in byLevel }.map { l ->
            val g = byLevel.getValue(l)
            "Arroser ${joinLabels(g.labels)} ${momentWord(hour)} (≈ ${roundL(g.liters)} L)$suffix"
        }
    }

    private fun notifId(key: String): Int = key.replace("-", "").toInt() * 10

    private fun tenderPlants(garden: Garden?, plantsById: PlantById): List<String> {
        val names = linkedSetOf<String>()
        for (z in garden?.zones ?: emptyList()) for (pl in z.plantings) {
            val p = plantsById(pl.plantId)
            if (p != null && p.hardiness > -5) names.add(p.commonName.ifEmpty { p.id })
        }
        return names.toList()
    }

    private fun notifTitle(kinds: Set<String>): String {
        val w = "water" in kinds; val f = "frost" in kinds; val h = "heat" in kinds
        if (w && !f && !h) return "Arrosage du jour"
        if (!w && f && !h) return "Alerte gel cette nuit"
        if (!w && !f && h) return "Alerte canicule"
        return "Jardin : arrosage et alertes météo"
    }

    private class Note(val lines: MutableList<String> = mutableListOf(), val kinds: LinkedHashSet<String> = linkedSetOf(), val zoneIds: LinkedHashSet<String> = linkedSetOf())

    /**
     * Planifie les notifications de 7 jours (`now` : instant courant ; `zone` : fuseau des clés de jour et de l'heure de notification).
     */
    fun planWatering(
        garden: Garden?, forecast: Forecast?, state: WateringState = WateringState(), now: Instant = Instant.now(),
        settings: NotifSettings = NotifSettings(), plantsById: PlantById = defaultLookup(), zone: ZoneId = ZoneId.systemDefault(),
    ): WateringPlan {
        val hour = settings.hour; val minute = settings.minute
        val enabled = settings.enabled
        val nowMs = now.toEpochMilli()
        val today = dateKey(now, zone)
        val lastDay = addDays(today, 6)
        val vacation = settings.vacationUntil?.takeIf { it.isNotEmpty() }?.let { dateKey(it) }
        val snooze = state.snoozeUntil?.takeIf { it.isNotEmpty() }?.let { dateKey(it) }
        val profs = profiles(garden, plantsById)
        val hasWeather = forecast != null && forecast.daily.isNotEmpty()
        val skipped = mutableListOf<SkippedDay>()
        val notes = LinkedHashMap<String, Note>()
        fun addNote(date: String, kind: String, lines: List<String>, zoneIds: List<String>) {
            val e = notes.getOrPut(date) { Note() }
            e.lines.addAll(lines); e.kinds.add(kind); e.zoneIds.addAll(zoneIds)
        }
        fun skip(date: String, reason: String) { if (skipped.none { it.date == date && it.reason == reason }) skipped.add(SkippedDay(date, reason)) }
        fun blocked(date: String): String? {
            if (vacation != null && date <= vacation) return "Mode vacances"
            if (snooze != null && date < snooze) return "Arrosage reporté"
            if (date == today && atInstant(date, hour, minute, zone).toEpochMilli() <= nowMs) return "Heure de notification passée"
            return null
        }

        val summary = mutableListOf<WeekSummary>()
        val lastWatered = state.lastWatered

        if (hasWeather) {
            val daily = forecast!!.daily.sortedBy { it.date }
            val bal = HashMap<String, Double>(); val lastWater = HashMap<String, String?>()
            for (p in profs) { bal[p.id] = 0.0; lastWater[p.id] = lastWatered[p.id] }
            val net = HashMap<String, Double>(); for (p in profs) net[p.id] = 0.0
            var futureDays = 0
            daily.forEachIndexed dayLoop@{ i, day ->
                val future = day.date >= today
                val et0 = day.et0Mm ?: ET0_MONTH[monthOf(day.date) - 1]
                val eff = effRain(day.precipMm ?: 0.0)
                val heat = day.tmaxC != null && day.tmaxC >= HEAT_C
                val nextRain = daily.getOrNull(i + 1)?.precipMm ?: 0.0
                if (future) futureDays++
                val due = mutableListOf<Prof>()
                for (p in profs) {
                    val etc = etcMm(p.zone, p.kc, garden, et0, day.date)
                    bal[p.id] = max(0.0, bal.getValue(p.id) + etc - eff)
                    if (future) net[p.id] = net.getValue(p.id) + etc - eff
                    if (lastWatered[p.id] == day.date) { bal[p.id] = 0.0; continue }
                    if (!future || day.date > lastDay || bal.getValue(p.id) <= THRESHOLD_MM.getValue(p.level)) continue
                    due.add(p)
                }
                if (due.isEmpty()) return@dayLoop
                val reason = blocked(day.date)
                    ?: (if ((day.precipMm ?: 0.0) >= RAIN_SKIP_MM) "Pluie ≥ 5 mm ce jour-là" else null)
                    ?: (if (nextRain >= RAIN_SKIP_MM) "Pluie ≥ 5 mm prévue dans les 24 h" else null)
                if (reason != null) { skip(day.date, reason); return@dayLoop }
                val entries = mutableListOf<Due>()
                for (p in due) {
                    if (!heat && lastWater[p.id] == addDays(day.date, -1)) { skip(day.date, "Pas deux jours de suite"); continue }
                    val mm = min(bal.getValue(p.id), MAX_DEPTH_MM)
                    val liters = mm * p.area
                    if (liters < 1) continue
                    bal[p.id] = bal.getValue(p.id) - mm; lastWater[p.id] = day.date
                    entries.add(Due(p.id, p.label, liters))
                }
                if (entries.isNotEmpty()) addNote(day.date, "water", wateringLines(entries, profs, hour, if (heat) " - canicule : privilégiez le soir" else ""), entries.map { it.zoneId })
            }
            for (p in profs) {
                val perWeek = if (futureDays > 0) (max(0.0, net.getValue(p.id)) / futureDays) * 7 * p.area else 0.0
                summary.add(WeekSummary(p.id, jsRound(perWeek).toInt()))
            }
            val tender = tenderPlants(garden, plantsById)
            for (day in daily) {
                val eve = addDays(day.date, -1)
                if (eve < today || eve > lastDay) continue
                if (settings.frost && tender.isNotEmpty() && day.tminC != null && day.tminC <= FROST_C) {
                    val r = blocked(eve)
                    if (r != null) { skip(eve, r); continue }
                    val list = tender.take(4).joinToString(", ") + if (tender.size > 4) "…" else ""
                    addNote(eve, "frost", listOf("Gel annoncé (${jsNum(jsRound(day.tminC))} °C) : protégez $list (voile d'hivernage, rentrer les pots)."), emptyList())
                }
                if (settings.heat && day.tmaxC != null && day.tmaxC >= HEAT_C) {
                    val r = blocked(eve)
                    if (r != null) { skip(eve, r); continue }
                    addNote(eve, "heat", listOf("Canicule demain (${jsNum(jsRound(day.tmaxC))} °C) : arrosez tôt ou tard, paillez et ombrez les plantes fragiles."), emptyList())
                }
            }
        } else {
            val sched = monthlySchedule(garden, plantsById, today.substring(0, 4).toInt())
            for (p in profs) {
                val per = sched[monthOf(today) - 1].zones.firstOrNull { it.zoneId == p.id }
                summary.add(WeekSummary(p.id, per?.litersPerWeek ?: 0))
            }
            val dues = LinkedHashMap<String, MutableList<Due>>()
            for (p in profs) {
                val last = lastWatered[p.id]
                val zToday = sched[monthOf(today) - 1].zones.firstOrNull { it.zoneId == p.id }
                var next = if (last != null && zToday != null && zToday.intervalDays != 0) addDays(last, zToday.intervalDays) else today
                if (next < today) next = today
                var guard = 0
                while (next <= lastDay && guard++ < 20) {
                    val z = sched[monthOf(next) - 1].zones.firstOrNull { it.zoneId == p.id }
                    if (z == null || z.intervalDays == 0) { next = addDays(next, 7); continue }
                    dues.getOrPut(next) { mutableListOf() }.add(Due(p.id, p.label, z.litersPerWatering.toDouble()))
                    next = addDays(next, z.intervalDays)
                }
            }
            for ((date, entries) in dues) {
                val r = blocked(date)
                if (r != null) { skip(date, r); continue }
                addNote(date, "water", wateringLines(entries, profs, hour, " - estimation sans météo"), entries.map { it.zoneId })
            }
        }

        val notifications = mutableListOf<WateringNotification>()
        if (enabled) {
            for (date in notes.keys.sorted()) {
                val e = notes.getValue(date)
                notifications.add(WateringNotification(notifId(date), ISO_MS.format(atInstant(date, hour, minute, zone)), notifTitle(e.kinds), e.lines.joinToString("\n"), e.zoneIds.toList(), e.kinds.toList()))
            }
        }
        skipped.sortBy { it.date }
        return WateringPlan(notifications, summary, skipped, !hasWeather)
    }
}
