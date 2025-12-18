import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Players } from "./player.js";

const data = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "data.json"), "utf-8"));


const cost = {
    sword: { wood: 5, stone: 7, iron: 10, diamond: 15 },
    axe: { wood: 4, stone: 6, iron: 9, diamond: 14 },
    spear: { wood: 3, stone: 5, iron: 8, diamond: 12 },
    armor: { wood: 6, stone: 9, iron: 15, diamond: 25 }
};

export const craftingMenu = [
    [
        { text: "Меч", callback_data: "craft_type_swords" },
        { text: "Топор", callback_data: "craft_type_axes" }
    ],
    [
        { text: "Копье", callback_data: "craft_type_spears" },
        { text: "Броня", callback_data: "craft_type_armor" }
    ]
];

export function craftingSubMenu(type) {
    let menu = [];
    switch (type) {
        case "swords":
            menu = data.weapons.swords.map(item => [{ text: item.name, callback_data: `craft_weapon_${item.name}` }]);
            break;
        case "axes":
            menu = data.weapons.axes.map(item => [{ text: item.name, callback_data: `craft_weapon_${item.name}` }]);
            break;
        case "spears":
            menu = data.weapons.spears.map(item => [{ text: item.name, callback_data: `craft_weapon_${item.name}` }]);
            break;
        case "armor":
            menu = data.armor.map(item => [{ text: item.name, callback_data: `craft_armor_${item.name}` }]);
            break;
        default:
            menu = [];
    }
    menu.push([{ text: "<< Назад", callback_data: "craft_back" }]);
    return menu;
}


export async function craftItem(player, type, name) {
    let item;
    if (type === "weapon") {
        item = Object.values(data.weapons).flat().find(weapon => weapon.name === name);
        type = item.type;
    } else if (type === "armor") {
        item = data.armor.find(armor => armor.name === name);
        type = "armor";
    } else return { success: false, msg: "Неверный тип предмета" };
    if (!item) return { success: false, msg: "Такого предмета нет" };

    const price = {
        wood: item.material === "wood" ? cost[type].wood : 0,
        stone: item.material === "stone" ? cost[type].stone : 0,
        iron: item.material === "iron" ? cost[type].iron : 0,
        diamond: item.material === "diamond" ? cost[type].diamond : 0
    };

    for (const resource in price) {
        if ((player.resources[resource] || 0) < price[resource]) {
            return { success: false, msg: `Недостаточно ${resource}` };
        }
    }

    for (const resource in price) player.resources[resource] -= price[resource];

    if (type === "armor") player.equipment.armor = item;
    else player.equipment.weapon = item;

    await Players().updateOne(
        { telegramId: player.telegramId },
        { $set: { resources: player.resources, equipment: player.equipment } }
    );

    return { success: true, msg: `✅ Экипировано: ${name}` };
}