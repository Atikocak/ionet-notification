const { REST, Routes } = require("discord.js");
const { clientId, guildIds, token, commandIdToRemove } = require("./config");

const rest = new REST({ version: "10" }).setToken(token);

// Remove global slash command
const commandName = "subscribe";
const commandId = commandIdToRemove;
const removeGlobalCommands = async () => {
    try {
        console.log(
            `Started removing global application "${commandName}" command..`
        );

        const data = await rest.delete(
            Routes.applicationCommand(clientId, commandId)
        );

        console.log(
            `Successfully removed global application "${commandName}" command..`
        );
        console.log(data);
    } catch (error) {
        console.error(error);
    }
};

await removeGlobalCommands();
