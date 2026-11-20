// Affichage des mots de chinois : carte de fin de combat (un mot, « je connais ») et liste complète des options (tous les mots, audio, cases à cocher).
import { escapeHtml } from './escapeHtml.js';
import { LESSON_LOTS, LESSON_WORDS, lotTitle, knownWords, setKnown } from './chineseWords.js';
import { playNameAudio, canPlayNameAudio } from './nameAudio.js';

const KNOWN_NOTE = 'Noté : ce mot ne reviendra plus.';
const listenButton = (hanzi, cls) => {
    const online = canPlayNameAudio();
    return `<button type="button" class="${cls}" data-speak="${escapeHtml(hanzi)}"${online ? '' : ' disabled title="Écoute disponible en ligne seulement"'}>Écouter</button>`;
};

/** Corps de la section « Un mot de chinois » de l'écran de résultat. */
export function lessonBodyHtml(lesson) {
    const known = knownWords().has(lesson.hanzi);
    return `
        <div class="battle-result-lot">Lot ${lesson.lot + 1}/${lesson.lotCount} · ${lotTitle(lesson.lot)} · ${lesson.rank}/${lesson.rankCount}</div>
        <div class="battle-result-hanzi" lang="zh-Hans">${escapeHtml(lesson.hanzi)}</div>
        <div class="battle-result-pinyin">${escapeHtml(lesson.pinyin)}</div>
        <div class="battle-result-fr">${escapeHtml(lesson.fr)}</div>
        ${listenButton(lesson.hanzi, 'battle-result-listen')}
        <label class="battle-result-known"><input type="checkbox" data-known="${escapeHtml(lesson.hanzi)}"${known ? ' checked' : ''}> Je connais ce mot</label>
        <div class="battle-result-known-note" role="status" aria-live="polite"${known ? '' : ' hidden'}>${known ? KNOWN_NOTE : ''}</div>`;
}

/** Liste complète : un titre par lot, une ligne par mot (caractères, pinyin et traduction, écoute, case « je connais »). */
export function lessonsPanelHtml() {
    const known = knownWords();
    const count = LESSON_WORDS.filter(w => known.has(w.hanzi)).length;
    const lots = LESSON_LOTS.map((lot, i) => `
        <h4 class="zh-lot">Lot ${i + 1} · ${lotTitle(i)}</h4>
        ${lot.map(w => `<div class="zh-row">
            <span class="zh-han" lang="zh-Hans">${escapeHtml(w.hanzi)}</span>
            <span class="zh-txt"><b>${escapeHtml(w.pinyin)}</b> · ${escapeHtml(w.fr)}</span>
            ${listenButton(w.hanzi, 'zh-listen')}
            <label class="zh-known"><input type="checkbox" data-known="${escapeHtml(w.hanzi)}"${known.has(w.hanzi) ? ' checked' : ''}> connu</label>
        </div>`).join('')}`).join('');
    return `<p class="zh-summary"><span id="zh-count">${count}</span>/${LESSON_WORDS.length} mots connus. Un mot coché n'apparaît plus à la fin des combats ; décochez-le pour le revoir.</p>${lots}`;
}

/** Branche l'écoute et les cases « je connais » d'un conteneur (délégation : un seul écouteur). */
export function bindLessons(root) {
    root.addEventListener('click', ev => {
        const b = ev.target.closest?.('[data-speak]');
        if (b && root.contains(b)) playNameAudio(b.dataset.speak);
    });
    root.addEventListener('change', ev => {
        const box = ev.target.closest?.('input[data-known]');
        if (!box) return;
        setKnown(box.dataset.known, box.checked);
        // même mot affiché ailleurs (carte de résultat ou liste) : on garde les deux cases d'accord
        document.querySelectorAll(`input[data-known="${CSS.escape(box.dataset.known)}"]`).forEach(o => { o.checked = box.checked; });
        const note = box.closest('.battle-result-sec-zh')?.querySelector('.battle-result-known-note');   // carte de fin de combat : on confirme que c'est pris en compte
        if (note) { note.textContent = box.checked ? KNOWN_NOTE : ''; note.hidden = !box.checked; }
        const counter = document.getElementById('zh-count');
        if (counter) counter.textContent = String(knownWords().size);
    });
}
