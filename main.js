const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const schedule = require("node-schedule");
const fs = require("fs");
const path = require("path");
const { token } = require("./config");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});
client.commands = new Collection();

const folderPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(folderPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(folderPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.error(
                `The command at ${filePath} is missing a required "data" or "execute" property.`
            );
        }
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`No command found for ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.reply({
                content: "There was an error while executing this command!",
                ephemeral: true,
            });
        }
    }
});

client.on("ready", async () => {
    console.log(`Login as ${client.user.tag} successful!`);
    schedule.scheduleJob("*/10 * * * *", async function () {
        await checkWorkersStatus();
    });
});

async function checkWorkersStatus() {
    const workersData = fs.readFileSync("./db/workerData.json", {
        encoding: "utf-8",
    });
    const workers = JSON.parse(workersData);
    const subscriptionDataPath = "./db/subscriptionData.json";
    // Create the subscription db directory if it doesn't exist
    if (!fs.existsSync(subscriptionDataPath)) {
        fs.writeFileSync(subscriptionDataPath, JSON.stringify([]));
    }
    const subscriptionDataRaw = fs.readFileSync(subscriptionDataPath, {
        encoding: "utf-8",
    });
    const subscriptionData = JSON.parse(subscriptionDataRaw);
    const channelId = "1254871677024866415"; // Sabit kanal ID'si

    // Notify users with the given discordIds
    async function notifyUsers(discordIds, message) {
        const channel = await client.channels.fetch(channelId);
        discordIds.forEach(async (discordId) => {
            try {
                await channel.send(`<@${discordId}> ${message}`);
            } catch (error) {
                console.error(`Error sending message to ${discordId}:`, error);
            }
        });
    }

    for (const worker of workers) {
        if (worker.status !== "up") {
            const discordIds = subscriptionData
                .filter((sub) => sub.subscriptions.includes(worker.device_id))
                .map((sub) => sub.discordId);

            if (discordIds.length > 0) {
                const message = `Worker ID: ${worker.device_id} - Status: ${worker.status}`;
                await notifyUsers(discordIds, message);
            }
        }
    }
}

const main = async () => {
    try {
        client.login(token);
    } catch (error) {
        console.error("Login error:", error);
    }
};

main();
