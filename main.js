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

async function loadServerSettings() {
    try {
        const serverSettingsPath = path.join(
            __dirname,
            "./db/serverSettings.json"
        );
        await fs.promises.access(serverSettingsPath);
        const data = await fs.promises.readFile(serverSettingsPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Server settings could not be loaded:", error);
        return {};
    }
}

// Load all commands and store them in the client
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

// Handle command interactions
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

// Notify users about worker status every 1 minute
client.on("ready", async () => {
    console.log(`Login as ${client.user.tag} successful!`);
    schedule.scheduleJob("*/1 * * * *", async function () {
        await checkWorkersStatus();
    });
});

// Check worker status and notify users
async function checkWorkersStatus() {
    try {
        const workersData = await fs.promises.readFile("./db/workerData.json", {
            encoding: "utf-8",
        });
        const workers = JSON.parse(workersData);
        const subscriptionDataPath = "./db/subscriptionData.json";
        const subscriptionDataRaw = await fs.promises.readFile(
            subscriptionDataPath,
            { encoding: "utf-8" }
        );
        let subscriptionData = JSON.parse(subscriptionDataRaw);

        // Load server settings
        const settings = await loadServerSettings();

        for (const worker of workers) {
            // For each subscription, find the corresponding guildId and notify users
            for (const sub of subscriptionData) {
                if (sub.subscriptions.includes(worker.device_id)) {
                    const guildId = sub.guildId;
                    const discordId = sub.discordId;
                    const channelId = settings[guildId]; // Assuming settings structure is { "guildId": "channelId" }

                    // Check if lastNotifiedStatus exists and is different from current status
                    if (!sub.lastNotifiedStatus) {
                        sub.lastNotifiedStatus = {};
                    }
                    if (!sub.lastNotifiedStatus[worker.device_id]) {
                        sub.lastNotifiedStatus[worker.device_id] = {};
                    }

                    const lastStatus =
                        sub.lastNotifiedStatus[worker.device_id].status;
                    const lastChallenge =
                        sub.lastNotifiedStatus[worker.device_id]
                            .last_challenge_successful;

                    if (
                        lastStatus !== worker.status ||
                        lastChallenge !== worker.last_challenge_successful
                    ) {
                        if (channelId) {
                            try {
                                const channel = await client.channels.fetch(
                                    channelId
                                );
                                const message = `Worker ID: ${
                                    worker.device_id
                                } - Status: ${worker.status}, \nVerification: ${
                                    worker.last_challenge_successful
                                        ? "Success"
                                        : "Failed"
                                }`;
                                await channel.send(
                                    `<@${discordId}> ${message}`
                                );
                                // Update last notified status
                                sub.lastNotifiedStatus[
                                    worker.device_id
                                ].status = worker.status;
                                sub.lastNotifiedStatus[
                                    worker.device_id
                                ].last_challenge_successful =
                                    worker.last_challenge_successful;
                            } catch (error) {
                                console.error(
                                    `Error sending message to ${discordId}:`,
                                    error
                                );
                            }
                        }
                    }
                }
            }
        }
        // Save updated subscription data
        await fs.promises.writeFile(
            subscriptionDataPath,
            JSON.stringify(subscriptionData, null, 2)
        );
    } catch (error) {
        console.error("Error checking worker status:", error);
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
