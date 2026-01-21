const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Collection } = require("discord.js")
const fs = require("fs")
const path = require("path")
const axios = require("axios")

async function fetchFromGitHub(fileName) {
  const GITHUB_API_BASE = "https://api.github.com"
  const repoPath = "/repos/hamzaprg33-droid/DedSec/contents/" + fileName
  const finalUrl = new URL(repoPath, GITHUB_API_BASE).href
  const response = await axios.get(finalUrl, {
    headers: {
      "Authorization": "token " + process.env.GITHUB_TOKEN.trim(),
      "Accept": "application/vnd.github.v3.raw",
      "User-Agent": "ctOS-Bot-2026"
    }
  })
  return response.data
}

async function initializeBot(config, token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages
    ]
  })

  const spamMap = new Collection()
  const timeoutMap = new Collection()
  const verificationMap = new Collection()
  const dashboardMap = new Collection()

  function updateActivity() {
    client.user.setActivity(`Secure ${client.guilds.cache.size} Servers`)
  }

  client.once("ready", async () => {
    console.log("ctOS: Logic synced and active.")
    updateActivity()
    for (const guild of client.guilds.cache.values()) {
      const ch = guild.channels.cache.get(config.verification.channel)
      if (!ch) continue
      const msgs = await ch.messages.fetch({ limit: 10 })
      const exists = msgs.find(m => m.author.id === client.user.id)
      if (!exists) {
        const embed = new EmbedBuilder().setTitle("ctOS Verification").setDescription("Click the button below to verify yourself.").setColor(0x2f3136)
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("verify_start").setLabel("Start").setStyle(ButtonStyle.Success))
        await ch.send({ embeds: [embed], components: [row] })
      }
    }
  })

  client.on("guildCreate", updateActivity)
  client.on("guildDelete", updateActivity)

  client.on("messageCreate", async message => {
    if (message.author.bot || !message.guild) return
    const now = Date.now()
    if (!spamMap.has(message.author.id)) spamMap.set(message.author.id, [])
    const times = spamMap.get(message.author.id)
    times.push(now)
    const recent = times.filter(t => t > now - 5000)
    spamMap.set(message.author.id, recent)
    if (recent.length > 3) {
      let timeoutMinutes = timeoutMap.get(message.author.id) || 1
      await message.member.timeout(timeoutMinutes * 60 * 1000, "Spamming")
      await message.reply(`You have been timed out for spamming: ${timeoutMinutes} minute(s).`)
      timeoutMap.set(message.author.id, timeoutMinutes + 1)
      setTimeout(() => {
        timeoutMap.delete(message.author.id)
      }, 24 * 60 * 60 * 1000)
      message.delete().catch(() => {})
    }
  })

  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return
    const id = interaction.customId
    if (id === "verify_start") {
      verificationMap.set(interaction.user.id, { step: 1, data: {} })
      await interaction.user.send("1. What is your Server ID?").catch(() => {})
      await interaction.reply({ content: "Check your DMs.", ephemeral: true })
    } else if (id.startsWith("dashboard_")) {
      const [_, guildId, func] = id.split("_")
      if (!dashboardMap.has(guildId)) dashboardMap.set(guildId, {})
      const guildStatus = dashboardMap.get(guildId)
      guildStatus[func] = !guildStatus[func]
      dashboardMap.set(guildId, guildStatus)
      await interaction.update({ components: interaction.message.components })
    }
  })

  client.on("messageCreate", async message => {
    if (!message.guild && verificationMap.has(message.author.id)) {
      const session = verificationMap.get(message.author.id)
      const step = session.step
      if (step === 1) {
        session.data.serverId = message.content
        session.step = 2
        await message.author.send("2. Do you want automatic updates for new features? (Yes/No)")
      } else if (step === 2) {
        session.data.autoUpdate = message.content.toLowerCase() === "yes"
        session.step = 3
        await message.author.send("3. Enter role IDs for dashboard access, separated by commas")
      } else if (step === 3) {
        session.data.roles = message.content.split(",").map(r => r.trim())
        session.step = 4
        await message.author.send("4. Is the bot on your server? (Yes/No)")
      } else if (step === 4) {
        session.data.botOnServer = message.content.toLowerCase() === "yes"
        verificationMap.delete(message.author.id)
        const guildId = session.data.serverId
        if (session.data.botOnServer) {
          // Command update logic would go here per guild
        }
        for (const roleId of session.data.roles) {
          const user = await client.users.fetch(message.author.id)
          const embed = new EmbedBuilder().setTitle("Server Dashboard").setDescription(`Welcome to ctOS Dashboard!\nClick the button below to log in.`).setColor(0x800000)
          const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`dashboard_${guildId}_example`).setLabel(`Example Feature`).setStyle(ButtonStyle.Primary))
          await user.send({ content: `<@${message.author.id}>`, embeds: [embed], components: [row] }).catch(() => {})
        }
      }
    }
  })

  client.login(token)
}

module.exports = { initializeBot }
