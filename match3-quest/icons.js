// Icônes SVG de l'interface (le jeu n'utilise aucun emoji) : petites pictos en ligne, viewBox 16x16, contour
// #2b1b17 comme les sprites. icon(nom) retourne une balise <svg> à insérer dans du HTML (classe « ic »,
// taille 1em par défaut, alignée sur le texte). Les noms inconnus donnent une chaîne vide.

const K = '#2b1b17';
const S = `stroke="${K}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"`;

export const MANA_HEX = { red: '#e8452e', blue: '#3a7ad8', green: '#4fa34a', yellow: '#f2c14e', purple: '#9a5ac8' };

const orb = c => `<circle cx="8" cy="8" r="6" fill="${c}" ${S}/><circle cx="6" cy="6" r="1.8" fill="#fff" opacity=".55"/>`;

const PATHS = {
    // Combat et ressources
    skull: `<path d="M3 7.4 Q3 2 8 2 Q13 2 13 7.4 Q13 10 11 10.6 L11 13.4 L5 13.4 L5 10.6 Q3 10 3 7.4Z" fill="#f4ecd8" ${S}/><circle cx="6" cy="7.4" r="1.4" fill="${K}"/><circle cx="10" cy="7.4" r="1.4" fill="${K}"/><path d="M7 13.4 L7 11.8 M9 13.4 L9 11.8" fill="none" ${S}/>`,
    arrow: `<path d="M2.6 13.4 L12 4" fill="none" stroke="${K}" stroke-width="2.6" stroke-linecap="round"/><path d="M2.6 13.4 L12 4" fill="none" stroke="#c9a448" stroke-width="1.2" stroke-linecap="round"/><path d="M13.8 2.2 L9.6 3.6 L12.4 6.4Z" fill="#cfd6de" ${S}/><path d="M2 11 L4.2 11.8 L5 14 M3.6 9.6 L5.6 10.4 L6.4 12.4" fill="none" stroke="#d9452e" stroke-width="1.2"/>`,
    coin: `<circle cx="8" cy="8" r="6" fill="#f2c14e" ${S}/><rect x="6.4" y="6.4" width="3.2" height="3.2" fill="#b8862a" ${S}/>`,
    heart: `<path d="M8 13.6 Q2 9.6 2 5.8 Q2 2.8 5 2.8 Q7 2.8 8 4.8 Q9 2.8 11 2.8 Q14 2.8 14 5.8 Q14 9.6 8 13.6Z" fill="#e8452e" ${S}/><circle cx="5.2" cy="5.6" r="1.1" fill="#fff" opacity=".6"/>`,
    star: `<path d="M8 1.6 L9.9 5.8 L14.4 6.2 L11 9.2 L12 13.8 L8 11.4 L4 13.8 L5 9.2 L1.6 6.2 L6.1 5.8Z" fill="#f2c14e" ${S}/>`,
    spark: `<path d="M8 1.4 L9.3 6.7 L14.6 8 L9.3 9.3 L8 14.6 L6.7 9.3 L1.4 8 L6.7 6.7Z" fill="#fbe08a" ${S}/>`,
    shield: `<path d="M8 1.8 L13.4 3.8 Q13.4 10.4 8 14.2 Q2.6 10.4 2.6 3.8Z" fill="#7aa0c8" ${S}/><path d="M8 3.6 L8 12.4" fill="none" stroke="#dbe8f4" stroke-width="1.2"/>`,
    sword: `<path d="M12.8 2.2 L13.8 3.2 L6.6 10.4 L5.6 9.4Z" fill="#cfd6de" ${S}/><path d="M3.6 9.2 L6.8 12.4 M2.4 13.6 L5 11" fill="none" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/>`,
    axe: `<path d="M4 14 L10.6 3.6" fill="none" stroke="#8a5a33" stroke-width="2" stroke-linecap="round"/><path d="M8.6 2 Q14.6 2.4 13.6 8.4 Q11.6 5.8 8.2 6.4Z" fill="#cfd6de" ${S}/>`,
    dagger: `<path d="M11.6 2 L13.6 4 L8.2 9.4 L6.6 7.8Z" fill="#cfd6de" ${S}/><path d="M5 7.2 L8.8 11 M6.8 9.2 L3.2 12.8" fill="none" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/>`,
    mace: `<path d="M3.4 13.6 L8.4 8.6" fill="none" stroke="#8a5a33" stroke-width="2" stroke-linecap="round"/><circle cx="10.4" cy="5.6" r="3.4" fill="#8a8f99" ${S}/><path d="M10.4 1 L10.4 2.2 M15 5.6 L13.8 5.6 M13.6 2.4 L12.8 3.2" fill="none" ${S}/>`,
    bow: `<path d="M4 2 Q14 4 12 14" fill="none" stroke="#8a5a33" stroke-width="2" stroke-linecap="round"/><path d="M4 2 L12 14" fill="none" stroke="#f4ecd8" stroke-width="1"/><path d="M2.4 10.8 L11 5.2" fill="none" ${S}/>`,
    staff: `<path d="M4 14.4 L10.4 4.8" fill="none" stroke="#8a5a33" stroke-width="2" stroke-linecap="round"/><circle cx="11.2" cy="3.8" r="2.4" fill="#7fc8e0" ${S}/>`,
    fire: `<path d="M8 1.6 Q10 4.6 11.6 5 Q13.6 8 12.6 10.8 Q11.4 14.2 8 14.2 Q4.6 14.2 3.4 10.8 Q2.6 7.8 4.8 5.6 Q5.4 7.4 6.4 7 Q6 4 8 1.6Z" fill="#f2702e" ${S}/><path d="M8 7.4 Q10.2 9.6 9.8 11.6 Q9.2 13 8 13 Q6.8 13 6.2 11.6 Q6 9.6 8 7.4Z" fill="#fbe08a"/>`,
    leaf: `<path d="M2.6 13.4 Q2 4 13.4 2.6 Q13.6 13 2.6 13.4Z" fill="#6ab04c" ${S}/><path d="M2.6 13.4 L10 6" fill="none" stroke="#dff0c8" stroke-width="1"/>`,
    bolt: `<path d="M9.6 1.4 L3.4 9 L7.4 9 L6.2 14.6 L12.6 6.6 L8.6 6.6Z" fill="#f2c14e" ${S}/>`,
    scales: `<path d="M8 2.4 L8 13 M4 13.4 L12 13.4 M2.6 4.4 L13.4 4.4" fill="none" ${S}/><path d="M1.6 9 L3.6 4.8 L5.6 9Z M10.4 9 L12.4 4.8 L14.4 9Z" fill="#f2c14e" ${S}/>`,
    gift: `<rect x="2.4" y="6.4" width="11.2" height="7.6" rx="1" fill="#e8452e" ${S}/><rect x="1.8" y="4.4" width="12.4" height="2.8" rx="1" fill="#e8452e" ${S}/><path d="M8 4.4 L8 14 M8 4.4 Q4.6 1 4.4 3.4 Q4.6 4.4 8 4.4 Q11.4 4.4 11.6 3.4 Q11.4 1 8 4.4" fill="none" stroke="#f2c14e" stroke-width="1.4"/>`,
    trophy: `<path d="M4.4 2.4 L11.6 2.4 L11.2 7 Q10.6 9.6 8 9.8 Q5.4 9.6 4.8 7Z" fill="#f2c14e" ${S}/><path d="M4.6 3.6 Q1.8 3.6 2.4 6 Q3 7.4 5 7.4 M11.4 3.6 Q14.2 3.6 13.6 6 Q13 7.4 11 7.4" fill="none" ${S}/><path d="M6.6 13.6 L9.4 13.6 L8.8 9.8 L7.2 9.8Z" fill="#c9963a" ${S}/><rect x="5" y="13" width="6" height="1.6" rx=".6" fill="#8a5a33" ${S}/>`,
    crown: `<path d="M2 12.6 L2.6 4.8 L5.6 8 L8 3 L10.4 8 L13.4 4.8 L14 12.6Z" fill="#f2c14e" ${S}/><circle cx="8" cy="9.8" r="1.1" fill="#e8452e"/>`,
    target: `<circle cx="8" cy="8" r="6" fill="#fbf1d8" ${S}/><circle cx="8" cy="8" r="3.6" fill="#e8452e" ${S}/><circle cx="8" cy="8" r="1.2" fill="#fbf1d8"/>`,
    potion: `<path d="M6.2 2 L9.8 2 L9.8 5.4 Q13.2 7 13 10.4 Q12.6 14 8 14 Q3.4 14 3 10.4 Q2.8 7 6.2 5.4Z" fill="#4fa34a" ${S}/><path d="M4.2 9.6 Q8 11 11.8 9.6" fill="none" stroke="#dff0c8" stroke-width="1"/>`,
    bag: `<path d="M3 6.4 Q3 4.4 5 4.4 L11 4.4 Q13 4.4 13 6.4 L13.4 12.6 Q13.4 14 12 14 L4 14 Q2.6 14 2.6 12.6Z" fill="#b8742a" ${S}/><path d="M5.6 4.4 Q5.6 1.6 8 1.6 Q10.4 1.6 10.4 4.4" fill="none" ${S}/><rect x="6.4" y="7.2" width="3.2" height="2.4" rx=".6" fill="#f2c14e" ${S}/>`,
    box: `<path d="M2.4 5.4 L8 2.6 L13.6 5.4 L13.6 11.6 L8 14.4 L2.4 11.6Z" fill="#c9a06a" ${S}/><path d="M2.4 5.4 L8 8.2 L13.6 5.4 M8 8.2 L8 14.4" fill="none" ${S}/>`,
    cart: `<path d="M1.4 2.6 L3.6 2.6 L5.2 10 L12.4 10 L14 4.6 L4.2 4.6" fill="#f2c14e" ${S}/><circle cx="5.8" cy="12.8" r="1.3" fill="${K}"/><circle cx="11.4" cy="12.8" r="1.3" fill="${K}"/>`,
    chart: `<path d="M2 14 L14 14" fill="none" ${S}/><rect x="3" y="8" width="2.6" height="5.4" fill="#e8452e" ${S}/><rect x="6.8" y="4.6" width="2.6" height="8.8" fill="#4fa34a" ${S}/><rect x="10.6" y="2" width="2.6" height="11.4" fill="#3a7ad8" ${S}/>`,
    gear: `<path d="M7 1.4 L9 1.4 L9.4 3.2 L11 3.9 L12.6 2.9 L14 4.3 L13 5.9 L13.7 7.5 L15.4 7.9 L15.4 9.9 L13.7 10.3 L13 11.9 L14 13.5 L12.6 14.9 L11 13.9 L9.4 14.6 L9 16 L7 16 L6.6 14.6 L5 13.9 L3.4 14.9 L2 13.5 L3 11.9 L2.3 10.3 L.6 9.9 L.6 7.9 L2.3 7.5 L3 5.9 L2 4.3 L3.4 2.9 L5 3.9 L6.6 3.2Z" transform="translate(0 -.6) scale(1 .96)" fill="#a8b0bc" ${S}/><circle cx="8" cy="8.2" r="2.4" fill="#fbf1d8" ${S}/>`,
    scroll: `<rect x="3" y="3" width="10" height="10" rx="1" fill="#f4ecd8" ${S}/><rect x="1.8" y="2" width="12.4" height="2.4" rx="1.2" fill="#a8683a" ${S}/><rect x="1.8" y="11.6" width="12.4" height="2.4" rx="1.2" fill="#a8683a" ${S}/><path d="M5 6.6 L11 6.6 M5 9 L9.6 9" fill="none" stroke="#8a7a60" stroke-width="1"/>`,
    book: `<path d="M8 3.4 Q5 1.8 1.8 3 L1.8 13 Q5 11.8 8 13.4 Q11 11.8 14.2 13 L14.2 3 Q11 1.8 8 3.4Z" fill="#f4ecd8" ${S}/><path d="M8 3.4 L8 13.4" fill="none" ${S}/><path d="M3.6 5.6 Q5.4 5 6.6 5.8 M9.4 5.8 Q10.6 5 12.4 5.6" fill="none" stroke="#8a7a60" stroke-width="1"/>`,
    map: `<path d="M1.6 3.4 L5.6 2 L10.4 3.6 L14.4 2.2 L14.4 12.6 L10.4 14 L5.6 12.4 L1.6 13.8Z" fill="#f4e2b0" ${S}/><path d="M5.6 2 L5.6 12.4 M10.4 3.6 L10.4 14" fill="none" stroke="${K}" stroke-width="1"/><path d="M3 9 Q6 6 8 8 Q10 10 12.6 6.6" fill="none" stroke="#d9452e" stroke-width="1.2" stroke-dasharray="1.6 1.2"/>`,
    pin: `<path d="M8 14.6 Q3 9 3 6.2 Q3 1.6 8 1.6 Q13 1.6 13 6.2 Q13 9 8 14.6Z" fill="#e8452e" ${S}/><circle cx="8" cy="6.2" r="2" fill="#fbf1d8" ${S}/>`,
    home: `<path d="M1.6 8 L8 2.2 L14.4 8" fill="#c45a4a" ${S}/><path d="M3.4 7 L3.4 14 L12.6 14 L12.6 7" fill="#f4e2b0" ${S}/><rect x="6.6" y="9.6" width="2.8" height="4.4" fill="#8a5a33" ${S}/>`,
    village: `<path d="M.8 9 L5 5 L9.2 9" fill="#c45a4a" ${S}/><path d="M2 8.4 L2 14 L8 14 L8 8.4" fill="#f4e2b0" ${S}/><path d="M7.4 6.6 L11.2 3 L15.2 6.6" fill="#2f6f73" ${S}/><path d="M8.6 6.4 L8.6 14 L14 14 L14 6.4" fill="#f4e2b0" ${S}/><rect x="10.4" y="10" width="2" height="4" fill="#8a5a33"/>`,
    stone: `<ellipse cx="8" cy="12.8" rx="5.6" ry="1.8" fill="#8a8f99" ${S}/><path d="M4.4 12.6 Q3.6 4 8 2 Q12.4 4 11.6 12.6Z" fill="#a8b0bc" ${S}/><path d="M8 5.4 Q10.2 6.2 9.4 8.6 Q8.4 10.2 6.8 9.2 Q6 8 7.4 7.4" fill="none" stroke="#3a9ad8" stroke-width="1.3"/>`,
    lock: `<rect x="3" y="7" width="10" height="7.4" rx="1.4" fill="#f2c14e" ${S}/><path d="M5 7 L5 5 Q5 2 8 2 Q11 2 11 5 L11 7" fill="none" ${S}/><circle cx="8" cy="10.4" r="1.2" fill="${K}"/>`,
    door: `<path d="M3.4 14.4 L3.4 3 Q3.4 1.6 4.8 1.6 L11.2 1.6 Q12.6 1.6 12.6 3 L12.6 14.4Z" fill="#a8683a" ${S}/><circle cx="10.2" cy="8.4" r=".9" fill="#f2c14e"/><path d="M2 14.4 L14 14.4" fill="none" ${S}/>`,
    puzzle: `<path d="M2.4 4.4 L6 4.4 Q5.4 1.6 7.6 1.6 Q9.8 1.6 9.2 4.4 L12.6 4.4 L12.6 7.6 Q15 7 15 9.2 Q15 11.4 12.6 10.8 L12.6 14 L2.4 14Z" fill="#9a5ac8" ${S}/>`,
    talk: `<path d="M2 3.4 Q2 2 3.4 2 L12.6 2 Q14 2 14 3.4 L14 9.6 Q14 11 12.6 11 L6.6 11 L3.6 14 L4 11 L3.4 11 Q2 11 2 9.6Z" fill="#fbf1d8" ${S}/><circle cx="5.4" cy="6.6" r=".9" fill="${K}"/><circle cx="8" cy="6.6" r=".9" fill="${K}"/><circle cx="10.6" cy="6.6" r=".9" fill="${K}"/>`,
    flag: `<path d="M3.4 14.6 L3.4 1.8" fill="none" ${S}/><path d="M3.4 2.4 L13.2 2.4 L11 5.4 L13.2 8.4 L3.4 8.4Z" fill="#fbf1d8" ${S}/>`,
    check: `<path d="M2.4 8.4 L6.2 12.2 L13.6 3.8" fill="none" stroke="#4fa34a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    cross: `<path d="M3.4 3.4 L12.6 12.6 M12.6 3.4 L3.4 12.6" fill="none" stroke="#d9452e" stroke-width="2.4" stroke-linecap="round"/>`,
    warning: `<path d="M8 1.8 L14.8 13.8 L1.2 13.8Z" fill="#f2c14e" ${S}/><path d="M8 6 L8 9.6" fill="none" stroke="${K}" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.8" r=".9" fill="${K}"/>`,
    moon: `<path d="M10.6 1.8 A6.4 6.4 0 1 0 14.2 11 A5 5 0 1 1 10.6 1.8Z" fill="#f6e7a8" ${S}/>`,
    sun: `<circle cx="8" cy="8" r="3.6" fill="#f2a03a" ${S}/><path d="M8 1 L8 2.8 M8 13.2 L8 15 M1 8 L2.8 8 M13.2 8 L15 8 M3 3 L4.3 4.3 M11.7 11.7 L13 13 M13 3 L11.7 4.3 M4.3 11.7 L3 13" fill="none" stroke="#f2a03a" stroke-width="1.6" stroke-linecap="round"/>`,
    leafWild: `<path d="M8 14.6 L8 7 M8 9.4 Q3 9 2.4 3.6 Q7.6 4 8 9.4 M8 7.6 Q13 7.2 13.6 1.8 Q8.4 2.2 8 7.6" fill="#6ab04c" ${S}/>`,
    soundOn: `<path d="M2 6 L5 6 L8.6 2.8 L8.6 13.2 L5 10 L2 10Z" fill="#a8b0bc" ${S}/><path d="M10.6 5.4 Q12 8 10.6 10.6 M12.4 3.6 Q15 8 12.4 12.4" fill="none" ${S}/>`,
    soundOff: `<path d="M2 6 L5 6 L8.6 2.8 L8.6 13.2 L5 10 L2 10Z" fill="#a8b0bc" ${S}/><path d="M10.4 5.6 L14.4 10.4 M14.4 5.6 L10.4 10.4" fill="none" stroke="#d9452e" stroke-width="1.6" stroke-linecap="round"/>`,
    music: `<path d="M5.4 12 L5.4 3.4 L13 1.8 L13 10.4" fill="none" ${S}/><ellipse cx="4" cy="12.2" rx="2.2" ry="1.7" fill="${K}"/><ellipse cx="11.6" cy="10.6" rx="2.2" ry="1.7" fill="${K}"/>`,
    pause: `<rect x="3.6" y="2.6" width="3" height="10.8" rx=".8" fill="#a8b0bc" ${S}/><rect x="9.4" y="2.6" width="3" height="10.8" rx=".8" fill="#a8b0bc" ${S}/>`,
    play: `<path d="M4 2.4 L13.4 8 L4 13.6Z" fill="#4fa34a" ${S}/>`,
    trash: `<path d="M3.4 4.6 L12.6 4.6 L11.6 14.2 L4.4 14.2Z" fill="#a8b0bc" ${S}/><path d="M2.2 4.4 L13.8 4.4 M6 4.4 L6.6 2 L9.4 2 L10 4.4 M6.6 6.8 L6.8 12 M9.4 6.8 L9.2 12" fill="none" ${S}/>`,
    whiteFlag: `<path d="M3.4 14.6 L3.4 1.8" fill="none" ${S}/><path d="M3.4 2.4 Q6 1.2 8.4 2.6 Q10.8 4 13.4 2.6 L13.4 8.6 Q10.8 10 8.4 8.6 Q6 7.2 3.4 8.4Z" fill="#fff" ${S}/>`,
    refresh: `<path d="M13 6.4 A5.4 5.4 0 1 0 13.2 10" fill="none" stroke="${K}" stroke-width="1.6" stroke-linecap="round"/><path d="M13.6 2.6 L13.4 6.8 L9.4 6" fill="none" stroke="${K}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    eye: `<path d="M1.4 8 Q8 1.6 14.6 8 Q8 14.4 1.4 8Z" fill="#fbf1d8" ${S}/><circle cx="8" cy="8" r="2.6" fill="#3a7ad8" ${S}/>`,
    brain: `<path d="M8 3 Q6 1.6 4.2 2.8 Q2 3.2 2.2 5.6 Q1 7.4 2.6 9.2 Q2.6 11.8 5 12 Q6.4 13.8 8 12.6 Q9.6 13.8 11 12 Q13.4 11.8 13.4 9.2 Q15 7.4 13.8 5.6 Q14 3.2 11.8 2.8 Q10 1.6 8 3Z" fill="#f6b8c4" ${S}/><path d="M8 3 L8 12.6 M5 5.6 Q6.4 6.4 5.4 8 M11 5.6 Q9.6 6.4 10.6 8" fill="none" stroke="${K}" stroke-width="1"/>`,
    muscle: `<path d="M3 13.6 Q2 9 4 6 Q5 3 7.4 2.6 Q9 3 8.4 4.6 L6.8 5.2 Q6.6 7.4 8.4 8.2 Q11 6.6 13.4 8.4 Q14.4 11.4 12 13.6Z" fill="#f2c59e" ${S}/>`,
    runner: `<circle cx="9.6" cy="2.8" r="1.6" fill="${K}"/><path d="M4.4 6.4 L7.6 4.8 L10.4 7.4 L12.6 7.2 M7.6 4.8 L6.4 9.2 L9 11 L8 14.4 M6.4 9.2 L3.6 13" fill="none" stroke="${K}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    mask: `<path d="M2 4 Q8 2 14 4 Q14 11 8 14 Q2 11 2 4Z" fill="#fbf1d8" ${S}/><path d="M4.2 6.6 Q5.6 5.6 7 6.6 M9 6.6 Q10.4 5.6 11.8 6.6 M5.6 10 Q8 11.8 10.4 10" fill="none" stroke="${K}" stroke-width="1.2"/>`,
    idCard: `<rect x="1.6" y="3.4" width="12.8" height="9.2" rx="1.2" fill="#dbe8f4" ${S}/><circle cx="5.2" cy="7.4" r="1.6" fill="#a8683a"/><path d="M3 11 Q5.2 8.8 7.4 11 M8.6 6.4 L12.6 6.4 M8.6 8.6 L12 8.6" fill="none" stroke="${K}" stroke-width="1"/>`,
    yinyang: `<circle cx="8" cy="8" r="6.2" fill="#fff" ${S}/><path d="M8 1.8 A6.2 6.2 0 0 1 8 14.2 A3.1 3.1 0 0 1 8 8 A3.1 3.1 0 0 0 8 1.8Z" fill="${K}"/><circle cx="8" cy="4.9" r="1" fill="#fff"/><circle cx="8" cy="11.1" r="1" fill="${K}"/>`,
    robot: `<rect x="3" y="4.6" width="10" height="8.4" rx="2" fill="#a8b0bc" ${S}/><circle cx="6" cy="8.4" r="1.2" fill="#3a7ad8"/><circle cx="10" cy="8.4" r="1.2" fill="#3a7ad8"/><path d="M8 4.6 L8 2 M6 11 L10 11" fill="none" ${S}/>`,
    dice: `<rect x="2.4" y="2.4" width="11.2" height="11.2" rx="2" fill="#fff" ${S}/><circle cx="5.4" cy="5.4" r="1" fill="${K}"/><circle cx="8" cy="8" r="1" fill="${K}"/><circle cx="10.6" cy="10.6" r="1" fill="${K}"/>`,
    hourglass: `<path d="M3.4 1.8 L12.6 1.8 M3.4 14.2 L12.6 14.2 M4.4 1.8 Q4.4 6 8 8 Q4.4 10 4.4 14.2 L11.6 14.2 Q11.6 10 8 8 Q11.6 6 11.6 1.8Z" fill="#f4e2b0" ${S}/><path d="M6 13 Q8 10.4 10 13Z" fill="#c9a448"/>`,
    poison: `<circle cx="8" cy="9.4" r="5" fill="#7aba4a" ${S}/><path d="M6.4 1.8 L9.6 1.8 L9.6 4.4 L6.4 4.4Z" fill="#a8b0bc" ${S}/><circle cx="6.4" cy="9" r="1" fill="${K}"/><circle cx="9.6" cy="9" r="1" fill="${K}"/>`,
    blood: `<path d="M8 1.8 Q13 8 13 10.2 Q13 14.2 8 14.2 Q3 14.2 3 10.2 Q3 8 8 1.8Z" fill="#c42a2a" ${S}/><circle cx="6.2" cy="10.4" r="1.1" fill="#fff" opacity=".55"/>`,
    snow: `<path d="M8 1.6 L8 14.4 M2.4 4.8 L13.6 11.2 M13.6 4.8 L2.4 11.2" fill="none" stroke="#7fc8e0" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="8" r="1.6" fill="#dbf0fa" ${S}/>`,
    swirl: `<circle cx="8" cy="8" r="6.4" fill="#cfe6f6" ${S}/><path d="M8 8 Q8 6 10 6.4 Q12 7.6 11 10 Q9.4 12.4 6.4 11.4 Q3.6 10 4 7 Q4.8 3.6 8.4 3.4" fill="none" stroke="#3a7ad8" stroke-width="1.3" stroke-linecap="round"/>`,
    mirror: `<ellipse cx="8" cy="6.6" rx="4.6" ry="5" fill="#c9a448" ${S}/><ellipse cx="8" cy="6.6" rx="3" ry="3.4" fill="#e8f0f6"/><path d="M8 11.6 L8 14.6 M5.6 14.6 L10.4 14.6" fill="none" ${S}/>`,
    sandal: `<path d="M3 13 Q2 9 4 5 Q6 1.6 9 2.4 Q11.4 3.4 11 6.4 L13.4 11 Q14 13.6 11.6 13.8Z" fill="#b8742a" ${S}/><path d="M5 6 L9.6 7.4 M4.4 9 L11.4 10" fill="none" stroke="#f4e2b0" stroke-width="1.2"/>`,
    dizzy: `<path d="M8 8 Q8 6.4 9.6 6.8 Q11 7.6 10.2 9.4 Q9 11 6.6 10.4 Q4.4 9.2 4.8 6.8 Q5.6 4 8.6 4 Q12.4 4.4 12.6 8" fill="none" stroke="#9a5ac8" stroke-width="1.5" stroke-linecap="round"/>`,
    chest: `<path d="M2 7 Q2 3 8 3 Q14 3 14 7Z" fill="#a8683a" ${S}/><rect x="2" y="7" width="12" height="6.6" rx=".8" fill="#c9883a" ${S}/><rect x="6.8" y="6" width="2.4" height="3" rx=".5" fill="#f2c14e" ${S}/>`,
    rock: `<path d="M1.8 13.4 L3.4 7 L7 3.4 L11.6 4.4 L14.4 9.4 L13.4 13.4Z" fill="#a8a8a2" ${S}/><path d="M7 3.4 L8 8 L14.4 9.4 M8 8 L3.4 13.4" fill="none" stroke="${K}" stroke-width="1"/>`,
    anger: `<path d="M2.4 6.4 Q6 6 6.4 2.4 M13.6 6.4 Q10 6 9.6 2.4 M2.4 9.6 Q6 10 6.4 13.6 M13.6 9.6 Q10 10 9.6 13.6" fill="none" stroke="#d9302e" stroke-width="2" stroke-linecap="round"/>`,
    web: `<path d="M8 1.4 L8 14.6 M1.4 8 L14.6 8 M3.3 3.3 L12.7 12.7 M12.7 3.3 L3.3 12.7" fill="none" stroke="${K}" stroke-width="1"/><path d="M8 4 L10.8 5.2 L12 8 L10.8 10.8 L8 12 L5.2 10.8 L4 8 L5.2 5.2Z M8 6.2 L9.3 6.7 L9.8 8 L9.3 9.3 L8 9.8 L6.7 9.3 L6.2 8 L6.7 6.7Z" fill="none" stroke="${K}" stroke-width="1"/>`,
    wind: `<path d="M1.6 5.6 L10 5.6 Q12.6 5.6 12.6 3.6 Q12.4 1.8 10.6 2.2 M1.6 8.4 L13 8.4 Q15 8.4 14.8 10.4 Q14.4 12 12.6 11.4 M3 11.2 L8.4 11.2" fill="none" stroke="#7fa8c8" stroke-width="1.6" stroke-linecap="round"/>`,
    ghost: `<path d="M3 14 L3 7 Q3 2 8 2 Q13 2 13 7 L13 14 L11.4 12.6 L9.8 14 L8 12.6 L6.2 14 L4.6 12.6Z" fill="#e6f0f8" ${S}/><circle cx="6.2" cy="7" r="1" fill="${K}"/><circle cx="9.8" cy="7" r="1" fill="${K}"/>`,
    mana: orb('#9a5ac8'),
    up: `<path d="M8 2 L13.4 8 L10 8 L10 14 L6 14 L6 8 L2.6 8Z" fill="#4fa34a" ${S}/>`
};
Object.entries(MANA_HEX).forEach(([color, hex]) => { PATHS[`mana_${color}`] = orb(hex); });
PATHS.mana_white = orb('#f4f2ea');

export const ICON_NAMES = Object.keys(PATHS);

// <svg> en ligne. `cls` ajoute des classes (ex. « ic-big »).
export function icon(name, cls = '') {
    const body = PATHS[name];
    if (!body) return '';
    return `<svg class="ic ic-${name}${cls ? ` ${cls}` : ''}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Même dessin en document SVG autonome (pour <img> ou le canevas).
export const iconSvg = name => PATHS[name]
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${PATHS[name]}</svg>` : '';

// Pastille de mana d'une couleur (rouge, bleu…).
export const manaIcon = color => icon(`mana_${color}`) || icon('mana');
