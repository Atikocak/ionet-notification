const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs").promises;
const path = require("path");

const subscriptionDataPath = path.join(
    __dirname,
    "../..",
    "db",
    "subscriptionData.json"
);
const workerDataPath = path.join(__dirname, "../..", "db", "workerData.json");

async function getSubscriptionData(userId) {
    const data = await fs.readFile(subscriptionDataPath, "utf8");
    const subscriptions = JSON.parse(data);

    const userSubscriptions = subscriptions.find(
        (sub) => sub.discordId === userId
    );
    return userSubscriptions;
}

async function getWorkerData() {
    const data = await fs.readFile(workerDataPath, "utf8");
    return JSON.parse(data);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("show-status")
        .setDescription("Shows status of your workers"),
    async execute(interaction) {
        const subscriptionData = await getSubscriptionData(interaction.user.id);
        const workerData = await getWorkerData();

        if (!subscriptionData || subscriptionData.subscriptions.length === 0) {
            await interaction.reply({
                content: "You do not have any subscriptions.",
                ephemeral: true,
            });
            return;
        }

        let status = "";
        for (const deviceId of subscriptionData.subscriptions) {
            const worker = workerData.find((w) => w.device_id == deviceId);
            if (worker) {
                status += `Device ID: ${deviceId}\nStatus: ${worker.status}\n\n`;
            } else {
                status += `Device ID: ${deviceId}\nStatus: Not Found\n\n`;
            }
        }

        await interaction.reply({
            content: status,
            ephemeral: true,
        });
    },
};
