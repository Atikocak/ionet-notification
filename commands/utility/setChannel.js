const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../../db/serverSettings.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("set-channel")
        .setDescription("Sets the channel for bot notifications.")
        .addChannelOption((option) =>
            option
                .setName("channel-id")
                .setDescription("The channel to set for notifications")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Check if the user has admin permissions
        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            )
        ) {
            await interaction.reply({
                content:
                    "You have not required permission. You need admin privileges at least to use this command",
                ephemeral: true,
            });
            return;
        }

        const channelOption = interaction.options.getChannel("channel-id");
        if (
            !channelOption ||
            !interaction.guild.channels.cache.has(channelOption.id)
        ) {
            await interaction.reply({
                content:
                    "You have entered an invalid channel. Please register a valid channel which should be a text channel in this discord server.",
                ephemeral: true,
            });
            return;
        }
        const channelId = channelOption.id;
        const serverId = interaction.guild.id;

        // Ensure the settings file exists
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
        }

        // Read the current settings
        const settings = JSON.parse(fs.readFileSync(filePath, "utf8"));
        settings[serverId] = channelId;

        // Write the updated settings back to the file
        fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));

        await interaction.reply({
            content: "Channel updated successfully.",
            ephemeral: true,
        });
    },
};
