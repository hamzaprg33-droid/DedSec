const { Client, GatewayIntentBits, EmbedBuilder, Collection, AuditLogEvent } = require('discord.js');
const mongoose = require('mongoose');

// Datenbank-Struktur
const LogSchema = new mongoose.Schema({
    guildId: String,
    date: { type: Date, default: Date.now },
    userId: String,
    username: String,
    action: String,
    reason: String
});
const AuditLog = mongoose.model('AuditLog', LogSchema);

const spamMap = new Collection();

async function initializeBot(config, token, mongoUri) {
    // 1. Online-Datenbank Verbindung
    try {
        if (!mongoUri) throw new Error("MONGO_URI is missing in .env");
        await mongoose.connect(mongoUri);
        console.log("[DATABASE] MongoDB Online.");
    } catch (err) {
        console.error("[DATABASE] Error: " + err.message);
    }

    const client = new Client({ 
        intents: [
            GatewayIntentBits.Guilds, 
            GatewayIntentBits.GuildMessages, 
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.GuildMembers
        ] 
    });

    const isTeam = (member) => member.roles.cache.some(r => r.name.toLowerCase().includes('team'));

    client.once('ready', () => {
        console.log(`[DEDSEC] ${config.botName} online.`);
        client.user.setActivity(config.activity);
    });

    // ROLLEN SETUP
    client.on('guildCreate', async (guild) => {
        let teamRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('team'));
        if (!teamRole) await guild.roles.create({ name: 'Team' });

        let trustedRole = guild.roles.cache.find(r => r.name === 'Trusted');
        if (!trustedRole) trustedRole = await guild.roles.create({ name: 'Trusted' });
        
        const me = await guild.members.fetchMe();
        await me.roles.add(trustedRole).catch(() => {});
    });

    // PING & ANTI-SPAM
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (!isTeam(message.member)) {
            const now = Date.now();
            if (!spamMap.has(message.author.id)) spamMap.set(message.author.id, []);
            const times = spamMap.get(message.author.id);
            times.push(now);
            const recent = times.filter(t => t > now - 5000);
            spamMap.set(message.author.id, recent);
            if (recent.length > 3) return message.delete().catch(() => {});
        }

        if (message.content === config.prefix + 'ping') {
            const sent = await message.reply('Calcul...");
            const embed = new EmbedBuilder()
                .setColor('#00BFFF')
                .setTitle('Ping Informations')
                .setDescription(`Delay: ${sent.createdTimestamp - message.createdTimestamp}ms\nAPI: ${Math.round(client.ws.ping)}ms`);
            await sent.edit({ content: 'Pong!', embeds: [embed] });
        }
    });

    // ANTI-NUKE
    const nukeCheck = async (guild, type) => {
        const audit = await guild.fetchAuditLogs({ limit: 1, type: type });
        const entry = audit.entries.first();
        if (!entry) return;
        const executor = await guild.members.fetch(entry.executorId);
        if (executor.user.bot) {
            const trusted = guild.roles.cache.find(r => r.name === 'Trusted');
            if (!executor.roles.cache.has(trusted?.id)) {
                await executor.kick("Anti-Nuke");
            }
        }
    };

    client.on('channelDelete', (ch) => nukeCheck(ch.guild, AuditLogEvent.ChannelDelete));
    client.on('roleDelete', (r) => nukeCheck(r.guild, AuditLogEvent.RoleDelete));

    // MONGODB LOGGING
    client.on('guildAuditLogEntryCreate', async (entry, guild) => {
        try {
            const user = await client.users.fetch(entry.executorId);
            await AuditLog.create({
                guildId: guild.id,
                userId: entry.executorId,
                username: user.tag,
                action: "Action " + entry.action,
                reason: entry.reason || "None"
            });
        } catch (e) { }
    });

    client.login(token);
}

module.exports = { initializeBot };
