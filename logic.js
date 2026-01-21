const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js")

const config = require("./config.json")

function initializeBot(token) {
  if (!token) throw new Error("DISCORD_BOT_TOKEN missing")

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent
    ]
  })

  function updateActivity() {
    const count = client.guilds.cache.size
    client.user.setActivity(`Secure ${count} Servers`)
  }

  client.once("ready", async () => {
    console.log("ctOS: Logic synced and active.")
    updateActivity()

    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.get(config.verification.channel)
      if (!channel) continue

      const messages = await channel.messages.fetch({ limit: 10 })
      const existing = messages.find(m => m.author.id === client.user.id)
      if (existing) continue

      const embed = new EmbedBuilder()
        .setTitle("ctOS Verification")
        .setDescription("Click the button below to verify yourself.")
        .setColor(0x2f3136)

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("verify_user")
          .setLabel("Verify")
          .setStyle(ButtonStyle.Success)
      )

      await channel.send({ embeds: [embed], components: [row] })
    }
  })

  client.on("guildCreate", updateActivity)
  client.on("guildDelete", updateActivity)

  client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return
    if (interaction.customId !== "verify_user") return

    const role = interaction.guild.roles.cache.find(r => r.name === "Verified")
    if (role && !interaction.member.roles.cache.has(role.id)) {
      await interaction.member.roles.add(role)
    }

    await interaction.reply({ content: "ctOS: Verification complete.", ephemeral: true })
  })

  client.login(token)
}

module.exports = { initializeBot }
