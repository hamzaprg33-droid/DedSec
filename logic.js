const { Client, GatewayIntentBits, EmbedBuilder, Collection, AuditLogEvent } = require('discord.js');
const mongoose = require('mongoose');

// Datenbank-Schema definieren
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

async function initializeBot(config, token) {
    // Verbindung zur Online-Datenbank herstellen
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("[DATABASE] Connected to MongoDB Atlas.");
    } catch (err) {
        console.error("[DATABASE] Connection failed:", err);
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
        console.log(`[SYSTEM] ${config.botName} initialized.`);
        client.user.setActivity(config.activity);
    });

    // 1. & 7. TEAM & TRUSTED ROLE SETUP
    client.on('guildCreate', async (guild) => {
        let teamRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('team'));
        if (!teamRole) await guild.roles.create({ name: 'Team', reason: 'Auto-Setup' });

        let trustedRole = guild.roles.cache.find(r => r.name === 'Trusted');
        if (!trustedRole) trustedRole = await guild.roles.create({ name: 'Trusted', reason: 'Anti-Nuke' });
        
        const me = await guild.members.fetchMe();
        await me.roles.add(trustedRole);
    });

    // 2. PING & 3. ANTI-SPAM
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Anti-Spam (Ignoriert Team)
        if (!isTeam(message.member)) {
            const now = Date.now();
            if (!spamMap.has(message.author.id)) spamMap.set(message.author.id, []);
            const times = spamMap.get(message.author.id);
            times.push(now);
            const recent = times.filter(t => t > now - 5000);
            spamMap.set(message.author.id, recent);

            if (recent.length > 3) {
                return message.delete().catch(() => {});
            }
        }

        // Ping Command
        if (message.content === config.prefix + 'ping') {
            const sent = await message.reply('Calculating...');
            const embed = new EmbedBuilder()
                .setColor('#00BFFF')
                .setTitle('Ping Informations')
                .setDescription(`Latency: ${sent.createdTimestamp - message.createdTimestamp}ms\nAPI: ${Math.round(client.ws.ping)}ms`);
            await sent.edit({ content: 'Pong!', embeds: [embed] });
        }

        // 6. SERVER LOGS COMMAND
        if (message.content.startsWith(config.prefix + 'serverlogs')) {
            if (!isTeam(message.member)) return message.reply("Access Denied.");
            
            const args = message.content.split(' ');
            let filter = { guildId: message.guild.id };
            
            if (args[1]) filter.username = new RegExp(args[1], 'i');

            const results = await AuditLog.find(filter).sort({ date: -1 }).limit(10);
            const logString = results.map(l => `[${l.date.toISOString().split('T')[0]}] ${l.username}: ${l.action}`).join('\n');
            
            message.channel.send(`**Audit Backup:**\n\`\`\`${logString || 'No data found'}\`\`\``);
        }
    });

    // 5. ANTI-NUKE
    const nukeCheck = async (guild, actionType) => {
        const audit = await guild.fetchAuditLogs({ limit: 1, type: actionType });
        const entry = audit.entries.first();
        if (!entry) return;

        const executor = await guild.members.fetch(entry.executorId);
        if (executor.user.bot) {
            const trusted = guild.roles.cache.find(r => r.name === 'Trusted');
            if (!executor.roles.cache.has(trusted?.id)) {
                await executor.kick("Anti-Nuke Detection");
            }
        }
    };

    client.on('channelDelete', (ch) => nukeCheck(ch.guild, AuditLogEvent.ChannelDelete));
    client.on('roleDelete', (r) => nukeCheck(r.guild, AuditLogEvent.RoleDelete));

    // 6. AUDIT LOG BACKUP TO MONGODB
    client.on('guildAuditLogEntryCreate', async (entry, guild) => {
        await AuditLog.create({
            guildId: guild.id,
            userId: entry.executorId,
            username: (await client.users.fetch(entry.executorId)).tag,
            action: AuditLogEvent[entry.action] || "Unknown Action",
            reason: entry.reason || "No reason"
        });
    });

    client.login(token);
}

module.exports = { initializeBot };
