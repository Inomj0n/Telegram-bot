import { Telegraf } from "telegraf";
import { config } from "dotenv";

import { connectDB } from "./db.js";
import { getOrCreatePlayer } from "./player.js";
import { mainMenu, inlineMenu } from "./keyboards.js";
import { mine, fight } from "./game.js";
import { craftItem, craftingMenu, craftingSubMenu } from "./crafting.js";
config();

await connectDB();
const bot = new Telegraf(process.env.BOT_TOKEN);

const enemiesInBattle = new Map();
const playersInBattle = new Map();
const lastAction = new Map();

function canAct(id) {
    const now = Date.now();
    if (!lastAction.has(id) || now - lastAction.get(id) > 2000) {
        lastAction.set(id, now);
        return true;
    }
    return false;
}

bot.start(async (ctx) => {
    await getOrCreatePlayer(ctx);
    await ctx.reply("Добро пожаловать в RPG бота! Создатель: @Deeadinsult", { reply_markup: { keyboard: mainMenu, resize_keyboard: true } });
});

bot.hears(/.*/, async (ctx, next) => {
    const player = await getOrCreatePlayer(ctx);
    if (playersInBattle.get(player.telegramId)) {
        return ctx.reply("⚔️ Вы сейчас в бою! Дождитесь окончания битвы\.", { reply_markup: { remove_keyboard: true } });
    }
    return next();
});

bot.hears("⛏️ Фарм", async (ctx) => {
    const player = await getOrCreatePlayer(ctx);
    const { wood, stone, iron, diamond, enemy } = await mine(player);

    let msg = `${wood} дерева, ${stone} камня`;
    if (iron) msg += `, ${iron} железа`;
    if (diamond) msg += `, ${diamond} алмаза`;

    if (enemy) {
        enemiesInBattle.set(player.telegramId, enemy);
        playersInBattle.set(player.telegramId, true);
        await ctx.reply(`💀 Во время фарма вы встретили ${enemy.name}. HP: ${enemy.hp}`, {
            reply_markup: { inline_keyboard: inlineMenu, remove_keyboard: true }
        });
    } else {
        await ctx.reply(`⛏️ Вы добыли: ${msg}`, { reply_markup: { keyboard: mainMenu, resize_keyboard: true } });
    }
});

bot.hears("⚔️ Бой", async (ctx) => {
    const player = await getOrCreatePlayer(ctx);
    const { enemy } = await mine(player);
    if (!enemy) return ctx.reply("💀 Нет врагов поблизости...", { reply_markup: { keyboard: mainMenu, resize_keyboard: true } });

    enemy.maxHp = enemy.hp;
    enemiesInBattle.set(player.telegramId, enemy);
    playersInBattle.set(player.telegramId, true);
    await ctx.reply(`💀 Вы встретили ${enemy.name}! HP: ${enemy.hp}`, {
        reply_markup: { inline_keyboard: inlineMenu, remove_keyboard: true }
    });
});

async function handleBattle(ctx, action) {
    const player = await getOrCreatePlayer(ctx);
    const enemy = enemiesInBattle.get(player.telegramId);
    if (!enemy) return ctx.answerCbQuery("Нет врага!");
    if (!canAct(player.telegramId)) return ctx.answerCbQuery("Подожди перед следующим действием!");

    if (action === "run") {
        enemiesInBattle.delete(player.telegramId);
        playersInBattle.delete(player.telegramId);
        await ctx.editMessageText("🏃‍♂️ Вы сбежали из боя!", { reply_markup: { inline_keyboard: [] } });
        await ctx.reply("Вы вернулись в главное меню.", { reply_markup: { keyboard: mainMenu, resize_keyboard: true } });
        return;
    }

    const result = await fight(player, enemy);

    if (result.dead || result.victory) {
        enemiesInBattle.delete(player.telegramId);
        playersInBattle.delete(player.telegramId);
        await ctx.editMessageText(result.reply.join("\n"), { reply_markup: { inline_keyboard: [] } });
        await ctx.reply("Возвращаемся в меню.", { reply_markup: { keyboard: mainMenu, resize_keyboard: true } });
        return;
    }

    await ctx.editMessageText(result.reply.join("\n"), { reply_markup: { inline_keyboard: inlineMenu } });
}

bot.action("fight", (ctx) => handleBattle(ctx, "fight"));
bot.action("run", (ctx) => handleBattle(ctx, "run"));

bot.hears("🛡️ Профиль", async (ctx) => {
    const player = await getOrCreatePlayer(ctx);
    const inv = player.resources;
    const equip = player.equipment;
    const msg = `👤 <b>Профиль: @${player.username || "Игрок"}</b>

🛡️ <b>Характеристики:</b>
⭐ Уровень: ${player.level}
❤️ HP: ${player.hp}/${player.maxHp}
⚔️ Атака: ${player.attack}
💥 Крит: ${Math.round(player.critChance * 100)}%

🎒 <b>Инвентарь:</b>
🌲 Дерево: ${inv.wood}
🪨 Камень: ${inv.stone}
⛓️ Железо: ${inv.iron}
💎 Алмазы: ${inv.diamond}

🛡️ <b>Экипировка:</b>
${equip.weapon ? `⚔️ Оружие: ${equip.weapon.name}` : "⚔️ Оружие: Нет"}
${equip.armor ? `🛡️ Броня: ${equip.armor.name}` : "🛡️ Броня: Нет"}`;

    await ctx.reply(msg, { parse_mode: "HTML", reply_markup: { keyboard: mainMenu, resize_keyboard: true } });
});

bot.hears("⚒️ Крафт", async (ctx) => {
    await ctx.sendMessage("Что ты хочешь скрафтить?", { reply_markup: { inline_keyboard: craftingMenu } });
});

bot.action("craft_back", async (ctx) => {
    await ctx.editMessageText("Что ты хочешь скрафтить?", { reply_markup: { inline_keyboard: craftingMenu } });
});

bot.action(/craft_type_(.+)/, async (ctx) => {
    const type = ctx.match[1];
    const menu = craftingSubMenu(type);
    await ctx.editMessageText(`Выберите предмет для создания:`, { reply_markup: { inline_keyboard: menu } });
});

bot.action(/craft_(weapon|armor)_(.+)/, async (ctx) => {
    const player = await getOrCreatePlayer(ctx);
    const [type, name] = ctx.match[0].split("_").slice(1);
    const result = await craftItem(player, type, name);
    await ctx.answerCbQuery(result.msg);
    await ctx.editMessageText(result.msg, { reply_markup: { inline_keyboard: craftingMenu } });
});


bot.hears("⚜️ Гильдия", (ctx) => ctx.reply("Coming soon...", { reply_markup: { keyboard: mainMenu, resize_keyboard: true } }));
bot.launch();
console.log("Bot launched");