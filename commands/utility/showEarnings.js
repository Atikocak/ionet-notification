const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
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
        .setName("show-earnings")
        .setDescription("Shows earnings summary of your workers"),
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

        // Create an embed to display the earnings summary
        const earningsEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Earnings Summary")
            .setAuthor({
                name: "IOnet",
                iconURL: "https://i.ibb.co/5kh8f9r/ionetlogo.png",
                url: "https://ionet.io/",
            })
            .setDescription("Here is the summary of your workers earnings")
            .setImage({
                url: "https://files.readme.io/4aa7b4b-111.png",
            })
            .setTimestamp()
            .setFooter({
                text: "This bot has been made for public use by Atibaba",
            });

        let deviceMessages = "";
        let totalEarnings = 0;
        for (const deviceId of subscriptionData.subscriptions) {
            const worker = workerData.find((w) => w.device_id == deviceId);
            if (worker) {
                deviceMessages += worker.message;
                totalEarnings += parseFloat(worker.totalRevenue);
                earningsEmbed.addField({
                    name: `Worker ID: ${worker.device_id}`,
                    value: `Status: ${worker.status}\n${deviceMessages}`,
                    inline: false,
                });
            }
        }

        if (deviceMessages === "") {
            await interaction.reply({
                content: "No workers found.",
                ephemeral: true,
            });
            return;
        }

        earningsEmbed.addField({
            name: "TOTAL REVENUE",
            value: `${totalEarnings} $IO`,
            inline: false,
        });

        await interaction.reply({
            embeds: [earningsEmbed],
            ephemeral: true,
        });
    },
};
