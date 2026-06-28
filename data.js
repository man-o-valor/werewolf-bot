function nameplate(obj, plural = false) {
    return `${obj?.icon ? obj.icon + " " : ""}**${plural ? (obj?.plural ? obj.plural : obj?.name ? obj.name : obj) : obj?.singular ? obj.singular : obj?.name ? obj.name : obj}**`;
}

const teams = [
    {
        id: 0,
        name: `Villagers`,
        singular: `Villager`,
        icon: `🧑`,
        get desc() {
            return `The ${nameplate(teams[0])} team wins if a ${nameplate(teams[1])} team member is voted out.`;
        },
    },
    {
        id: 1,
        name: `Wolves`,
        singular: `Wolf`,
        icon: `🐺`,
        get desc() {
            return `The ${nameplate(teams[1])} team wins if a ${nameplate(teams[0])} team member is voted out.\nAll ${nameplate(teams[1], true)} wake up and see each other. If there is only one ${nameplate(teams[1])}, they may look at a center card.`;
        },
    },
    {
        id: 2,
        name: `Tanners`,
        singular: `Tanner`,
        icon: `🧹`,
        get desc() {
            return `The ${nameplate(teams[2])} team wins if a ${nameplate(teams[2])} team member is voted out.`;
        },
    },
];

const roles = [
    {
        id: 0,
        name: `Villager`,
        plural: `Villagers`,
        aka: [`v`],
        icon: `🧑`,
        actions: [],
        team: 0,
        get desc() {
            return `Nothing special.`;
        },
    },
    {
        id: 1,
        name: `Werewolf`,
        plural: `Werewolves`,
        aka: [`wolf`, `ww`, `w`],
        icon: `🐺`,
        actions: [`wolfmain`],
        team: 1,
        get desc() {
            return `Nothing special.`;
        },
    },
    {
        id: 2,
        name: `Tanner`,
        plural: `Tanners`,
        aka: [`t`],
        icon: `🧹`,
        actions: [],
        team: 2,
        get desc() {
            return `Nothing special.`;
        },
    },
    {
        id: 3,
        name: `Mason`,
        plural: `Masons`,
        aka: [`m`],
        icon: `🧱`,
        actions: [`mason`],
        team: 0,
        get desc() {
            return `The ${nameplate(roles[3], true)} know who all other ${nameplate(roles[3], true)} are.`;
        },
    },
    {
        id: 4,
        name: `Robber`,
        plural: `Robbers`,
        aka: [`r`],
        icon: `🥷`,
        actions: [`rob`],
        team: 0,
        maxAllowed: 1,
        get desc() {
            return `The ${nameplate(roles[4])} swaps their card with another player's card of their choice, and then looks at their new card.`;
        },
    },
    {
        id: 5,
        name: `Seer`,
        plural: `Seers`,
        aka: [`s`],
        icon: `🔮`,
        actions: [`seer`],
        team: 0,
        maxAllowed: 1,
        timeMultiplier: 2,
        get desc() {
            return `The ${nameplate(roles[5])} may view either two center cards, or another player's card.`;
        },
    },
    {
        id: 6,
        name: `Apprentice Seer`,
        plural: `Apprentice Seers`,
        aka: [`as`, `apprenticeseer`],
        icon: `👀`,
        actions: [`apprenticeseer`],
        team: 0,
        get desc() {
            return `The ${nameplate(roles[6])} may view one center card.`;
        },
    },
    {
        id: 7,
        name: `Witch`,
        plural: `Witches`,
        aka: [`wi`],
        icon: `🧙`,
        actions: [`witchview`],
        team: 0,
        maxAllowed: 1,
        timeMultiplier: 2,
        get desc() {
            return `The ${nameplate(roles[7])} may view one center card, but if they do, they must swap it with any other player's card.`;
        },
    },
    {
        id: 8,
        name: `Troublemaker`,
        plural: `Troublemakers`,
        aka: [`tm`, `trouble`],
        icon: `🤭`,
        actions: [`troublemaker`],
        team: 0,
        maxAllowed: 1,
        get desc() {
            return `The ${nameplate(roles[8])} swaps the cards of two other players of their choice without looking at them.`;
        },
    },
    {
        id: 9,
        name: `Drunk`,
        plural: `Drunks`,
        aka: [`d`],
        icon: `🍺`,
        actions: [`drunk`],
        team: 0,
        maxAllowed: 1,
        get desc() {
            return `The ${nameplate(roles[9])} swaps their card with a card from the center without looking at it.`;
        },
    },
    {
        id: 10,
        name: `Insomniac`,
        plural: `Insomniacs`,
        aka: [`i`],
        icon: `🥱`,
        actions: [`insomniac`],
        team: 0,
        get desc() {
            return `The ${nameplate(roles[10])} looks at their card at the end of the night.`;
        },
    },
    {
        id: 11,
        name: `Dev`,
        plural: `Devs`,
        aka: [],
        icon: `💻`,
        actions: [`test`],
        team: 0,
        get desc() {
            return `The ${nameplate(roles[11])} is the stupidest and most useless role. Never use it`;
        },
    },
    {
        id: 12,
        name: `Joker`,
        plural: `Jokers`,
        aka: [`j`, `clown`],
        icon: `🤡`,
        actions: [`joker`],
        team: 2,
        get desc() {
            return `The ${nameplate(roles[12], true)} know who all other ${nameplate(roles[12], true)} are.`;
        },
    },
];

const turnOrder = [
    `test`,
    `wolfmain`,
    `mason`,
    `joker`,
    `seer`,
    `apprenticeseer`,
    `rob`,
    `witchview`,
    `troublemaker`,
    `drunk`,
    `insomniac`,
];

module.exports = {
    teams,
    roles,
    turnOrder,
    nameplate,
};
