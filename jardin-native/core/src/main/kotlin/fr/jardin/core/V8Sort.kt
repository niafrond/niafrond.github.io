package fr.jardin.core

/**
 * Tri de V8 (`Array.prototype.sort`, TimSort de `array-sort.tq`), reproduit appel de comparateur pour appel de comparateur.
 * Nécessaire quand le comparateur a des effets de bord (ex. tirage aléatoire dans le comparateur) : le résultat dépend alors de
 * l'ordre exact des comparaisons. `cmp(x, y)` suit la convention JS (négatif : x avant y). Trie en place.
 */
internal class V8Sort<T>(private val a: Array<Any?>, private val cmp: (T, T) -> Double) {
    private val runBase = ArrayList<Int>()
    private val runLen = ArrayList<Int>()
    private var minGallop = 7

    @Suppress("UNCHECKED_CAST")
    private fun cmpAt(x: Any?, y: Any?): Double = cmp(x as T, y as T)

    fun sort() {
        val length = a.size
        if (length < 2) return
        var low = 0
        var remaining = length
        val minRun = computeMinRun(remaining)
        while (remaining != 0) {
            var cur = countAndMakeRun(low, low + remaining)
            if (cur < minRun) {
                val forced = minOf(minRun, remaining)
                binaryInsertionSort(low, low + cur, low + forced)
                cur = forced
            }
            runBase.add(low); runLen.add(cur)
            mergeCollapse()
            low += cur
            remaining -= cur
        }
        mergeForceCollapse()
    }

    private fun computeMinRun(nArg: Int): Int {
        var n = nArg; var r = 0
        while (n >= 64) { r = r or (n and 1); n = n shr 1 }
        return n + r
    }

    private fun countAndMakeRun(lowArg: Int, high: Int): Int {
        val low = lowArg + 1
        if (low == high) return 1
        var runLength = 2
        val elementLow = a[low]
        val elementHigh = a[low - 1]
        var order = cmpAt(elementLow, elementHigh)
        val isDescending = order < 0
        var previous = elementLow
        var idx = low + 1
        while (idx < high) {
            val current = a[idx]
            order = cmpAt(current, previous)
            if (isDescending) { if (order >= 0) break } else { if (order < 0) break }
            previous = current
            runLength++
            idx++
        }
        if (isDescending) {
            var lo = lowArg; var hi = lowArg + runLength - 1
            while (lo < hi) { val t = a[lo]; a[lo] = a[hi]; a[hi] = t; lo++; hi-- }
        }
        return runLength
    }

    private fun binaryInsertionSort(low: Int, startArg: Int, high: Int) {
        var start = if (low == startArg) startArg + 1 else startArg
        while (start < high) {
            var left = low
            var right = start
            val pivot = a[right]
            while (left < right) {
                val mid = left + ((right - left) shr 1)
                val order = cmpAt(pivot, a[mid])
                if (order < 0) right = mid else left = mid + 1
            }
            var p = start
            while (p > left) { a[p] = a[p - 1]; p-- }
            a[left] = pivot
            start++
        }
    }

    private fun runInvariantEstablished(n: Int): Boolean {
        if (n < 2) return true
        return runLen[n - 2] > runLen[n - 1] + runLen[n]
    }

    private fun mergeCollapse() {
        while (runLen.size > 1) {
            var n = runLen.size - 2
            if (!runInvariantEstablished(n + 1) || !runInvariantEstablished(n)) {
                if (runLen[n - 1] < runLen[n + 1]) n--
                mergeAt(n)
            } else if (runLen[n] <= runLen[n + 1]) {
                mergeAt(n)
            } else break
        }
    }

    private fun mergeForceCollapse() {
        while (runLen.size > 1) {
            var n = runLen.size - 2
            if (n > 0 && runLen[n - 1] < runLen[n + 1]) n--
            mergeAt(n)
        }
    }

    private fun mergeAt(i: Int) {
        var baseA = runBase[i]; var lengthA = runLen[i]
        val baseB = runBase[i + 1]; var lengthB = runLen[i + 1]
        runLen[i] = lengthA + lengthB
        runBase.removeAt(i + 1); runLen.removeAt(i + 1)
        val k = gallopRight(a, a[baseB], baseA, lengthA, 0)
        baseA += k; lengthA -= k
        if (lengthA == 0) return
        lengthB = gallopLeft(a, a[baseA + lengthA - 1], baseB, lengthB, lengthB - 1)
        if (lengthB == 0) return
        if (lengthA <= lengthB) mergeLow(baseA, lengthA, baseB, lengthB) else mergeHigh(baseA, lengthA, baseB, lengthB)
    }

    private fun gallopLeft(arr: Array<Any?>, key: Any?, base: Int, length: Int, hint: Int): Int {
        var lastOfs = 0
        var offset = 1
        var order = cmpAt(arr[base + hint], key)
        if (order < 0) {
            val maxOfs = length - hint
            while (offset < maxOfs) {
                order = cmpAt(arr[base + hint + offset], key)
                if (order >= 0) break
                lastOfs = offset
                offset = (offset shl 1) + 1
                if (offset <= 0) offset = maxOfs
            }
            if (offset > maxOfs) offset = maxOfs
            lastOfs += hint
            offset += hint
        } else {
            val maxOfs = hint + 1
            while (offset < maxOfs) {
                order = cmpAt(arr[base + hint - offset], key)
                if (order < 0) break
                lastOfs = offset
                offset = (offset shl 1) + 1
                if (offset <= 0) offset = maxOfs
            }
            if (offset > maxOfs) offset = maxOfs
            val tmp = lastOfs
            lastOfs = hint - offset
            offset = hint - tmp
        }
        lastOfs++
        while (lastOfs < offset) {
            val m = lastOfs + ((offset - lastOfs) shr 1)
            order = cmpAt(arr[base + m], key)
            if (order < 0) lastOfs = m + 1 else offset = m
        }
        return offset
    }

    private fun gallopRight(arr: Array<Any?>, key: Any?, base: Int, length: Int, hint: Int): Int {
        var lastOfs = 0
        var offset = 1
        var order = cmpAt(key, arr[base + hint])
        if (order < 0) {
            val maxOfs = hint + 1
            while (offset < maxOfs) {
                order = cmpAt(key, arr[base + hint - offset])
                if (order >= 0) break
                lastOfs = offset
                offset = (offset shl 1) + 1
                if (offset <= 0) offset = maxOfs
            }
            if (offset > maxOfs) offset = maxOfs
            val tmp = lastOfs
            lastOfs = hint - offset
            offset = hint - tmp
        } else {
            val maxOfs = length - hint
            while (offset < maxOfs) {
                order = cmpAt(key, arr[base + hint + offset])
                if (order < 0) break
                lastOfs = offset
                offset = (offset shl 1) + 1
                if (offset <= 0) offset = maxOfs
            }
            if (offset > maxOfs) offset = maxOfs
            lastOfs += hint
            offset += hint
        }
        lastOfs++
        while (lastOfs < offset) {
            val m = lastOfs + ((offset - lastOfs) shr 1)
            order = cmpAt(key, arr[base + m])
            if (order < 0) offset = m else lastOfs = m + 1
        }
        return offset
    }

    private fun mergeLow(baseA: Int, lengthAArg: Int, baseB: Int, lengthBArg: Int) {
        var lengthA = lengthAArg; var lengthB = lengthBArg
        val temp = arrayOfNulls<Any?>(lengthA)
        System.arraycopy(a, baseA, temp, 0, lengthA)
        var dest = baseA
        var cursorTemp = 0
        var cursorB = baseB
        a[dest++] = a[cursorB++]
        var copyB = false
        run done@{
            if (--lengthB == 0) return@done
            if (lengthA == 1) { copyB = true; return@done }
            var mg = minGallop
            while (true) {
                var winsA = 0
                var winsB = 0
                while (true) {
                    val order = cmpAt(a[cursorB], temp[cursorTemp])
                    if (order < 0) {
                        a[dest++] = a[cursorB++]
                        winsB++; lengthB--; winsA = 0
                        if (lengthB == 0) return@done
                        if (winsB >= mg) break
                    } else {
                        a[dest++] = temp[cursorTemp++]
                        winsA++; lengthA--; winsB = 0
                        if (lengthA == 1) { copyB = true; return@done }
                        if (winsA >= mg) break
                    }
                }
                mg++
                var first = true
                while (winsA >= 7 || winsB >= 7 || first) {
                    first = false
                    mg = maxOf(1, mg - 1)
                    minGallop = mg
                    winsA = gallopRight(temp, a[cursorB], cursorTemp, lengthA, 0)
                    if (winsA > 0) {
                        System.arraycopy(temp, cursorTemp, a, dest, winsA)
                        dest += winsA; cursorTemp += winsA; lengthA -= winsA
                        if (lengthA == 1) { copyB = true; return@done }
                        if (lengthA == 0) return@done
                    }
                    a[dest++] = a[cursorB++]
                    if (--lengthB == 0) return@done
                    winsB = gallopLeft(a, temp[cursorTemp], cursorB, lengthB, 0)
                    if (winsB > 0) {
                        System.arraycopy(a, cursorB, a, dest, winsB)
                        dest += winsB; cursorB += winsB; lengthB -= winsB
                        if (lengthB == 0) return@done
                    }
                    a[dest++] = temp[cursorTemp++]
                    if (--lengthA == 1) { copyB = true; return@done }
                }
                mg++
                minGallop = mg
            }
        }
        if (copyB) {
            System.arraycopy(a, cursorB, a, dest, lengthB)
            a[dest + lengthB] = temp[cursorTemp]
        } else if (lengthA > 0) {
            System.arraycopy(temp, cursorTemp, a, dest, lengthA)
        }
    }

    private fun mergeHigh(baseA: Int, lengthAArg: Int, baseB: Int, lengthBArg: Int) {
        var lengthA = lengthAArg; var lengthB = lengthBArg
        val temp = arrayOfNulls<Any?>(lengthB)
        System.arraycopy(a, baseB, temp, 0, lengthB)
        var dest = baseB + lengthB - 1
        var cursorTemp = lengthB - 1
        var cursorA = baseA + lengthA - 1
        a[dest--] = a[cursorA--]
        var copyA = false
        run done@{
            if (--lengthA == 0) return@done
            if (lengthB == 1) { copyA = true; return@done }
            var mg = minGallop
            while (true) {
                var winsA = 0
                var winsB = 0
                while (true) {
                    val order = cmpAt(temp[cursorTemp], a[cursorA])
                    if (order < 0) {
                        a[dest--] = a[cursorA--]
                        winsA++; lengthA--; winsB = 0
                        if (lengthA == 0) return@done
                        if (winsA >= mg) break
                    } else {
                        a[dest--] = temp[cursorTemp--]
                        winsB++; lengthB--; winsA = 0
                        if (lengthB == 1) { copyA = true; return@done }
                        if (winsB >= mg) break
                    }
                }
                mg++
                var first = true
                while (winsA >= 7 || winsB >= 7 || first) {
                    first = false
                    mg = maxOf(1, mg - 1)
                    minGallop = mg
                    var k = gallopRight(a, temp[cursorTemp], baseA, lengthA, lengthA - 1)
                    winsA = lengthA - k
                    if (winsA > 0) {
                        dest -= winsA; cursorA -= winsA
                        System.arraycopy(a, cursorA + 1, a, dest + 1, winsA)
                        lengthA -= winsA
                        if (lengthA == 0) return@done
                    }
                    a[dest--] = temp[cursorTemp--]
                    if (--lengthB == 1) { copyA = true; return@done }
                    k = gallopLeft(temp, a[cursorA], 0, lengthB, lengthB - 1)
                    winsB = lengthB - k
                    if (winsB > 0) {
                        dest -= winsB; cursorTemp -= winsB
                        System.arraycopy(temp, cursorTemp + 1, a, dest + 1, winsB)
                        lengthB -= winsB
                        if (lengthB == 1) { copyA = true; return@done }
                        if (lengthB == 0) return@done
                    }
                    a[dest--] = a[cursorA--]
                    if (--lengthA == 0) return@done
                }
                mg++
                minGallop = mg
            }
        }
        if (copyA) {
            dest -= lengthA; cursorA -= lengthA
            System.arraycopy(a, cursorA + 1, a, dest + 1, lengthA)
            a[dest] = temp[cursorTemp]
        } else if (lengthB > 0) {
            System.arraycopy(temp, 0, a, dest - (lengthB - 1), lengthB)
        }
    }

    companion object {
        /** Trie `list` en place comme `list.sort(cmp)` du JS (V8). */
        fun <T> sort(list: MutableList<T>, cmp: (T, T) -> Double) {
            val arr = arrayOfNulls<Any?>(list.size)
            for (i in list.indices) arr[i] = list[i]
            V8Sort(arr, cmp).sort()
            for (i in list.indices) @Suppress("UNCHECKED_CAST") (list.set(i, arr[i] as T))
        }
    }
}
