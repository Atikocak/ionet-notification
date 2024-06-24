const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs").promises;

async function getSubscriptionData() {
    const data = await fs.readFile("./db/subscriptionData.json", "utf8");
    return JSON.parse(data);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("my-subscriptions")
        .setDescription("List your subscriptions"),
    async execute(interaction) {
        const userId = interaction.user.id;
        const subscriptionData = await getSubscriptionData();
        const userSubscription = subscriptionData.find(
            (sub) => sub.discordId === userId
        );
        if (userSubscription) {
            await interaction.reply({
                content: `Your subscriptions: ${userSubscription.subscriptions.join(
                    ", "
                )}`,
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: "You do not have any subscriptions.",
                ephemeral: true,
            });
        }
    },
};
