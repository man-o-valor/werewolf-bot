const lodash = require("lodash");
const { roles, teams, turnOrder, nameplate } = require("./data.js");
const fs = require("fs");
const {
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	ContainerBuilder,
	MessageFlags,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	SectionBuilder,
} = require("discord.js");
const { join } = require("path");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tooltip(text, tt, interaction) {
	let url =
		interaction?.channel?.url ||
		(interaction?.channelId && interaction.guildId
			? `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}`
			: "https://discord.com/channels/@me");
	return `[${text}](${url} \"${tt.replaceAll("*", "")}\")`;
}

function timestamp(time = new Date(), format = "R") {
	return `<t:${Math.floor(time / 1000)}:${format}>`;
}

function joinInEnglish(arr = [], finale = "and") {
	if (arr.length == 0) {
		return "[empty list]";
	} else if (arr.length == 1) {
		return arr[0];
	}
	return arr.slice(0, -1).join(", ") + ` ${finale} ` + arr[arr.length - 1];
}

class GameCard {
	static nextGameId = 1;
	static roleCounts = {};

	constructor(id) {
		this.gameId = GameCard.nextGameId++;
		this.id = parseInt(id);
		this.icon = roles[this.id]?.icon;
		this.name = roles[this.id]?.name;
		this.desc = roles[this.id]?.desc;
		this.team = roles[this.id]?.team;

		if (GameCard.roleCounts[this.id] === undefined) {
			GameCard.roleCounts[this.id] = 0;
		}

		this.roleId = GameCard.roleCounts[this.id]++;
	}

	static resetSession() {
		GameCard.nextGameId = 1;
		GameCard.roleCounts = {};
	}
}

async function sayTo(users, title, content) {
	if (!Array.isArray(users)) {
		users = [users];
	}
	if (users.length === 0) {
		return;
	}
	console.log(`Saying something to ${joinInEnglish(users.map((item) => item.name))}.`);
	const sayToContainer = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
	for (let i = 0; i < users.length; i++) {
		users[i].user.send({
			components: [sayToContainer],
			flags: [MessageFlags.IsComponentsV2],
		});
	}
}

async function askQuestionTo(
	gameSession,
	userobj,
	title,
	content,
	options,
	hint = "Choose...",
	postcontent = "",
	timelimit = gameSession.gameSettings.actionSeconds,
	allowedAnswers = 1,
	forceAnswer = false,
) {
	console.log(`Asking something to ${userobj.name}.`);
	const questionRng = Math.floor(Math.random() * 100000);
	const dueTimestamp = Date.now() + 1000 * timelimit;

	const questionId = "question_" + userobj.user.id + "_" + questionRng;

	let questionDropdown = new StringSelectMenuBuilder().setCustomId(questionId).setPlaceholder(hint).setMaxValues(allowedAnswers);

	for (let i = 0; i < options.length; i++) {
		questionDropdown.addOptions(new StringSelectMenuOptionBuilder().setLabel(options[i].name).setEmoji(options[i].icon).setValue(i.toString()));
	}

	const askQuestionToContainer = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
		.addActionRowComponents(new ActionRowBuilder().addComponents(questionDropdown));
	if (postcontent != "") {
		askQuestionToContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(postcontent));
	}
	askQuestionToContainer
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# answer due <t:${Math.ceil(dueTimestamp / 1000)}:R>`));

	const questionDm = await userobj.user.send({
		components: [askQuestionToContainer],
		flags: [MessageFlags.IsComponentsV2],
	});

	const questionFilter = (interaction) => interaction.user.id === userobj.user.id && interaction.customId === questionId;

	try {
		const collectedInteraction = await questionDm.awaitMessageComponent({
			filter: questionFilter,
			time: 1000 * timelimit,
		});

		questionDropdown.setDisabled(true);
		questionDropdown.setPlaceholder(`You chose ${joinInEnglish(collectedInteraction.values.map((item) => options[parseInt(item)].name))}`);

		try {
			await collectedInteraction.update({
				components: [askQuestionToContainer],
			});
		} catch (editError) {
			console.error("Failed to disable components on answer:", editError);
		}
		let chosenAnswer = collectedInteraction.values.map((item) => parseInt(item));

		if (chosenAnswer.length == 1) {
			chosenAnswer = chosenAnswer[0];
		}

		return chosenAnswer;
	} catch (error) {
		let chosenAnswer;
		if (gameSession.gameSettings.preventInaction || forceAnswer) {
			chosenAnswer = Array.from({ length: options.length }, (_, i) => i)
				.sort(() => Math.random() - 0.5)
				.slice(0, allowedAnswers);
		}

		questionDropdown.setDisabled(true);
		questionDropdown.setPlaceholder(
			chosenAnswer !== undefined ? `The game chose ${joinInEnglish(chosenAnswer.map((item) => options[item].name))} for you` : "You didn't answer",
		);

		try {
			await questionDm.edit({
				components: [askQuestionToContainer],
			});
		} catch (editError) {
			console.error("Failed to disable components on timeout:", editError);
		}

		if (chosenAnswer?.length == 1) {
			chosenAnswer = chosenAnswer[0];
		}

		return chosenAnswer ?? null;
	}
}

function allAssumedCardsMatching(gameSession, center, team, id, playerId) {
	let matches = gameSession.players;
	if (team !== undefined) {
		matches = matches.filter((player) => player.assumedRole.team === team);
	}
	if (id !== undefined) {
		matches = matches.filter((player) => player.assumedRole.id === id);
	}
	if (center !== undefined) {
		if (center) {
			matches = matches.filter((player) => player.user === undefined);
		} else {
			matches = matches.filter((player) => player.user !== undefined);
		}
	}
	if (playerId !== undefined) {
		matches = matches.filter((player) => player.playerId === playerId);
	}
	return matches;
}

function allAssumedCardsExcluding(gameSession, team, id, playerId) {
	let matches = gameSession.players;
	if (team !== undefined) {
		matches = matches.filter((player) => player.assumedRole.team !== team);
	}
	if (id !== undefined) {
		matches = matches.filter((player) => player.assumedRole.id !== id);
	}
	if (playerId !== undefined) {
		matches = matches.filter((player) => player.playerId !== playerId);
	}
	return matches;
}

function swapCards(gameSession, swap1, swap2) {
	let holdCard = swap1.role;
	swap1.role = swap2.role;
	swap2.role = holdCard;
	return gameSession;
}

async function executeEvent(event, interaction, gameSession) {
	console.log(`Executing event ${event}`);
	const players = allAssumedCardsMatching(gameSession, false);
	const centerCards = allAssumedCardsMatching(gameSession, true);
	const villagers = allAssumedCardsMatching(gameSession, false, 0);
	const wolves = allAssumedCardsMatching(gameSession, false, 1);
	const tanners = allAssumedCardsMatching(gameSession, false, 2);

	switch (event) {
		case "test":
			await sayTo(
				players,
				"This is a test.",
				"This is message content! Also, check out this list. Do you like " +
					joinInEnglish(
						["debugging", "having the code run on the first try", "blahajs"].map((item) => nameplate(item)),
						"or",
					) +
					".",
			);
			const colors = [
				{ icon: "❤️", name: "Red" },
				{ icon: "🧡", name: "Orange" },
				{ icon: "💛", name: "Yelol,w" },
				{ icon: "💚", name: "Geen" },
				{ icon: "💙", name: "blu" },
				{ icon: "💜", name: "Purple" },
			];
			const answer = await askQuestionTo(
				gameSession,
				players[0],
				"This is another test!",
				"This test is a question. Pick your top 3 favorite colors!",
				colors,
				"Pick 3 colors",
				"I wonder if our favorite colors are the same?",
				30,
				3,
			);
			await sayTo(players, "This just in...", "Your favorite colors are " + joinInEnglish(answer.map((x) => nameplate(colors[x].name))));
			break;
		case "wolfmain":
			if (wolves.length === 0) {
				break;
			} else if (wolves.length === 1) {
				executeEvent("lonewolf", interaction, gameSession);
			} else {
				executeEvent("wolfsee", interaction, gameSession);
			}
			break;
		case "wolfsee":
			await sayTo(
				wolves,
				"You wake up to see your werewolf teammates...",
				"The werewolves are " + joinInEnglish(wolves.map((item) => nameplate(item.name))) + ".",
			);
			break;
		case "lonewolf":
			const chosenCenterCard = await askQuestionTo(
				gameSession,
				wolves[0],
				"You wake up to see your werewolf teammates...",
				"...and you were alone!",
				centerCards,
				"Pick a center card to view.",
			);
			if (chosenCenterCard !== null) {
				await sayTo(
					wolves[0],
					"You looked at " + nameplate(centerCards[chosenCenterCard]),
					`...and you saw a ${nameplate(centerCards[chosenCenterCard].role)} card.`,
				);
			}
			break;
		case "insomniac":
			const insomniacs = allAssumedCardsMatching(gameSession, false, undefined, 10);
			if (insomniacs?.length > 0) {
				for (let i = 0; i < insomniacs.length; i++) {
					await sayTo(insomniacs[i], "You wake up to see your own card", `...and you saw a ${nameplate(insomniacs[i].role)} card.`);
				}
			}
			break;
		case "mason":
			const masons = allAssumedCardsMatching(gameSession, false, undefined, 3);
			await sayTo(
				masons,
				`You wake up to see other ${nameplate(roles[3], true)}...`,
				`The ${nameplate(roles[3], true)} are ` + joinInEnglish(masons.map((item) => nameplate(item.name))) + ".",
			);
			break;
		case "joker":
			const jokers = allAssumedCardsMatching(gameSession, false, undefined, 12);
			await sayTo(
				jokers,
				`You wake up to see other ${nameplate(roles[12], true)}...`,
				`The ${nameplate(roles[12], true)} are ` + joinInEnglish(jokers.map((item) => nameplate(item.name))) + ".",
			);
			break;
		case "rob":
			const robber = allAssumedCardsMatching(gameSession, false, undefined, 4)[0];
			if (robber === undefined) break;
			const nonRobbers = allAssumedCardsMatching(gameSession, false).filter((p) => p.playerId !== robber.playerId);
			if (nonRobbers.length < 1) {
				await sayTo(robber, "You wake up to rob another player...", `...and no one was available to rob?`);
				break;
			}
			const chosenToRob = await askQuestionTo(
				gameSession,
				robber,
				"You wake up to rob another player...",
				"You will switch cards with them, and see your new card. They won't know they were robbed.",
				nonRobbers,
				"Pick a player to rob.",
			);
			if (chosenToRob !== null) {
				await sayTo(
					robber,
					"You robbed " + nameplate(nonRobbers[chosenToRob]) + "...",
					`...and you got their ${nameplate(nonRobbers[chosenToRob].role)} card.`,
				);
				gameSession = swapCards(gameSession, robber, nonRobbers[chosenToRob]);
			}
			break;
		case "seer":
			const seer = allAssumedCardsMatching(gameSession, false, undefined, 5)[0];
			if (seer === undefined) break;

			const seerTimelineChoices = [
				{ icon: "🎴", name: "View Center Cards" },
				{ icon: "👤", name: "View another Player's Card" },
			];

			const trackChoice = await askQuestionTo(
				gameSession,
				seer,
				"You wake up to see other cards",
				"Choose whether you want to examine center cards, or see another player's card.",
				seerTimelineChoices,
				"Choose focus...",
			);

			if (trackChoice === 0) {
				const maxCardsToView = Math.min(2, centerCards.length);

				if (maxCardsToView < 1) {
					await sayTo(seer, "You look to the center...", "...there are... no center cards to view? If you're seeing this, something is wrong.");
					break;
				}

				const chosenCenterIndices = await askQuestionTo(
					gameSession,
					seer,
					"You look to the center",
					`Select exactly ${maxCardsToView} center cards to see.`,
					centerCards,
					`Choose ${maxCardsToView} card(s)...`,
					"",
					gameSession.gameSettings.actionSeconds,
					maxCardsToView,
				);

				if (chosenCenterIndices !== null) {
					const indices = Array.isArray(chosenCenterIndices) ? chosenCenterIndices : [chosenCenterIndices];
					const revealMessages = [];

					for (const idx of indices) {
						revealMessages.push(`You viewed ${nameplate(centerCards[idx])} and discovered a ${nameplate(centerCards[idx].role)} card.`);
					}

					await sayTo(
						seer,
						"You look at " + joinInEnglish(chosenCenterIndices.map((index) => nameplate(centerCards[index]))),
						revealMessages.join("\n"),
					);
				}
			} else if (trackChoice === 1) {
				const validPlayerTargets = gameSession.players.filter((p) => p.user?.id && p.playerId !== seer.playerId);
				if (validPlayerTargets.length < 1) {
					await sayTo(seer, "You look to other players...", "but nobody came..?");
					break;
				}

				const targetPlayerIdx = await askQuestionTo(
					gameSession,
					seer,
					"You look to other players",
					"Select a player to see the card of.",
					validPlayerTargets,
					"Select a player card...",
				);

				if (targetPlayerIdx !== null) {
					await sayTo(
						seer,
						`You looked at ${nameplate(validPlayerTargets[targetPlayerIdx])}...`,
						`...and saw a ${nameplate(validPlayerTargets[targetPlayerIdx].role)} card.`,
					);
				}
			}
			break;
		case "apprenticeseer":
			const appSeer = allAssumedCardsMatching(gameSession, false, undefined, 6)[0];
			if (appSeer === undefined) break;

			const selectedAppCardIdx = await askQuestionTo(
				gameSession,
				appSeer,
				"You wake up to see a center card",
				"Choose which center card to see.",
				centerCards,
				"Choose a center card...",
			);

			if (selectedAppCardIdx !== null) {
				await sayTo(
					appSeer,
					`You look at ${nameplate(centerCards[selectedAppCardIdx])}...`,
					`...and observed a ${nameplate(centerCards[selectedAppCardIdx].role)} card.`,
				);
			}
			break;
		case "witchview":
			const witch = allAssumedCardsMatching(gameSession, false, undefined, 7)[0];
			if (witch === undefined) break;

			const witchViewIdx = await askQuestionTo(
				gameSession,
				witch,
				"You wake up as the Witch",
				"First, choose exactly one center card to inspect secretly.",
				centerCards,
				"Choose center card...",
			);

			if (witchViewIdx !== null) {
				const targetCenter = centerCards[witchViewIdx];
				await sayTo(witch, `You revealed ${nameplate(targetCenter)}`, `...and saw a ${nameplate(targetCenter.role)} card.`);

				const activePlayers = gameSession.players.filter((p) => p.user?.id && p.playerId !== witch.playerId);
				const brewOptions = [...activePlayers.map((p) => ({ icon: p.icon, name: p.name }))];

				const finalSwapIdx = await askQuestionTo(
					gameSession,
					witch,
					"You look to the other players...",
					`Now, you may swap that ${nameplate(targetCenter.role)} card from the center with any other player's card. They weren't know they were swapped.`,
					brewOptions,
					"Choose target player...",
				);

				if (finalSwapIdx !== null) {
					const swapPlayerObj = activePlayers[finalSwapIdx];
					await sayTo(witch, "You swapped the " + nameplate(targetCenter.role) + "...", `...with ${nameplate(swapPlayerObj)}'s card.`);
                    gameSession = swapCards(gameSession, targetCenter, swapPlayerObj);
                }
			}
			break;
		case "troublemaker":
			const troublemaker = allAssumedCardsMatching(gameSession, false, undefined, 8)[0];
			if (troublemaker === undefined) break;

			const targetPool = gameSession.players.filter((p) => p.user?.id && p.playerId !== troublemaker.playerId);
			if (targetPool.length < 2) {
				await sayTo(troublemaker, "You wake up to cause trouble...", "...but there isn't enough players to swap two other players' cards.");
				break;
			}

			const chosenAnswers = await askQuestionTo(
				gameSession,
				troublemaker,
				"You wake up to cause trouble...",
				"Select exactly two other players to swap the cards of. They won't know they were swapped.",
				targetPool,
				"Select 2 players to swap...",
				"",
				gameSession.gameSettings.actionSeconds,
				2,
			);

			if (Array.isArray(chosenAnswers) && chosenAnswers.length === 2) {
				const entityOne = targetPool[chosenAnswers[0]];
				const entityTwo = targetPool[chosenAnswers[1]];

				gameSession = swapCards(gameSession, entityOne, entityTwo);
				await sayTo(troublemaker, "You caused trouble...", `...you swapped the cards of ${nameplate(entityOne)} and ${nameplate(entityTwo)}.`);
			} else {
				await sayTo(troublemaker, "You didn't cause trouble...", "...because you did not select exactly two players to swap.");
			}
			break;
		case "drunk":
			const drunk = allAssumedCardsMatching(gameSession, false, undefined, 9)[0];
			if (drunk === undefined) break;

			const drunkChoiceIdx = await askQuestionTo(
				gameSession,
				drunk,
				"You wake up completely hammered...",
				"You must exchange your card with a card from the center...without seeing it.",
				centerCards,
				"Choose center card...",
			);

			if (drunkChoiceIdx !== null) {
				const targetCenter = centerCards[drunkChoiceIdx];
				gameSession = swapCards(gameSession, drunk, targetCenter);
				await sayTo(
					drunk,
					"You have no idea what you just swapped with...",
					`...you traded your ${nameplate(roles[9])} card with ${nameplate(targetCenter)}.`,
					"",
					gameSession.gameSettings.actionSeconds,
					2,
					true,
				);
			}
			break;
        case "minion":
			const minions = allAssumedCardsMatching(gameSession, false, undefined, 13);
			if (minions.length === 0) break;

			const wolfPlayers = gameSession.players.filter((p) => p.user?.id && p.role.team === 1 && p.role.id !== 13);

			if (wolfPlayers.length === 0) {
				await sayTo(
					minions,
					`You wake up to see who the ${nameplate(teams[1], true)} are...`,
					`...but there are no ${nameplate(teams[1], true)} in play.`,
				);
			} else {
				await sayTo(
					minions,
					`You wake up to see who the ${nameplate(teams[1], true)} are...`,
					`... the ${nameplate(teams[1], true)} are ` + joinInEnglish(wolfPlayers.map((item) => nameplate(item.name))) + ".",
				);
			}
			break;
	}
}

function getWinningVote(votes) {
	const values = Object.values(votes);
	const frequencyMap = {};
	let maxCount = 0;
	let winner = null;
	let isTie = false;

	for (const vote of values) {
		frequencyMap[vote] = (frequencyMap[vote] || 0) + 1;
		const currentCount = frequencyMap[vote];

		if (currentCount > maxCount) {
			maxCount = currentCount;
			winner = vote;
			isTie = false;
		} else if (currentCount === maxCount && vote !== winner) {
			isTie = true;
		}
	}

	return isTie || winner === null ? null : { winner, count: maxCount };
}

function calculateWinners(players, killed) {
	const actualWolvesInPlay = players.some((player) => player.user?.id && player.role.team === 1 && player.role.id !== 13);

	let winningTeam = 0;

	if (killed === undefined || killed === null) {
		if (actualWolvesInPlay) {
			winningTeam = 1;
		} else {
			winningTeam = 0;
		}
	} else {
		const killedTeam = killed.role ? killed.role.team : null;
		const killedId = killed.role ? killed.role.id : null;

		if (killedTeam === 2) {
			winningTeam = 2;
		} else if (killedTeam === 0) {
			winningTeam = 1;
		} else if (killedTeam === 1) {
			if (killedId === 13) {
				winningTeam = actualWolvesInPlay ? 1 : 0;
			} else {
				winningTeam = 0;
			}
		}
	}

	const winners = [];
	const losers = [];
	const centerCards = [];

	for (const player of players) {
		if (player.user?.id) {
			const playerMention = `<@${player.user.id}>`;
			const playerDisplay = `${player.role.icon} ${playerMention}`;

			if (player.role.team === winningTeam) {
				winners.push(playerDisplay);
			} else {
				losers.push(playerDisplay);
			}
		} else {
			const centerDisplay = `${player.role.icon} **${player.name}**`;
			centerCards.push(centerDisplay);
		}
	}

	const winnersList = winners.length > 0 ? winners.join("\n") : "None";
	const losersList = losers.length > 0 ? losers.join("\n") : "None";
	const centerList = centerCards.length > 0 ? centerCards.join("\n") : "None";

	return `### Winners:\n||${winnersList}||\n### Losers:\n||${losersList}||\n### Middle Cards:\n||${centerList}||`;
}

async function playGame(interaction, gameSession) {
	gameSession.teams = [];
	for (const roleId of gameSession.gameSettings.roles) {
		const role = roles[roleId];
		if (!gameSession.teams.includes(role.team)) {
			gameSession.teams.push(role.team);
		}
	}

	for (let i = 1; i <= gameSession.gameSettings.centerCardsCount; i++) {
		gameSession.players.push({
			playerId: gameSession.players.length,
			icon: "🎴",
			name: "Center Card " + i,
		});
	}

	const shuffledRoles = [...gameSession.gameSettings.roles].sort(() => Math.random() - 0.5);
	for (let i = 0; i < gameSession.players.length; i++) {
		gameSession.players[i].role = new GameCard(shuffledRoles[i]);
		gameSession.players[i].assumedRole = lodash.cloneDeep(gameSession.players[i].role);
		if (gameSession.players[i].user?.id) {
			const yourRoleContainer = new ContainerBuilder()
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(`\n## Your role is ${gameSession.players[i].role.icon} ${gameSession.players[i].role.name}`),
				)
				.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						`${teams[gameSession.players[i].role.team].desc}\n${(gameSession.players[i].role.desc == "Nothing Special." ? "" : gameSession.players[i].role.desc) || ""}`,
					),
				);
			gameSession.players[i].user.send({
				components: [yourRoleContainer],
				flags: [MessageFlags.IsComponentsV2],
			});
		}
	}

	const gameActions = new Set();
	for (const roleId of gameSession.gameSettings.roles) {
		const role = roles[roleId];
		for (const action of role.actions) {
			gameActions.add(action);
		}
	}

	gameSession.events = turnOrder.filter((event) => gameActions.has(event));

	const eventDocket = [];
	for (const event of gameSession.events) {
		const role = roles.find((r) => r.actions.includes(event));
		if (role) {
			eventDocket.push({
				icon: role.icon,
				name: role.name,
				desc: role.desc,
				event: event,
				timeMultiplier: role.timeMultiplier || 1,
			});
		}
	}

	let gameContainer = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent("## Night phase"))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`⏲️ Look at your roles <a:working:1500306952457031730>\n${eventDocket.map((e) => `${e.icon} ${tooltip(e.name, e.desc, interaction)}`).join("\n")}`,
			),
		);
	const message = await interaction.channel.messages.fetch(gameSession.messageId);
	await message.edit({
		components: [gameContainer],
	});

	await sleep(gameSession.gameSettings.actionSeconds * 1000);

	for (let eventNum = 0; eventNum < eventDocket.length; eventNum++) {
		const event = eventDocket[eventNum];
		gameSession.currentEvent = event.event;

		let gameContainer = new ContainerBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent("## Night phase"))
			.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`⏲️ Look at your roles\n${eventDocket.map((e) => `${e.icon} ${tooltip(e.name, e.desc, interaction)}${e.event == event.event ? ` <a:working:1500306952457031730>` : ""}`).join("\n")}`,
				),
			);
		const message = await interaction.channel.messages.fetch(gameSession.messageId);
		await message.edit({
			components: [gameContainer],
		});

		const timeBeforeEvent = Date.now();

		await executeEvent(event.event, interaction, gameSession);

		const currentMultiplier = event.timeMultiplier || 1;
		const totalDuration = gameSession.gameSettings.actionSeconds * 1000 * currentMultiplier;
		const remainingSleep = timeBeforeEvent + totalDuration - Date.now();

		if (remainingSleep > 0) {
			await sleep(remainingSleep);
		}
	}

	let nightEndedContainer = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent("## Night phase"))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`⏲️ Look at your roles\n${eventDocket.map((e) => `${e.icon} ${tooltip(e.name, e.desc, interaction)}`).join("\n")}`,
			),
		);
	const finalNightMessage = await interaction.channel.messages.fetch(gameSession.messageId);
	await finalNightMessage.edit({
		components: [nightEndedContainer],
	});

	const startOfVoting = Date.now();
	const totalVotingTimeMs = 1000 * 60 * gameSession.gameSettings.votingTime; // Calculate total time in ms
	const dueTimestamp = startOfVoting + totalVotingTimeMs;

	const votingRng = Math.floor(Math.random() * 100000);
	const votingId = "voting_" + votingRng;

	const votingDropdown = new StringSelectMenuBuilder()
		.setCustomId(votingId)
		.setPlaceholder("Cast your vote...")
		.addOptions(new StringSelectMenuOptionBuilder().setLabel("Remove Vote").setValue("remove").setEmoji("❌"));

	for (let i = 0; i < gameSession.players.length; i++) {
		votingDropdown.addOptions(
			new StringSelectMenuOptionBuilder().setLabel(gameSession.players[i].name).setValue(i.toString()).setEmoji(gameSession.players[i].icon),
		);
	}

	const votingClosesDisplay = new TextDisplayBuilder();

	const footerContent = gameSession.gameSettings.endOnAllVotes
		? `-# voting closes ${timestamp(dueTimestamp)}, or when everyone has voted`
		: `-# voting closes ${timestamp(dueTimestamp)}`;

	const votingContainer = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent("## Discuss & Vote"))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`||${allAssumedCardsMatching(gameSession, false).map((player) => `<@${player.user.id}> `)}||\n\nThe card voted by the majority of other players will be executed, and thus determine the winners of the game. You may vote at any time during the voting window, and you may change or remove your vote after you have already voted.\n\nIn the case of a tie, no card is executed, but one or more teams may still win.`,
			),
		)
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addActionRowComponents(new ActionRowBuilder().addComponents(votingDropdown))
		.addTextDisplayComponents(votingClosesDisplay.setContent(footerContent));

	const votingMessage = await interaction.followUp({
		components: [votingContainer],
		flags: [MessageFlags.IsComponentsV2],
	});

	let votes = {};
	const totalEligibleVoters = gameSession.players.filter((p) => p.user?.id).length;

	const votingFilter = (interaction) => interaction.customId === votingId;
	const voteCollector = votingMessage.createMessageComponentCollector({
		filter: votingFilter,
		time: totalVotingTimeMs,
	});

	let warningTimeout;
	const warningDelay = totalVotingTimeMs - 30000;

	if (warningDelay > 0) {
		warningTimeout = setTimeout(async () => {
			try {
				const playerPings = allAssumedCardsMatching(gameSession, false)
					.map((player) => `<@${player.user.id}>`)
					.join(" ");

				await interaction.followUp({
					content: `⏳ **30 seconds remaining!** Cast or finalize your votes now!\n${playerPings}`,
				});
			} catch (err) {
				console.error("Failed to send 30-second voting warning:", err);
			}
		}, warningDelay);
	}

	voteCollector.on("collect", async (collectedInteraction) => {
		let voteResponseContent = "You canceled your vote.";

		if (collectedInteraction.values[0] !== "remove") {
			const playerIndex = parseInt(collectedInteraction.values[0]);
			voteResponseContent = `You cast your vote for ${nameplate(gameSession.players[playerIndex])}.`;
		}

		if (gameSession.players.some((player) => player.user?.id === collectedInteraction.user.id)) {
			if (collectedInteraction.values[0] == "remove") {
				votes[collectedInteraction.user.id] = undefined;
			} else {
				votes[collectedInteraction.user.id] = parseInt(collectedInteraction.values[0]);
			}
		} else {
			voteResponseContent = `❌ You aren't part of this game, and you can't vote!`;
		}

		try {
			await collectedInteraction.reply({
				content: voteResponseContent,
				flags: [MessageFlags.Ephemeral],
			});
		} catch (error) {
			console.error("Failed to reply to interaction:", error);
		}

		if (gameSession.gameSettings.endOnAllVotes) {
			const currentVotesCount = Object.values(votes).filter((val) => val !== undefined).length;
			if (currentVotesCount === totalEligibleVoters) {
				voteCollector.stop("everyone_voted");
			}
		}
	});

	voteCollector.on("end", async (collected, reason) => {
		if (warningTimeout) clearTimeout(warningTimeout);

		votingDropdown.setDisabled(true);
		votingDropdown.setPlaceholder("Voting has concluded.");

		if (reason === "everyone_voted") {
			votingClosesDisplay.setContent(`-# voting closed early (everyone voted!)`);
		} else {
			votingClosesDisplay.setContent(`-# voting closed ${timestamp(dueTimestamp)}`);
		}

		try {
			await votingMessage.edit({
				components: [votingContainer],
			});
		} catch (editError) {
			console.error("Failed to disable components on timeout:", editError);
		}

		const voteResultsArr = getWinningVote(votes);
		let voteResultsHeader;
		let targetPlayer;

		if (voteResultsArr == null) {
			voteResultsHeader = "## The village executed no one";
		} else {
			const winnerIndex = voteResultsArr.winner;
			targetPlayer = gameSession.players[winnerIndex];
			const targetMention = targetPlayer.user ? `<@${targetPlayer.user.id}>` : nameplate(targetPlayer);

			voteResultsHeader = `## The village executed ${targetMention}`;
		}

		const seeVotesId = "seevotes_" + votingRng;
		const seeVotesButton = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel("See Votes").setCustomId(seeVotesId);

		const voteeResultsContainer = new ContainerBuilder()
			.setSpoiler(true)
			.addSectionComponents(
				new SectionBuilder().setButtonAccessory(seeVotesButton).addTextDisplayComponents(new TextDisplayBuilder().setContent(voteResultsHeader)),
			)
			.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(calculateWinners(gameSession.players, targetPlayer)));

		const resultsMessage = await interaction.followUp({
			components: [voteeResultsContainer],
			flags: [MessageFlags.IsComponentsV2],
		});

		const voteViewFilter = (interaction) => interaction.customId === seeVotesId;
		const voteViewCollector = resultsMessage.createMessageComponentCollector({
			filter: voteViewFilter,
			time: 1000 * 60 * 60,
		});

		voteViewCollector.on("collect", async (collectedInteraction) => {
			const tally = {};
			for (const [voterId, targetIndex] of Object.entries(votes)) {
				if (targetIndex !== undefined) {
					if (!tally[targetIndex]) tally[targetIndex] = [];
					tally[targetIndex].push(voterId);
				}
			}

			let statsContent = "## Vote Breakdown\n\n";
			const talliedEntries = Object.entries(tally);

			if (talliedEntries.length === 0) {
				statsContent += "No votes were cast this round.";
			} else {
				for (const [targetIndex, voters] of talliedEntries) {
					const n = parseInt(targetIndex);
					const targetPlayer = gameSession.players[n];
					const targetName = targetPlayer.user ? `<@${targetPlayer.user.id}>` : nameplate(targetPlayer);

					const votersList = joinInEnglish(voters.map((id) => `<@${id}>`));
					statsContent += `${targetName} was voted by ${votersList}\n`;
				}
			}

			const statsContainer = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(statsContent));

			try {
				await collectedInteraction.reply({
					components: [statsContainer],
					flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
				});
			} catch (err) {
				console.error("Failed to send vote stats:", err);
			}
		});
	});
}

module.exports = { tooltip, playGame, nameplate };
