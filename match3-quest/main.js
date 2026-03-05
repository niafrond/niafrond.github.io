import { generateBoard, renderBoard } from "./board.js";
import { attackEnemy, updateStats, createSpellButtons, newEnemy, restartCombat } from "./game.js";

// initialisation de la partie

document.getElementById('attack-btn').addEventListener('click',attackEnemy);
document.getElementById('restart-btn').addEventListener('click',()=>{
    restartCombat();
    generateBoard();
    renderBoard();
    newEnemy();
});

// start fresh with full life
restartCombat();
generateBoard();
renderBoard();
updateStats();
createSpellButtons();
newEnemy();
