const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Collection
} = require("discord.js")

function initializeBot(config, token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
  })

  const sessions = new Collection()

  function updateActivity() {
    if (!client.user) return
    client.user.setActivity(`Secure ${client.guilds.cache.size} Servers`)
  }

  client.once("ready", async () => {
    console.log("CtOS online")
    updateActivity()

    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.get(config.verification.channel)
      if (!channel) continue

      const messages = await channel.messages.fetch({ limit: 10 })
      const exists = messages.find(m => m.author.id === client.user.id)
      if (exists) continue

      const embed = new EmbedBuilder()
        .setTitle("ctOS Server Registration")
        .setDescription("Register your server to activate ctOS.")
        .setColor(0x2b0000)

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ctos_register")
          .setLabel("Register Server")
          .setStyle(ButtonStyle.Primary)
      )

      await channel.send({ embeds: [embed], components: [row] })
    }
  })

  client.on("guildCreate", updateActivity)
  client.on("guildDelete", updateActivity)

  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return
    if (interaction.customId !== "ctos_register") return

    try {
      await interaction.user.send("1. What is your Server ID?")
    } catch {
      await interaction.reply({
        content: "❌ I cannot send you a DM. Please enable Direct Messages and try again.",
        ephemeral: true
      })
      return
    }

    sessions.set(interaction.user.id, { step: 1, data: {} })

    await interaction.reply({
      content: "📩 Check your DMs to continue server registration.",
      ephemeral: true
    })
  })

  client.on("messageCreate", async message => {
    if (message.guild) return
    const session = sessions.get(message.author.id)
    if (!session) return

    try {
      if (session.step === 1) {
        session.data.serverId = message.content
        session.step = 2
        await message.author.send("2. Enable automatic updates? (Yes / No)")
        return
      }

      if (session.step === 2) {
        session.data.autoUpdate = message.content.toLowerCase() === "yes"
        session.step = 3
        await message.author.send("3. Dashboard role IDs (comma separated)")
        return
      }

      if (session.step === 3) {
        session.data.roles = message.content.split(",").map(r => r.trim())
        session.step = 4
        await message.author.send("4. Is ctOS already on your server? (Yes / No)")
        return
      }

      if (session.step === 4) {
        sessions.delete(message.author.id)
        await message.author.send("✅ ctOS server registration completed.")
      }
    } catch {
      sessions.delete(message.author.id)
    }
  })

  client.login(token)
}

module.exports = { initializeBot }
