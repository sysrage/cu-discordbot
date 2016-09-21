
// To use the following as cu-squadbot.cfg. Set the following environment variables:
//  GITHUB_USERNAME = GitHub username
//  GITHUB_APIKEY = API key generated for GitHub username
//     GitHub API key can have minimum access, it's just needed to avoid the API rate limit.
//  TRELLO_APIKEY = API key generated for Trello
//  DISCORD_APIKEY = API token generated for Discord bot

// Configuration file for cu-squadbot.js


module.exports = {

  // Users without CSE flag which have bot admin access
  botAdmins: [
    'Agoknee',
  ],

  // Discord access details
  discordAPIKey: process.env.DISCORD_APIKEY,

  // GitHub access details
  githubUsername: process.env.GITHUB_USERNAME,
  githubAPIKey: process.env.GITHUB_APIKEY,

  // GitHub saved data location
  githubFile: './github.data',

  // All base GitHub organizations to monitor for repositories
  githubOrgs: [
    'csegames',
    'CUModSquad'
  ],

  // All GitHub users to ignore for announcing events
  githubIgnores: [
    'review-ninja',
  ],

  // List of chat rooms to announce GitHub updates
  githubAnnounce: [
    // { type: 'discord', name: 'mod-squad' },
    { type: 'xmpp', name: '_modsquad' }
  ],

  // Trello access details
  trelloAPIKey: process.env.TRELLO_APIKEY,
  trelloSecret: process.env.TRELLO_SECRET,

  // Trello saved data location
  trelloFile: './trello.data',

  // All Trello boards to monitor for lists
  trelloBoards: [
    '55ca43cc37365f65cac54e4d',   // Mod Squad Suggestions
    '55c4e1d2503fa3e9d0542fb2',   // UI Development & CU Library Development
  ],

  // Trello list containing cards which are marked as needing assistance
  trelloAssistList: '55c4e264b8009b07826fef11',

  // List of chat rooms to announce Trello updates
  trelloAnnounce: [
    // { type: 'discord', name: 'mod-squad' },
    // { type: 'xmpp', name: '_modsquad' }
  ],

  // Member list saved data location
  memberFile: './member.data',

  // Command character for chat based commands
  commandChar: '!',

  // List of chat rooms which allow bot commands
  commandRooms: [
    { type: 'discord', name: 'mod-squad' },
    { type: 'discord', name: '_modsquad' }
  ]
};
