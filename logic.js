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

  const registerSessions = new Collection()

  function updateActivity() {
    client.user.setActivity(`Secure ${client.guilds.cache.size} Servers`)
  }

  client.once("ready", async () => {
    console.log("CtOS online")
    updateActivity()

    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.get(config.verification.channel)
      if (!channel) continue

      const messages = await channel.messages.fetch({ limit: 10 })
      const existing = messages.find(m => m.author.id === client.user.id)

      if (!existing) {
        const embed = new EmbedBuilder()
          .setTitle("ctOS Server Registration")
          .setDescription("Register your server to activate ctOS features.")
          .setColor(0x2b0000)

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ctos_register_start")
            .setLabel("Register Server")
            .setStyle(ButtonStyle.Primary)
        )

        await channel.send({ embeds: [embed], components: [row] })
      }
    }
  })

  client.on("guildCreate", updateActivity)
  client.on("guildDelete", updateActivity)

  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return
    if (interaction.customId !== "ctos_register_start") return

    registerSessions.set(interaction.user.id, { step: 1, data: {} })

    await interaction.reply({ content: "Check your DMs to continue server registration.", ephemeral: true })
    await interaction.user.send("1. What is your Server ID?")
  })

  client.on("messageCreate", async message => {
    if (message.guild) return
    if (!registerSessions.has(message.author.id)) return

    const session = registerSessions.get(message.author.id)

    if (session.step === 1) {
      session.data.serverId = message.content
      session.step = 2
      await message.author.send("2. Enable automatic updates for new features? (Yes / No)")
      return
    }

    if (session.step === 2) {
      session.data.autoUpdate = message.content.toLowerCase() === "yes"
      session.step = 3
      await message.author.send("3. Enter dashboard role IDs separated by commas")
      return
    }

    if (session.step === 3) {
      session.data.roles = message.content.split(",").map(r => r.trim())
      session.step = 4
      await message.author.send("4. Is ctOS already on your server? (Yes / No)")
      return
    }

    if (session.step === 4) {
      registerSessions.delete(message.author.id)
      await message.author.send("ctOS registration completed.")
    }
  })

  client.login(token)
}

module.exports = { initializeBot }
