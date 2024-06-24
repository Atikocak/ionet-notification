const { REST, Routes } = require("discord.js");
const { clientId, guildId, token } = require("./config");
const fs = require("fs");
const path = require("path");

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const folderPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(folderPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(folderPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));
    // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            commands.push(command.data.toJSON());
        } else {
            console.error(
                `The command at ${filePath} is missing a required "data" or "execute" property.`
            );
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: "10" }).setToken(token);

// and deploy your commands!
const deployCommands = async () => {
    try {
        console.log("Started refreshing application (/) commands.");

        // guildIds.forEach(async (guildId) => {
        //     const data = await rest.put(
        //         Routes.applicationGuildCommands(clientId, guildId),
        //         {
        //             body: commands,
        //         }
        //     );
        // });

        // The put method is used to fully refresh all commands in the guild with the current set
        console.log(guildId);
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            {
                body: commands,
            }
        );

        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
};

deployCommands();
