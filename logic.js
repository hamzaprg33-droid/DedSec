const { Client, GatewayIntentBits } = require('discord.js');

function initializeBot(config, token) {
    const client = new Client({ 
        intents: [
            GatewayIntentBits.Guilds, 
            GatewayIntentBits.GuildMessages, 
            GatewayIntentBits.MessageContent
        ] 
    });

    client.once('ready', () => {
        console.log(`${config.botName} online.`);
        client.user.setActivity(config.activity);
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        if (message.content === config.prefix + 'ping') {
            await message.reply('Pong! DedSec logic active.');
        }
    });

    client.login(token);
}

module.exports = { initializeBot };
