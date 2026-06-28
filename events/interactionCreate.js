const { Events, MessageFlags } = require("discord.js");

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(
                interaction.commandName,
            );

            if (!command) {
                console.error(
                    `No command matching ${interaction.commandName} was found.`,
                );
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        flags: [MessageFlags.Ephemeral],
                        content: `There was an error with this command!\`\`\`${error.toString()}\`\`\``,
                    });
                } else {
                    await interaction.reply({
                        flags: [MessageFlags.Ephemeral],
                        content: `There was an error with this command!\`\`\`${error.toString()}\`\`\``,
                    });
                }
            }
        } else if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(
                interaction.commandName,
            );

            if (!command) {
                console.error(
                    `No command matching ${interaction.commandName} was found.`,
                );
                return;
            }

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(error);
            }
        } else if (interaction.isModalSubmit()) {
            // Route modal submissions to werewolf command if applicable
            if (interaction.customId.startsWith("werewolf-")) {
                const command = interaction.client.commands.get("werewolf");
                if (command && command.modalSubmit) {
                    try {
                        await command.modalSubmit(interaction);
                    } catch (error) {
                        console.error(error);
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp({
                                flags: [MessageFlags.Ephemeral],
                                content: `There was an error with this modal!\`\`\`${error.toString()}\`\`\``,
                            });
                        } else {
                            await interaction.reply({
                                flags: [MessageFlags.Ephemeral],
                                content: `There was an error with this modal!\`\`\`${error.toString()}\`\`\``,
                            });
                        }
                    }
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith("werewolf-")) {
                const command = interaction.client.commands.get("werewolf");
                if (command && command.buttonInteraction) {
                    try {
                        await command.buttonInteraction(interaction);
                    } catch (error) {
                        console.error(error);
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp({
                                flags: [MessageFlags.Ephemeral],
                                content: `There was an error with this button!\`\`\`${error.toString()}\`\`\``,
                            });
                        } else {
                            await interaction.reply({
                                flags: [MessageFlags.Ephemeral],
                                content: `There was an error with this button!\`\`\`${error.toString()}\`\`\``,
                            });
                        }
                    }
                }
            }
        }
    },
};
