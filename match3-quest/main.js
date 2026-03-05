import { generateBoard, renderBoard } from "./board.js";
import { attackEnemy, updateStats, createSpellButtons, newEnemy } from "./game.js";

// initialisation de la partie

document.getElementById('attack-btn').addEventListener('click',attackEnemy);
generateBoard();
renderBoard();
updateStats();
createSpellButtons();
newEnemy();
