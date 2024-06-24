const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../../db/subscriptionData.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("subscribe")
        .setDescription(
            "Subscribe to get notifications for your device status updates on IOnet"
        )
        .addStringOption((option) =>
            option
                .setName("deviceid")
                .setDescription("The device id you want to subscribe")
                .setRequired(true)
        ),
    async execute(interaction) {
        const userInput = interaction.options.get("deviceid").value;
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
        const userName = interaction.user.username;

        const deviceId = userInput;
        let subscriptionData;
        try {
            subscriptionData = JSON.parse(
                fs.readFileSync(filePath, { encoding: "utf8" })
            );
        } catch (error) {
            subscriptionData = [];
        }

        const userSubscription = subscriptionData.find(
            (sub) => sub.discordId === userId
        );
        if (userSubscription) {
            if (userSubscription.subscriptions.includes(deviceId)) {
                await interaction.reply({
                    content:
                        "Notification subscription has already been added for this device id.",
                    ephemeral: true,
                });
                return;
            }
            if (userSubscription.subscriptions.length >= 10) {
                await interaction.reply({
                    content:
                        "You have reached the limit of 10 subscriptions. You cannot add more.",
                    ephemeral: true,
                });
                return;
            }
            userSubscription.subscriptions.push(deviceId);
        } else {
            subscriptionData.push({
                discordId: userId,
                subscriptions: [deviceId],
            });
        }

        fs.writeFileSync(filePath, JSON.stringify(subscriptionData, null, 2));
        await interaction.reply({
            content: "Successfully added. Device id: " + deviceId,
            ephemeral: true,
        });
    },
};
