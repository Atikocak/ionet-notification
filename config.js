require("dotenv").config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    apiUrl: process.env.API_URL,
    apiUrl2: process.env.API_URL2,
    apiToken: process.env.API_TOKEN,
    commandIdToRemove: process.env.COMMAND_ID_TO_REMOVE,
};
