const { Client, GatewayIntentBits, Collection } = require("discord.js")
const mongoose = require("mongoose")

const GuildSettings = mongoose.model("GuildSettings", new mongoose.Schema({
    guildId: String,
    autoUpdate: Boolean,
    dashboardRoles: [String]
}))

const SpamLog = mongoose.model("SpamLog", new mongoose.Schema({
    guildId: String,
    userId: String,
    count: Number,
    lastSpam: Date
}))

async function initializeBot(config, token, mongoUrl) {
    if (!token) throw new Error("DISCORD_BOT_TOKEN missing")
    if (mongoUrl) await mongoose.connect(mongoUrl)

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.DirectMessages
        ]
    })

    const spamCache = new Collection()

    client.once("ready", async () => {
        client.user.setActivity(config.activity)
        for (const g of client.guilds.cache.values()) {
            const s = await GuildSettings.findOne({ guildId: g.id })
            if (s?.autoUpdate) await g.commands.set([])
        }
        console.log(`[DEDSEC] ${client.user.tag} online.`)
    })

    client.on("messageCreate", async msg => {
        if (!msg.guild || msg.author.bot) return
        const key = msg.guild.id + msg.author.id
        const now = Date.now()
        let data = spamCache.get(key) || { count: 0, last: now }
        if (now - data.last > 86400000) data.count = 0
        data.count++
        data.last = now
        spamCache.set(key, data)
        if (data.count >= 4) {
            const minutes = data.count
            await msg.delete().catch(() => {})
            await msg.member.timeout(minutes * 60000, "Spamming")
            await msg.channel.send(`${msg.author} was timed out for ${minutes} minute(s) due to spamming.`)
        }
    })

    client.login(token)
}

module.exports = { initializeBot }
