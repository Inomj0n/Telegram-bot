import mongoose from "mongoose";

export const Players = () => mongoose.connection.collection("players");

export async function getOrCreatePlayer(ctx) {
    const telegramId = ctx.from.id;

    let player = await Players().findOne({ telegramId });

    if (!player) {
        player = {
            telegramId,
            username: ctx.from.username || null,

            level: 1,
            exp: 0,

            hp: 100,
            maxHp: 100,
            attack: 5,
            
            critChance: 0.05,
            missChance: 0.15,

            resources: {
                wood: 0,
                stone: 0,
                iron: 0,
                diamond: 0
            },

            equipment: {
                weapon: null,
                armor: null
            },

            createdAt: new Date()
        };

        await Players().insertOne(player);
    }

    return player;
}