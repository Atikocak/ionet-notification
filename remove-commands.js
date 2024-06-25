const { REST, Routes } = require("discord.js");
const { clientId, token, commandIdToRemove, guildId } = require("./config");

const rest = new REST({ version: "10" }).setToken(token);

// Remove global slash command
const commandId = commandIdToRemove;
const removeGlobalCommand = async () => {
    try {
        console.log(
            `Started removing global application "${commandId}" command..`
        );

        const data = await rest.delete(
            Routes.applicationCommand(clientId, commandId)
        );

        console.log(
            `Successfully removed global application "${commandId}" command..`
        );
        console.log(data);
    } catch (error) {
        console.error(error);
    }
};

removeGlobalCommand();
