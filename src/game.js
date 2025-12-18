import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Players } from "./player.js";

const data = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "data.json"), "utf-8"));

export async function mine(player) {
    const level = player.level;
    const wood = Math.floor(Math.random() * 5 * level) + 1;
    const stone = Math.floor(Math.random() * 3 * level) + 1;
    const iron = Math.random() < 0.3 * level ? Math.floor(Math.random() * 2) + 1 : 0;
    const diamond = Math.random() < 0.05 * level ? 1 : 0;

    player.resources.wood += wood;
    player.resources.stone += stone;
    player.resources.iron += iron;
    player.resources.diamond += diamond;

    const encounter = Math.random() < 0.3 + 0.1;
    const enemy = encounter ? { ...data.enemies[Math.floor(Math.random() * data.enemies.length)] } : null;
    if (enemy) enemy.maxHp = enemy.hp;

    await Players().updateOne({ telegramId: player.telegramId }, { $set: { resources: player.resources } });

    return { wood, stone, iron, diamond, enemy };
}

export async function fight(player, enemy) {
    let reply = [];
    let weaponAttack = player.equipment.weapon ? player.equipment.weapon.attack : 0;
    let playerAttack = Math.floor((player.attack + weaponAttack + player.level / 3) * (0.9 + Math.random() * 0.2));

    if (Math.random() < player.critChance) {
        playerAttack *= 2;
        enemy.hp -= playerAttack;
        reply.push(`💥 Критический удар! Ты нанес ${playerAttack} урона врагу: ${enemy.name}`);
    }
    if (Math.random() < player.missChance) {
        playerAttack = 0;
        reply.push(`❌ Промах! ${enemy.name} увернулся от твоей атаки`)
    }
    else {
        enemy.hp -= playerAttack;
        reply.push(`⚔️ Ты нанес ${playerAttack} урона врагу: ${enemy.name}`);
    }



    if (enemy.hp <= 0) {
        player.exp += enemy.exp;
        for (const loot in enemy.loot) player.resources[loot] = (player.resources[loot] || 0) + enemy.loot[loot];

        let wood = enemy.loot.wood;
        let stone = enemy.loot.stone;
        let iron = enemy.loot.iron;
        if (iron === undefined || iron === null) iron = 0;
        await Players().updateOne({ telegramId: player.telegramId }, { $set: { exp: player.exp, resources: player.resources } });
        reply.push(`🏆 Победа! EXP: ${enemy.exp}, Лут: Дерево: ${wood} , Камень: ${stone}, Железо: ${iron}`);
        return { reply, victory: true };
    }

    let enemyAttack = enemy.attack;
    if (Math.random() < 0.1) enemyAttack *= 2;
    if (Math.random() < 0.4) {
        enemyAttack = 0;
        reply.push(`❌ Промах! Ты увернулся от атаки врага: ${enemy.name}`)
    }

    player.hp -= enemyAttack;
    reply.push(`🛡️ ${enemy.name} наносит тебе ${enemyAttack} урона`);

    if (player.hp <= 0) {
        for (const loot in player.resources) player.resources[loot] = Math.floor(player.resources[loot] / 2);
        player.hp = player.maxHp;

        await Players().updateOne({ telegramId: player.telegramId }, { $set: { hp: player.hp, resources: player.resources } });

        reply.push(`💀 Вы погибли и потеряли половину ресурсов!`);
        return { reply, dead: true };
    }

    await Players().updateOne({ telegramId: player.telegramId }, { $set: { hp: player.hp } });
    return { reply, victory: false };
}