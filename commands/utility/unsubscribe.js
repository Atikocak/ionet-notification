const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs").promises;
const path = require("path");

const subscriptionDataPath = path.join(
    __dirname,
    "../..",
    "db",
    "subscriptionData.json"
);

async function getSubscriptionData() {
    const data = await fs.readFile(subscriptionDataPath, "utf8");
    return JSON.parse(data);
}

async function saveSubscriptionData(data) {
    await fs.writeFile(subscriptionDataPath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unsubscribe")
        .setDescription("Unsubscribe to stop receiving notifications")
        .addStringOption((option) =>
            option
                .setName("device-id")
                .setDescription("The device id you want to unsubscribe")
                .setRequired(true)
        ),
    async execute(interaction) {
        const userInput = interaction.options.getString("device-id");
        if (!userInput) {
            await interaction.reply({
                content: "Please enter a device id.",
                ephemeral: true,
            });
            return;
        } else if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                userInput
            )
        ) {
            await interaction.reply({
                content:
                    "You entered the device id information in the wrong format. Please enter in the correct format. Example: 123e4567-e89b-12d3-a456-426614174000",
                ephemeral: true,
            });
            return;
        }
        const userId = interaction.user.id;
        const deviceId = userInput;
        const subscriptionData = await getSubscriptionData();
        const userSubscriptionIndex = subscriptionData.findIndex(
            (sub) => sub.discordId === userId
        );

        if (userSubscriptionIndex !== -1) {
            const deviceIndex =
                subscriptionData[userSubscriptionIndex].subscriptions.indexOf(
                    deviceId
                );
            if (deviceIndex === -1) {
                await interaction.reply({
                    content: "You do not have a subscription for this device.",
                    ephemeral: true,
                });
                return;
            }
            subscriptionData[userSubscriptionIndex].subscriptions.splice(
                deviceIndex,
                1
            );
            if (
                subscriptionData[userSubscriptionIndex].subscriptions.length ===
                0
            ) {
                // Remove the user from the subscription data if they have no subscriptions left
                subscriptionData.splice(userSubscriptionIndex, 1);
            }
            try {
                await saveSubscriptionData(subscriptionData);
                await interaction.reply({
                    content:
                        "Successfully unsubscribed. Device id: " + deviceId,
                    ephemeral: true,
                });
            } catch (err) {
                console.error("JSON dosyasına yazma hatası:", err);
            }
        } else {
            await interaction.reply({
                content: "You do not have any subscriptions.",
                ephemeral: true,
            });
        }
    },
};
