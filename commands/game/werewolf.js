const {
	SlashCommandBuilder,
	MessageFlags,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	ContainerBuilder,
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
	CheckboxBuilder,
	CheckboxGroupBuilder,
	LabelBuilder,
	SectionBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const { tooltip, playGame, nameplate } = require("../../functions.js");
const { roles, teams } = require("../../data.js");

function getSortedRoleNames() {
	return [...roles]
		.filter((_, index) => index !== 11)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((role) => `${role.icon} ${role.name}`)
		.join("\n");
}

function findRoleByName(roleName) {
	const normalized = roleName.trim().toLowerCase();
	return roles.find((role) => role.name.toLowerCase() === normalized || (role.aka && role.aka.some((alias) => alias.toLowerCase() === normalized)));
}

function roleDetails(role, interaction) {
	let roleinfo = "";
	let team = teams.find((x) => x.id === role.team);
	roleinfo += `## ${role.icon || "😶"} ${role.name || "Unknown Role"}\n`;
	roleinfo += `**Team: ${team?.icon || "🚫"}`;
	if (team?.desc) {
		roleinfo += ` ${tooltip(team?.name || "Unaligned", team?.desc, interaction)}**\n`;
	} else {
		roleinfo += ` ${team?.name || "Unaligned"}**\n`;
	}
	roleinfo += `${role.desc || "Nothing special"}\n`;
	if (role.aka[1]) {
		roleinfo += `-# aka ${role.aka?.join(", ")}\n`;
	}

	return roleinfo;
}

function getSortedTeamNames() {
	return [...teams]
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((team) => `${team.icon} ${team.name}`)
		.join("\n");
}

function findTeamByName(teamName) {
	const normalized = teamName.trim().toLowerCase();
	return teams.find((team) => team.name.toLowerCase() === normalized);
}

function teamDetails(team) {
	return `## ${team.icon || "❓"} ${team.name}\n${team.desc || "No description available."}\n`;
}

async function handleRoleInfo(interaction) {
	const roleListContainer = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent("### Roles"))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

	const roleInfoContainer = new ContainerBuilder();

	const rolestring = interaction.options.getString("role")?.trim() ?? "";

	if (!rolestring) {
		// Role list
		roleListContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(getSortedRoleNames()));
		await interaction.reply({
			flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
			components: [roleListContainer],
		});
	} else {
		const role = findRoleByName(rolestring);

		if (!role) {
			// Failed to find role
			roleListContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# I couldn't find a role named "${rolestring}"!`));
			await interaction.reply({
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
				components: [roleListContainer],
			});
		} else {
			// Role details
			roleInfoContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(roleDetails(role, interaction)));
			await interaction.reply({
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
				components: [roleInfoContainer],
			});
		}
	}
}

async function handleTeamInfo(interaction) {
	const teamListContainer = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent("### Teams"))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

	const teamInfoContainer = new ContainerBuilder();
	const teamString = interaction.options.getString("team")?.trim() ?? "";

	if (!teamString) {
		teamListContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(getSortedTeamNames()));
		await interaction.reply({
			flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
			components: [teamListContainer],
		});
	} else {
		const team = findTeamByName(teamString);

		if (!team) {
			teamListContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# I couldn't find a team named "${teamString}"!`));
			await interaction.reply({
				flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
				components: [teamListContainer],
			});
		} else {
			teamInfoContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(teamDetails(team)));
			await interaction.reply({
				flags: [MessageFlags.IsComponentsV2],
				components: [teamInfoContainer],
			});
		}
	}
}

async function showSetupModal(interaction) {
	const setupModal = new ModalBuilder().setCustomId("werewolf-setup").setTitle("Game Setup");

	setupModal.addComponents(
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("roles")
				.setLabel("Roles (comma-separated)")
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder("Villager, Werewolf, Seer")
				.setRequired(true),
		),
	);

	setupModal.addLabelComponents(
		new LabelBuilder({
			label: "Prevent inaction",
			description: "Make a choice for players if they don't respond in time",
		}).setCheckboxComponent(new CheckboxBuilder().setCustomId("prevent-inaction")),
	);

	setupModal.addComponents(
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("center-cards-count")
				.setLabel("Number of Center Cards")
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("3")
				.setRequired(false),
		),
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("action-seconds")
				.setLabel("Seconds per Action")
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("15")
				.setRequired(false),
		),
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId("voting-time")
				.setLabel("Voting Time (minutes)")
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("5")
				.setRequired(false),
		),
	);

	await interaction.showModal(setupModal);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName("werewolf")
		.setDescription("See details on a role or team in Werewolf, or a list of them all")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("role")
				.setDescription("See details on a role in Werewolf, or a list of them all")
				.addStringOption((option) =>
					option.setName("role").setDescription("The role to view details of (if left empty, see a list of all roles)").setAutocomplete(true),
				),
		)
		.addSubcommand((subcommand) => subcommand.setName("start").setDescription("Start a game")),
	async execute(interaction) {
		const sub = interaction.options.getSubcommand();

		switch (sub) {
			case "role":
				await handleRoleInfo(interaction);
				break;
			case "start":
				await showSetupModal(interaction);
				break;
			case "team":
				await handleTeamInfo(interaction);
				break;
			default:
				await interaction.reply({
					content: "Unknown subcommand",
					flags: [MessageFlags.Ephemeral],
				});
		}
	},
	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		const query = String(focusedOption.value ?? "").toLowerCase();

		if (focusedOption.name === "role") {
			const filtered = roles
				.filter((_, index) => index !== 11)
				.filter((role) => role.name.toLowerCase().includes(query) || (role.aka && role.aka.some((alias) => alias.toLowerCase().includes(query))))
				.slice(0, 25);
			const choices = filtered.map((role) => ({
				name: `${role.icon} ${role.name}`,
				value: role.name,
			}));
			await interaction.respond(choices);
		} else if (focusedOption.name === "team") {
			const filtered = teams.filter((team) => team.name.toLowerCase().includes(query)).slice(0, 25);
			const choices = filtered.map((team) => ({
				name: `${team.icon} ${team.name}`,
				value: team.name,
			}));
			await interaction.respond(choices);
		}
	},
	async modalSubmit(interaction) {
		if (interaction.customId === "werewolf-setup") {
			const rolesInput = interaction.fields.getTextInputValue("roles");
			const roleNames = rolesInput
				.split(",")
				.map((role) => role.trim())
				.filter((role) => role.length > 0);

			const rolesList = roleNames
				.map((roleName) => {
					const index = roles.findIndex(
						(r) =>
							r.name.toLowerCase() === roleName.toLowerCase() || (r.aka && r.aka.some((alias) => alias.toLowerCase() === roleName.toLowerCase())),
					);
					return index !== -1 ? index : null;
				})
				.filter((index) => index !== null);

			const counts = {};
			for (const index of rolesList) {
				counts[index] = (counts[index] || 0) + 1;

				const roleConfig = roles[index];
				if (roleConfig.maxAllowed !== undefined && counts[index] > roleConfig.maxAllowed) {
					await interaction.reply({
						content: `❌ Too many copies of the ${nameplate(roleConfig)} role! This game setup includes ${counts[index]} copies, but the maximum allowed for this role is ${roleConfig.maxAllowed}.`,
						flags: [MessageFlags.Ephemeral],
					});
					return;
				}
			}

			const preventInaction = interaction.fields.getCheckbox("prevent-inaction") || false;
			const centerCardsCount = parseInt(interaction.fields.getTextInputValue("center-cards-count") || "3", 10);
			const actionSeconds = parseInt(interaction.fields.getTextInputValue("action-seconds") || "15", 10);
			const votingTime = parseInt(interaction.fields.getTextInputValue("voting-time") || "5", 10);

			const gameSettings = {
				roles: rolesList,
				preventInaction,
				centerCardsCount,
				actionSeconds,
				votingTime,
				endOnAllVotes: true,
			};

			const roleIcons = rolesList.map((index) => roles[index].icon || "😶");

			if (rolesList.length - centerCardsCount < 1) {
				await interaction.reply({
					content: `❌ Not enough roles for the specified number of center cards. (${rolesList.length} role${rolesList.length !== 1 ? "s" : ""}, ${centerCardsCount} center card${centerCardsCount !== 1 ? "s" : ""})`,
					flags: [MessageFlags.Ephemeral],
				});
				return;
			}

			if (rolesList.length > 24) {
				await interaction.reply({
					content: `❌ Too many roles (${rolesList.length}). Maximum number of roles is 24.`,
					flags: [MessageFlags.Ephemeral],
				});
				return;
			}

			if (centerCardsCount < 1) {
				await interaction.reply({
					content: `❌ You must play with at least one center card.`,
					flags: [MessageFlags.Ephemeral],
				});
				return;
			}

			const playerCount = rolesList.length - centerCardsCount;

			let joinButton = new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Join").setCustomId("werewolf-join-setup");

			let cancelButton = new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Cancel").setCustomId("werewolf-cancel-setup");

			const startingsooncontainer = new ContainerBuilder()
				.addSectionComponents(
					new SectionBuilder().setButtonAccessory(cancelButton).addTextDisplayComponents(new TextDisplayBuilder().setContent("## Starting soon")),
				)
				.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${roleIcons.join("")}`))
				.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
				.addSectionComponents(
					new SectionBuilder()
						.setButtonAccessory(joinButton)
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent(
								`Press to join! Need ${playerCount} players\n-# ${centerCardsCount} center cards • Actions are${preventInaction ? "" : " not"} forced • ${actionSeconds} seconds per turn`,
							),
						),
				);

			await interaction.reply({
				components: [startingsooncontainer],
				flags: [MessageFlags.IsComponentsV2],
			});

			const startMessage = await interaction.fetchReply();

			if (!interaction.client.gamesSessions) {
				interaction.client.gamesSessions = new Map();
			}

			interaction.client.gamesSessions.set(startMessage.id, {
				messageId: startMessage.id,
				gameSettings,
				playerCount,
				joinedUsers: new Set(),
				thresholdReached: false,
				channelId: interaction.channel.id,
				ownerId: interaction.user.id,
			});
		}
	},
	async buttonInteraction(interaction) {
		switch (interaction.customId) {
			case "werewolf-join-setup": {
				let joinButton = new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Join").setCustomId("werewolf-join-setup");
				let cancelButton = new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Cancel").setCustomId("werewolf-cancel-setup");

				const gameSession = interaction.client.gamesSessions?.get(interaction.message.id);

				if (!gameSession) {
					await interaction.reply({
						content: "This game session is no longer active.",
						flags: [MessageFlags.Ephemeral],
					});
					return;
				}

				const alreadyJoined = gameSession.joinedUsers.has(interaction.user.id);

				if (alreadyJoined) {
					await interaction.reply({
						content: "You've already joined!",
						flags: [MessageFlags.Ephemeral],
					});
					return;
				}

				gameSession.joinedUsers.add(interaction.user);
				const currentCount = gameSession.joinedUsers.size;
				const playerNeeded = gameSession.playerCount;

				await interaction.reply({
					content: `✅ You've joined! (${currentCount}/${playerNeeded})`,
					flags: [MessageFlags.Ephemeral],
				});

				if (currentCount >= playerNeeded) {
					cancelButton.setDisabled(true);
					joinButton.setDisabled(true);
				}

				try {
					const message = await interaction.channel.messages.fetch(gameSession.messageId);

					const mentionList =
						Array.from(gameSession.joinedUsers)
							.map((user) => `<@${user.id}>`)
							.join(" ") || "No players yet.";

					const updatedContainer = new ContainerBuilder()
						.addSectionComponents(
							new SectionBuilder()
								.setButtonAccessory(cancelButton)
								.addTextDisplayComponents(new TextDisplayBuilder().setContent("## Starting soon")),
						)
						.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent(`## ${gameSession.gameSettings.roles.map((i) => roles[i]?.icon || "😶").join("")}`),
						)
						.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
						.addSectionComponents(
							new SectionBuilder()
								.setButtonAccessory(joinButton)
								.addTextDisplayComponents(
									new TextDisplayBuilder().setContent(
										`Players (${Array.from(gameSession.joinedUsers).length}/${gameSession.playerCount}): ${mentionList}\n-# ${gameSession.gameSettings.centerCardsCount} center cards • Actions are${gameSession.gameSettings.preventInaction ? "" : " not"} forced • ${gameSession.gameSettings.actionSeconds} seconds per turn`,
									),
								),
						);

					await message.edit({ components: [updatedContainer] });
				} catch (err) {
					console.error("Could not update join message:", err);
				}

				if (!gameSession.thresholdReached && currentCount >= playerNeeded) {
					gameSession.thresholdReached = true;

					const gameContainer = new ContainerBuilder()
						.addTextDisplayComponents(new TextDisplayBuilder().setContent("## Night phase"))
						.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

					const newmessage = await interaction.followUp({
						components: [gameContainer],
						flags: [MessageFlags.IsComponentsV2],
					});

					gameSession.players = Array.from(gameSession.joinedUsers).map((user, index) => ({
						playerId: index,
						icon: "👤",
						name: user.globalName,
						user: user,
					}));
					gameSession.messageId = newmessage.id;

					await playGame(interaction, gameSession);
				}
				break;
			}
			case "werewolf-cancel-setup": {
				const gameSession = interaction.client.gamesSessions?.get(
					interaction.message.id,
				);

				if (!gameSession) {
					await interaction.reply({
						content: "This game session is no longer active.",
						flags: [MessageFlags.Ephemeral],
					});
					return;
				}

				if (interaction.user.id !== gameSession.ownerId) {
					await interaction.reply({
						content: "Only the game creator can cancel this setup.",
						flags: [MessageFlags.Ephemeral],
					});
					return;
				}

				try {
					const channel = await interaction.client.channels.fetch(gameSession.channelId);
					const message = await channel.messages.fetch(gameSession.messageId);

					const cancelledContainer = new ContainerBuilder()
						.addTextDisplayComponents(new TextDisplayBuilder().setContent("## Game Cancelled"))
						.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
						.addTextDisplayComponents(new TextDisplayBuilder().setContent(`This game invite was cancelled by <@${interaction.user.id}>.`));

					await message.edit({ components: [cancelledContainer] });
					interaction.client.gamesSessions.delete(gameSession.messageId);
					await interaction.reply({
						content: "Game cancelled.",
						flags: [MessageFlags.Ephemeral],
					});
				} catch (err) {
					console.error("Could not cancel game session:", err);
					await interaction.reply({
						content: "Failed to cancel.",
						flags: [MessageFlags.Ephemeral],
					});
				}
				break;
			}
			default:
				return;
		}
	},
};
