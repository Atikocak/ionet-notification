const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const subscriptionFilePath = path.join(
    __dirname,
    "../../db/subscriptionData.json"
);
const serverSettingsFilePath = path.join(
    __dirname,
    "../../db/serverSettings.json"
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("subscribe")
        .setDescription(
            "Subscribe to get notifications for your device status updates on IOnet"
        )
        .addStringOption((option) =>
            option
                .setName("device-id")
                .setDescription("The device id you want to subscribe")
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

        const guildId = interaction.guild.id;

        // Check server settings to find the channel to send the message
        let serverSettings;
        try {
            serverSettings = JSON.parse(
                fs.readFileSync(serverSettingsFilePath, { encoding: "utf8" })
            );
        } catch (error) {
            serverSettings = {};
        }

        const channelId = serverSettings[guildId];
        if (!channelId) {
            await interaction.reply({
                content:
                    "ERROR: No notification channel has been set for this server. Please ask the server administrator to set a notification channel before subscribing.",
                ephemeral: true,
            });
            return;
        }

        // Subscription logic continues here if a channel is set...
        const userId = interaction.user.id;
        const deviceId = userInput;

        let subscriptionData;
        try {
            subscriptionData = JSON.parse(
                fs.readFileSync(subscriptionFilePath, { encoding: "utf8" })
            );
        } catch (error) {
            subscriptionData = [];
        }

        const userSubscription = subscriptionData.find(
            (sub) => sub.discordId === userId && sub.guildId === guildId
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
                guildId: guildId,
                subscriptions: [deviceId],
            });
        }

        fs.writeFileSync(
            subscriptionFilePath,
            JSON.stringify(subscriptionData, null, 2)
        );

        await interaction.reply({
            content: `Successfully subscribed to device ID: ${deviceId}. Notifications will be sent in the <#${channelId}> channel.`,
            ephemeral: true,
        });
    },
};
