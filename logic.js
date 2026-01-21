const { Client, GatewayIntentBits, EmbedBuilder, Collection, AuditLogEvent, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js")
const mongoose = require("mongoose")

const GuildSettingsSchema = new mongoose.Schema({
    guildId: String,
    autoUpdate: Boolean,
    dashboardRoles: [String]
})

const SpamSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    count: Number,
    lastSpam: Date
})

const GuildSettings = mongoose.model("GuildSettings", GuildSettingsSchema)
const SpamLog = mongoose.model("SpamLog", SpamSchema)

async function initializeBot(config, token, mongoUrl) {
    if (!mongoUrl) throw new Error("MONGO_URL is missing in .env")
    await mongoose.connect(mongoUrl)

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.DirectMessages
        ]
    })

    const spamCache = new Collection()

    client.once("ready", async () => {
        client.user.setActivity(config.activity)

        for (const guild of client.guilds.cache.values()) {
            const settings = await GuildSettings.findOne({ guildId: guild.id })
            if (!settings || !settings.autoUpdate) continue
            await guild.commands.set([])
        }

        for (const guild of client.guilds.cache.values()) {
            if (!config.verification?.channel) continue
            const channel = guild.channels.cache.get(config.verification.channel)
            if (!channel) continue

            const messages = await channel.messages.fetch({ limit: 10 })
            let msg = messages.find(m => m.author.id === client.user.id)

            if (!msg) {
                msg = await channel.send("DedSec verification initialized. Check your DMs.")
            }

            const owner = await guild.fetchOwner()
            startVerification(owner.user)
        }
    })

    async function startVerification(user) {
        const dm = await user.createDM()

        const q1 = await dm.send("What is your Server ID?")
        const a1 = (await dm.awaitMessages({ max: 1, time: 300000 })).first().content

        const q2row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("auto_yes").setLabel("Yes").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("auto_no").setLabel("No").setStyle(ButtonStyle.Danger)
        )
        const q2 = await dm.send({ content: "Should the bot auto update commands?", components: [q2row] })
        const i2 = await q2.awaitMessageComponent({ time: 300000 })
        const autoUpdate = i2.customId === "auto_yes"
        await i2.update({ components: [] })

        const q3 = await dm.send("Which Role IDs should access the dashboard? Separate with commas.")
        const roles = (await dm.awaitMessages({ max: 1, time: 300000 })).first().content.split(",").map(r => r.trim())

        const q4row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("bot_yes").setLabel("Yes").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("bot_no").setLabel("No").setStyle(ButtonStyle.Danger)
        )
        const q4 = await dm.send({ content: "Is the bot on your server?", components: [q4row] })
        const i4 = await q4.awaitMessageComponent({ time: 300000 })
        const isOnServer = i4.customId === "bot_yes"
        await i4.update({ components: [] })

        if (!isOnServer) return

        await GuildSettings.findOneAndUpdate(
            { guildId: a1 },
            { guildId: a1, autoUpdate, dashboardRoles: roles },
            { upsert: true }
        )

        const guild = client.guilds.cache.get(a1)
        if (!guild) return

        await guild.commands.set([])

        for (const roleId of roles) {
            const role = guild.roles.cache.get(roleId)
            if (!role) continue

            for (const member of role.members.values()) {
                const embed = new EmbedBuilder()
                    .setTitle(`${guild.name} Dashboard`)
                    .setDescription(`Herzlich willkommen bei DedSec!\nUm dich beim Serverdashboard von **${guild.name}** einzuloggen, klicke den Knopf unter mir.`)
                    .setColor(0x5c1a1b)

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("dashboard_login").setLabel("Als USERNAME einloggen").setStyle(ButtonStyle.Primary)
                )

                await member.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] })
            }
        }
    }

    client.on("interactionCreate", async interaction => {
        if (!interaction.isButton()) return

        if (interaction.customId === "dashboard_login") {
            await interaction.message.delete()

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("feature_1").setLabel("Anti Spam").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("feature_2").setLabel("Anti Nuke").setStyle(ButtonStyle.Danger)
            )

            await interaction.user.send({ content: "Dashboard", components: [row] })
        }

        if (interaction.customId.startsWith("feature_")) {
            const newStyle = interaction.component.style === ButtonStyle.Danger ? ButtonStyle.Success : ButtonStyle.Danger
            const row = ActionRowBuilder.from(interaction.message.components[0])
            row.components.find(b => b.customId === interaction.customId).setStyle(newStyle)
            await interaction.update({ components: [row] })
        }
    })

    client.on("messageCreate", async message => {
        if (!message.guild || message.author.bot) return

        const key = `${message.guild.id}_${message.author.id}`
        const now = Date.now()

        let data = spamCache.get(key)
        if (!data) data = { count: 0, last: now }

        if (now - data.last > 86400000) data.count = 0

        data.count++
        data.last = now
        spamCache.set(key, data)

        if (data.count >= 4) {
            const minutes = data.count
            await message.delete().catch(() => {})
            await message.member.timeout(minutes * 60000, "Spamming")
            await message.channel.send(`${message.author} has been timed out for ${minutes} minute(s) due to spamming.`)
        }
    })

    client.login(token)
}

module.exports = { initializeBot }
