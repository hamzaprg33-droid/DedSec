const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js")
const fs = require("fs")
const path = require("path")

const dataDir = path.join(__dirname, "data")
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)

const spamFile = path.join(dataDir, "spam.json")
const dashboardFile = path.join(dataDir, "dashboard.json")

if (!fs.existsSync(spamFile)) fs.writeFileSync(spamFile, "{}")
if (!fs.existsSync(dashboardFile)) fs.writeFileSync(dashboardFile, "{}")

function load(file) {
    return JSON.parse(fs.readFileSync(file))
}

function save(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function initializeBot(token) {
    if (!token) throw new Error("DISCORD_BOT_TOKEN missing")

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.DirectMessages
        ]
    })

    client.once("ready", () => {
        console.log(`[DEDSEC] ${client.user.tag} online`)
    })

    client.on("messageCreate", async msg => {
        if (!msg.guild || msg.author.bot) return

        const spam = load(spamFile)
        const key = msg.guild.id + ":" + msg.author.id
        const now = Date.now()

        if (!spam[key]) spam[key] = { count: 0, last: now }
        if (now - spam[key].last > 86400000) spam[key].count = 0

        spam[key].count++
        spam[key].last = now
        save(spamFile, spam)

        if (spam[key].count >= 4) {
            const minutes = spam[key].count
            await msg.delete().catch(() => {})
            await msg.member.timeout(minutes * 60000, "Spamming")
            await msg.channel.send(`${msg.author} was timed out for ${minutes} minute(s) due to spamming.`)
        }
    })

    client.on("interactionCreate", async i => {
        if (!i.isButton()) return

        const dashboards = load(dashboardFile)
        const id = i.user.id

        if (!dashboards[id]) dashboards[id] = {}

        dashboards[id][i.customId] = !dashboards[id][i.customId]
        save(dashboardFile, dashboards)

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("antispam")
                .setLabel("AntiSpam")
                .setStyle(dashboards[id]["antispam"] ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("auditlog")
                .setLabel("AuditLog")
                .setStyle(dashboards[id]["auditlog"] ? ButtonStyle.Success : ButtonStyle.Danger)
        )

        await i.update({ components: [row] })
    })

    client.login(token)
}

module.exports = { initializeBot }
