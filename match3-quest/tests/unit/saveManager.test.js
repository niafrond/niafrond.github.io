import { describe, it, expect, beforeEach } from '@jest/globals';
import {
    exportSaveToFile,
    importSaveFromFile
} from '../../saveManager.js';

// Mock FileReader for Node.js environment
global.FileReader = class FileReader {
    constructor() {
        this.onload = null;
    }
    readAsText(file) {
        const content = file.content;
        setTimeout(() => {
            if (this.onload) {
                this.onload({ target: { result: content } });
            }
        }, 0);
    }
};

describe('Save Manager', () => {
    let testPlayer;

    beforeEach(() => {
        testPlayer = {
            name: 'Hou Yi',
            level: 5,
            hp: 75,
            maxHp: 100,
            attack: 20,
            defense: 5,
            gold: 500,
            inventory: [
                { id: 'potion1', name: 'Elixir', type: 'consumable' },
                { id: 'shield1', name: 'Bouclier', type: 'shield', defense: 10 }
            ],
            equipment: {
                rightHand: { id: 'sword1', name: 'Epee', type: 'weapon' },
                leftHand: null,
                item: null
            },
            spells: [],
            exploration: {
                currentScreen: 'village_1',
                currentQuest: 'q_main_1'
            }
        };
    });

    describe('exportSaveToFile', () => {
        it('exports save correctly', () => {
            const result = exportSaveToFile(testPlayer, '1.0.0');

            expect(result.success).toBe(true);
            expect(result.blob).toBeInstanceOf(Blob);
            expect(result.filename).toMatch(/match3quest-save-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json/);
        });

        it('includes correct metadata', async () => {
            const result = exportSaveToFile(testPlayer, '1.0.0');
            const text = await result.blob.text();
            const data = JSON.parse(text);

            expect(data.metadata).toBeDefined();
            expect(data.metadata.version).toBe('1.0.0');
            expect(data.metadata.playerName).toBe('Hou Yi');
            expect(data.metadata.level).toBe(5);
            expect(Number.isInteger(data.metadata.timestamp)).toBe(true);
        });

        it('includes player data', async () => {
            const result = exportSaveToFile(testPlayer);
            const text = await result.blob.text();
            const data = JSON.parse(text);

            expect(data.player).toBeDefined();
            expect(data.player.name).toBe('Hou Yi');
            expect(data.player.level).toBe(5);
            expect(data.player.gold).toBe(500);
            expect(data.player.inventory).toHaveLength(2);
        });

        it('refuses to export without player', () => {
            const result = exportSaveToFile(null);
            expect(result.success).toBe(false);
        });

        it('generates unique filenames', async () => {
            const result1 = exportSaveToFile(testPlayer);
            // Wait 1 second to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 1000));
            const result2 = exportSaveToFile(testPlayer);

            expect(result1.filename).not.toBe(result2.filename);
        });
    });

    describe('importSaveFromFile', () => {
        it('imports valid save', async () => {
            const saveData = {
                metadata: {
                    version: '1.0.0',
                    timestamp: Date.now(),
                    playerName: 'Hou Yi',
                    level: 5
                },
                player: testPlayer
            };

            const json = JSON.stringify(saveData);
            const file = {
                name: 'test.json',
                content: json,
                type: 'application/json'
            };

            const importResult = await importSaveFromFile(file);

            expect(importResult.success).toBe(true);
            expect(importResult.player).toBeDefined();
            expect(importResult.player.name).toBe('Hou Yi');
            expect(importResult.player.level).toBe(5);
        });

        it('conserve l\'équipement après un export puis un import', async () => {
            const exported = exportSaveToFile(testPlayer, '1.0.0');
            const file = { name: exported.filename, content: await exported.blob.text() };
            const res = await importSaveFromFile(file);

            expect(res.success).toBe(true);
            expect(res.player.equipment.rightHand.id).toBe('sword1');
            expect(res.player.inventory).toHaveLength(2);
        });

        it('refuses non-JSON files', async () => {
            const file = { name: 'test.txt', content: 'invalid' };
            const result = await importSaveFromFile(file);

            expect(result.success).toBe(false);
            expect(result.message).toContain('JSON');
        });

        it('refuses invalid JSON', async () => {
            const file = { name: 'test.json', content: 'not valid json' };
            const result = await importSaveFromFile(file);

            expect(result.success).toBe(false);
        });

        it('refuses save without metadata', async () => {
            const invalidData = { player: testPlayer };
            const file = { name: 'test.json', content: JSON.stringify(invalidData) };
            const result = await importSaveFromFile(file);

            expect(result.success).toBe(false);
        });

        it('refuses null file', async () => {
            const result = await importSaveFromFile(null);
            expect(result.success).toBe(false);
        });
    });
});
