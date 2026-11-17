import { describe, it, expect, beforeEach } from '@jest/globals';
import {
    initializeEquipment,
    getValidSlots,
    canEquip,
    equip,
    unequip,
    getEquipped,
    getAllEquipped,
    getEquipmentDefenseBonus
} from '../../equipment.js';

describe('Equipment System', () => {
    let player;

    beforeEach(() => {
        player = {
            equipment: initializeEquipment()
        };
    });

    describe('initializeEquipment', () => {
        it('crée une structure d\'équipement vide', () => {
            const equipment = initializeEquipment();
            expect(equipment.rightHand).toBeNull();
            expect(equipment.leftHand).toBeNull();
            expect(equipment.item).toBeNull();
        });
    });

    describe('getValidSlots', () => {
        it('retourne rightHand/leftHand pour une arme standard', () => {
            const weapon = { type: 'weapon', twoHanded: false };
            const slots = getValidSlots(weapon);
            expect(slots).toContain('rightHand');
            expect(slots).toContain('leftHand');
        });

        it('retourne leftHand uniquement pour un bouclier', () => {
            const shield = { type: 'shield' };
            const slots = getValidSlots(shield);
            expect(slots).toEqual(['leftHand']);
        });

        it('retourne item uniquement pour un objet consommable', () => {
            const potion = { type: 'consumable' };
            const slots = getValidSlots(potion);
            expect(slots).toEqual(['item']);
        });

        it('retourne item pour un objet reusable', () => {
            const reusable = { type: 'reusable' };
            const slots = getValidSlots(reusable);
            expect(slots).toEqual(['item']);
        });
    });

    describe('canEquip', () => {
        it('permet équiper une arme en main droite', () => {
            const weapon = { type: 'weapon', twoHanded: false };
            expect(canEquip(weapon, 'rightHand')).toBe(true);
        });

        it('permet équiper une arme en main gauche', () => {
            const weapon = { type: 'weapon', twoHanded: false };
            expect(canEquip(weapon, 'leftHand')).toBe(true);
        });

        it('refuse d\'équiper un bouclier en main droite', () => {
            const shield = { type: 'shield' };
            expect(canEquip(shield, 'rightHand')).toBe(false);
        });

        it('permet équiper un bouclier en main gauche', () => {
            const shield = { type: 'shield' };
            expect(canEquip(shield, 'leftHand')).toBe(true);
        });

        it('refuse d\'équiper un potion en main droite', () => {
            const potion = { type: 'consumable' };
            expect(canEquip(potion, 'rightHand')).toBe(false);
        });

        it('permet équiper un potion au slot item', () => {
            const potion = { type: 'consumable' };
            expect(canEquip(potion, 'item')).toBe(true);
        });
    });

    describe('equip', () => {
        it('équipe une arme en main droite', () => {
            const weapon = { id: 'sword1', name: 'Épée Test', type: 'weapon', twoHanded: false };
            const result = equip(player, weapon, 'rightHand');
            expect(result.success).toBe(true);
            expect(player.equipment.rightHand).toEqual(weapon);
        });

        it('équipe un bouclier en main gauche', () => {
            const shield = { id: 'shield1', name: 'Bouclier Test', type: 'shield', defense: 10 };
            const result = equip(player, shield, 'leftHand');
            expect(result.success).toBe(true);
            expect(player.equipment.leftHand).toEqual(shield);
        });

        it('refuse d\'équiper un bouclier en main droite', () => {
            const shield = { type: 'shield' };
            const result = equip(player, shield, 'rightHand');
            expect(result.success).toBe(false);
        });

        it('gère l\'équipement d\'une arme à deux mains', () => {
            const leftWeapon = { id: 'dagger', name: 'Poignard', type: 'weapon', twoHanded: false };
            const twoHandedWeapon = { id: 'greataxe', name: 'Grande Hache', type: 'weapon', twoHanded: true };

            // Équiper d'abord une arme en main gauche
            equip(player, leftWeapon, 'leftHand');
            expect(player.equipment.leftHand).not.toBeNull();

            // Équiper une arme à deux mains en main droite
            const result = equip(player, twoHandedWeapon, 'rightHand');
            expect(result.success).toBe(true);
            expect(player.equipment.rightHand).toEqual(twoHandedWeapon);
            expect(player.equipment.leftHand).toBeNull(); // La main gauche doit être vidée
        });

        it('refuse un bouclier si une arme à deux mains est équipée', () => {
            const twoHandedWeapon = { id: 'greataxe', name: 'Grande Hache', type: 'weapon', twoHanded: true };
            const shield = { type: 'shield' };

            equip(player, twoHandedWeapon, 'rightHand');
            const result = equip(player, shield, 'leftHand');
            expect(result.success).toBe(false);
        });
    });

    describe('unequip', () => {
        it('retire un équipement d\'un slot', () => {
            const weapon = { id: 'sword1', name: 'Épée Test', type: 'weapon' };
            player.equipment.rightHand = weapon;

            const unequipped = unequip(player, 'rightHand');
            expect(unequipped).toEqual(weapon);
            expect(player.equipment.rightHand).toBeNull();
        });

        it('retourne null si rien n\'est équipé', () => {
            const unequipped = unequip(player, 'leftHand');
            expect(unequipped).toBeNull();
            expect(player.equipment.leftHand).toBeNull();
        });
    });

    describe('getEquipped', () => {
        it('retourne l\'équipement d\'un slot', () => {
            const weapon = { id: 'sword1', name: 'Épée Test', type: 'weapon' };
            player.equipment.rightHand = weapon;

            expect(getEquipped(player, 'rightHand')).toEqual(weapon);
        });

        it('retourne null si aucun équipement', () => {
            expect(getEquipped(player, 'leftHand')).toBeNull();
        });
    });

    describe('getAllEquipped', () => {
        it('retourne tous les équipements', () => {
            const rightWeapon = { id: 'sword1', name: 'Épée', type: 'weapon' };
            const leftWeapon = { id: 'dagger1', name: 'Poignard', type: 'weapon' };
            const item = { id: 'potion1', name: 'Potion', type: 'consumable' };

            player.equipment.rightHand = rightWeapon;
            player.equipment.leftHand = leftWeapon;
            player.equipment.item = item;

            const equipped = getAllEquipped(player);
            expect(equipped).toHaveLength(3);
            expect(equipped).toContain(rightWeapon);
            expect(equipped).toContain(leftWeapon);
            expect(equipped).toContain(item);
        });

        it('retourne un tableau vide si aucun équipement', () => {
            const equipped = getAllEquipped(player);
            expect(equipped).toEqual([]);
        });
    });

    describe('getEquipmentDefenseBonus', () => {
        it('calcule le bonus de défense total', () => {
            const shield = { type: 'shield', defense: 10 };
            const armor = { type: 'artifact', defense: 5 };

            player.equipment.leftHand = shield;
            player.equipment.item = armor;

            const bonus = getEquipmentDefenseBonus(player);
            expect(bonus).toBe(15);
        });

        it('retourne 0 si aucun équipement avec défense', () => {
            player.equipment.rightHand = { type: 'weapon' };
            const bonus = getEquipmentDefenseBonus(player);
            expect(bonus).toBe(0);
        });
    });
});
