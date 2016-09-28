/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

let util        = require('util');
let path        = require('path');
let fs          = require('fs');

let Discord     = require('discord.js');
let githubAPI   = require('github');
let moment      = require('moment');
let request     = require('request');
let trelloAPI   = require('node-trello');
let cuRestAPI   = require('./cu-rest.js');

// load configuration file
let config = require('../config.js');

// load chat commands
let chatCommands = require('./commands.js');

// function to read in the saved member data
function getMemberData() {
  fs.readFile(config.memberFile, function(err, data) {
    if (data === '{}' || err && err.code === 'ENOENT') {
      memberData = [];
      fs.writeFile(config.memberFile, JSON.stringify(memberData), function(err) {
        if (err) {
          return util.log('[ERROR] Unable to create member data file.');
        }
        util.log('[STATUS] Member data file did not exist. Empty file created.');
      });
    } else {
      memberData = JSON.parse(data);
    }
  });
}

// function to authenticate with GitHub API
function githubAuth() {
  github.authenticate({
    type: 'basic',
    username: config.githubUsername,
    password: config.githubAPIKey
  });
}

// function to read in the saved GitHub data
function getGithubData() {
  fs.readFile(config.githubFile, function(err, data) {
    if (data === '{}' || err && err.code === 'ENOENT') {
      githubData = {
        lastCommit: '2007-10-01T00:00:00.000Z',
        lastIssue: '2007-10-01T00:00:00.000Z',
        lastPR: '2007-10-01T00:00:00.000Z'
      };
      fs.writeFile(config.githubFile, JSON.stringify(githubData), function(err) {
        if (err) {
          return util.log('[ERROR] Unable to create GitHub data file.');
        }
        util.log('[STATUS] GitHub data file did not exist. Empty file created.');
      });
    } else {
      githubData = JSON.parse(data);
    }
  });
}

// function to get user information from the GitHub API
function getGithubUser(user) {
  return new Promise(function (fulfill, reject) {
    if (! user) {
      reject('No GitHub username specified.');
    } else if (user === 'none') {
      fulfill({});
    } else {
      githubAuth();
      github.users.getForUser({
        user: user
      }, function(err, res) {
        if (! err) {
          fulfill(res);
        } else {
          util.log('[ERROR] Unable to get user information from GitHub API.');
          reject('The name \'' + user + '\' is not a valid GitHub user name.');
        }
      });
    }
  });
}

// function to obtain all contributors for every GitHub repo owned by all monitored organizations
function githubAllContribs() {
  return new Promise(function (fulfill, reject) {
    var allContribs = [];
    githubAllRepos().then(function(repos) {
      var repoCount = repos.length;
      repos.forEach(function(repo) {
        githubAuth();
        github.repos.getContributors({
          user: repo.owner.login,
          repo: repo.name
        }, function(err, res) {
          repoCount--;
          if (! err) {
            allContribs = allContribs.concat(res);
          } else {
            util.log('[ERROR] Error pulling list of contributors for \'' + repo.owner.login + '/' + repo.name + '\'.');
          }
          if (repoCount === 0) fulfill(allContribs);
        });
      });
    });
  });
}

// function to obtain all events for every repo owned by all monitored organizations
function githubAllEvents() {
  return new Promise(function (fulfill, reject) {
    var allEvents = [];
    var orgCount = config.githubOrgs.length;
    config.githubOrgs.forEach(function(ghUser, index, array) {
      githubAuth();
      github.activity.getEventsForOrg({
        org: ghUser
      }, function(err, res) {
        orgCount--;
        if (! err) {
          allEvents = allEvents.concat(res);
        } else {
          util.log('[ERROR] Error pulling list of events for \'' + ghUser + '\'.');
        }
        if (orgCount === 0) fulfill(allEvents);
      });
    });
  });
}

// function to obtain all issues for every repo owned by all monitored organizations
function githubAllIssues(filter) {
  return new Promise(function (fulfill, reject) {
    var allIssues = [];
    var orgName = null;
    var repoName = null;

    if (filter) {
      if (filter.indexOf('/') > -1) {
        orgName = filter.split('/')[0];
        repoName = filter.split('/')[1];
        var validOrg = false;
        for (var i = 0; i < config.githubOrgs.length; i++) {
          if (config.githubOrgs[i].toLowerCase() === orgName.toLowerCase()) validOrg = true;
        }
        if (! validOrg) return reject('The organization named \'' + orgName + '\' is not a monitored GitHub organization.');
      } else {
        var validOrg = false;
        for (var i = 0; i < config.githubOrgs.length; i++) {
          if (config.githubOrgs[i].toLowerCase() === filter.toLowerCase()) validOrg = true;
        }
        if (validOrg) {
          orgName = filter;
        } else {
          repoName = filter;
        }
      }
    }

    githubAllRepos(orgName).then(function(repos) {
      if (repoName) {
        for (var i = 0; i < repos.length; i++) {
          if (repos[i].name.toLowerCase() !== repoName.toLowerCase()) {
            repos.splice(i, 1);
            i--;
          }
        }
        if (repos.length < 1) fulfill(allIssues);
      }

      var repoCount = repos.length;
      repos.forEach(function(repo) {
        githubAuth();
        github.search.issues({
          q: 'user:' + repo.owner.login + '+repo:' + repo.name + '+state:open',
        }, function(err, res) {
          repoCount--;
          if (! err) {
            allIssues = allIssues.concat(res.items);
          } else {
            util.log('[ERROR] Error pulling list of issues for \'' + repo.owner.login + '/' + repo.name + '\'.');
          }
          if (repoCount === 0) fulfill(allIssues);
        });
      });
    });
  });
}

// function to obtain all pull reqeusts for every repo owned by all monitored users
function githubAllPullRequests(filter) {
  return new Promise(function (fulfill, reject) {
    var allPullRequests = [];
    var orgName = null;
    var repoName = null;

    if (filter) {
      if (filter.indexOf('/') > -1) {
        orgName = filter.split('/')[0];
        repoName = filter.split('/')[1];
        var validOrg = false;
        for (var i = 0; i < config.githubOrgs.length; i++) {
          if (config.githubOrgs[i].toLowerCase() === orgName.toLowerCase()) validOrg = true;
        }
        if (! validOrg) return reject('The organization named \'' + orgName + '\' is not a monitored GitHub organization.');
      } else {
        var validOrg = false;
        for (var i = 0; i < config.githubOrgs.length; i++) {
          if (config.githubOrgs[i].toLowerCase() === filter.toLowerCase()) validOrg = true;
        }
        if (validOrg) {
          orgName = filter;
        } else {
          repoName = filter;
        }
      }
    }

    githubAllRepos(orgName).then(function(repos) {
      if (repoName) {
        for (var i = 0; i < repos.length; i++) {
          if (repos[i].name.toLowerCase() !== repoName.toLowerCase()) {
            repos.splice(i, 1);
            i--;
          }
        }
        if (repos.length < 1) fulfill(allPullRequests);
      }

      var repoCount = repos.length;
      repos.forEach(function(repo, index, array) {
        githubAuth();
        github.pullRequests.getAll({
          user: repo.owner.login,
          repo: repo.name
        }, function(err, res) {
          repoCount--;
          if (! err) {
            allPullRequests = allPullRequests.concat(res);
          } else {
            util.log('[ERROR] Error pulling list of pull requests for \'' + repo.owner.login + '/' + repo.name + '\'.\n' + err);
          }
          if (repoCount === 0) fulfill(allPullRequests);
        });
      });
    });
  });
}

// function to obtain all repos owned by all monitored organizations
function githubAllRepos(org) {
  return new Promise(function (fulfill, reject) {
    var allRepos = [];
    if (org) {
      var orgsToSearch = [org];
    } else {
      var orgsToSearch = config.githubOrgs;
    }
    var orgCount = orgsToSearch.length;

    orgsToSearch.forEach(function(ghUser, index, array) {
      githubAuth();
      github.repos.getForOrg({
        org: ghUser
      }, function(err, res) {
        orgCount--;
        if (! err) {
          allRepos = allRepos.concat(res);
        } else {
          util.log('[ERROR] Error pulling list of repositories for \'' + ghUser + '\'.');
        }
        if (orgCount === 0) fulfill(allRepos);
      });
    });
  });
}

// function to read in the saved Trello data
function getTrelloData() {
  fs.readFile(config.trelloFile, function(err, data) {
    if (data === '{}' || err && err.code === 'ENOENT') {
      trelloData = {
        lastAction: '2011-09-01T00:00:00.000Z',
      };
      fs.writeFile(config.trelloFile, JSON.stringify(trelloData), function(err) {
        if (err) {
          return util.log('[ERROR] Unable to create Trello data file.');
        }
        util.log('[STATUS] Trello data file did not exist. Empty file created.');
      });
    } else {
      trelloData = JSON.parse(data);
    }
  });
}

// function to get user information from the Trello API
function getTrelloUser(user) {
  return new Promise(function (fulfill, reject) {
    if (! user) {
      reject('No Trello username specified.');
    } else if (user === 'none') {
      fulfill({fullName: 'None'});
    } else {
      trello.get('/1/members/' + user, function(err, data) {
        if (! err) {
          fulfill(data);
        } else {
          util.log('[ERROR] Unable to get user information from Trello API.');
          reject('The name \'' + user + '\' is not a valid Trello user name.');
        }
      });
    }
  });
}

// function to obtain all actions on all monitored Trello boards
function trelloAllActions() {
  return new Promise(function (fulfill, reject) {
    var allActions = [];
    var boardCount = config.trelloBoards.length;
    config.trelloBoards.forEach(function(boardID, index, array) {
      trello.get('/1/boards/' + boardID + '/actions', function(err, data) {
        boardCount--;
        if (! err) {
          allActions = allActions.concat(data);
        } else {
          util.log('[ERROR] Error pulling list of actions for board \'' + boardID + '\'.');
        }
        if (boardCount === 0) fulfill(allActions);
      });
    });
  });
}

// function to obtain all cards in the 'Need Assistance' Trello list
function trelloAllAssists() {
  return new Promise(function (fulfill, reject) {
    trello.get('/1/lists/' + config.trelloAssistList + '/cards', function(err, data) {
      if (! err) {
        fulfill(data);
      } else {
        util.log('[ERROR] Error pulling assist list from Trello API');
        reject('Error pulling assist list from Trello API');
      }
    });
  });
}

// function to check if user is a bot admin
function isAdmin(name) {
  for (var i = 0; i < config.botAdmins.length; i++) {
    if (config.botAdmins[i].toLowerCase() === name.toLowerCase()) return true;
  }
  return false;
};

// function to check if game server is up
// ***TODO*** need to move restAPI away from server
function isGameServerUp(server, attempt, callback) {
  server.cuRest.getServers().then(function(data) {
    for (var i = 0; i < data.length; i++) {
      if (data[i].name.toLowerCase() === server.name.toLowerCase()) {
        callback(true);
        return;
      }
    }
    callback(false);
  }, function(error) {
    // Retry twice before giving up.
    if (attempt < 2) {
      isGameServerUp(server, attempt+1, callback);
    } else {
      util.log('[ERROR] Unable to query game servers API.');
      callback(false);
    }
  });
}

function random(howMany) {
  chars = 'abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789';
  var rnd = require('crypto').randomBytes(howMany)
    , value = new Array(howMany)
    , len = chars.length;

  for (var i = 0; i < howMany; i++) {
    value[i] = chars[rnd[i] % len]
  };

  return value.join('');
}

function sendAnnounce(announcement) {
  if (announcement.type === 'github') {
    config.githubAnnounce.forEach(function(room) {
      if (room.type === 'discord' && discordChannels[room.name]) {
        discordBot.sendMessage(discordChannels[room.name], ':floppy_disk: ' + announcement.message);
      }
    });
  } else if (announcement.type === 'trello') {
    config.trelloAnnounce.forEach(function(room) {
      if (room.type === 'discord' && discordChannels[room.name]) {
        discordBot.sendMessage(discordChannels[room.name], ':card_box: ' + announcement.message);
      }
    });
  }
}

function sendReply(Reply) {
  if (Reply.type === 'discord') {
    const message = Reply.message;
    const replyText = Reply.text;
    if (Reply.replyWithPM) {
      discordBot.sendMessage(message.author, replyText);
    } else {
      discordBot.reply(message, replyText);
    }
  }

  if (Reply.type === 'xmpp') {
    const server = Reply.server;
    const room = Reply.room;
    const sender = Reply.sender;
    const message = Reply.message;
    if (room === 'pm') {
      // sendPM(server, message, sender);
    } else {
      // sendChat(server, message, room);
    }
    console.log('coming soon(tm)');
  }
}


// Timer to monitor GitHub and announce updates
var timerGitHub = function() { return setInterval(function() { checkGitHub(); }, 15000); };
function checkGitHub() {
  var curISODate = new Date().toISOString();
  var newIssueData = false;
  var newPRData = false;
  var tempLastIssue = githubData.lastIssue;
  var tempLastPR = githubData.lastPR;

  // Poll for all events
  githubAllEvents().then(function(events) {
    events.reverse();
    for (var i = 0; i < events.length; i++) {
      var event = events[i];

      // Skip event if the user is ignored
      var ignoredEvent = false;
      config.githubIgnores.forEach(function(igUser) {
        if (igUser === event.actor.login) ignoredEvent = true;
      });
      if (! ignoredEvent) {
        // Handle Issue Events
        if (event.type === 'IssuesEvent') {
          var diff = moment(event.payload.issue.updated_at).diff(githubData.lastIssue);
          if (diff > 0) {
            // Save new issue date
            if (moment(event.payload.issue.updated_at).diff(tempLastIssue) > 0) tempLastIssue = event.payload.issue.updated_at;
            newIssueData = true;

            // Announce new information to chat room
            if (event.payload.issue.created_at !== event.payload.issue.updated_at) {
              if (event.payload.action === 'closed') {
                var chatMessage = 'An existing issue for \'' + event.repo.name + '\' has been closed by ' + event.actor.login + ':' +
                '\n<' + event.payload.issue.html_url + '>';
              } else {
                var chatMessage = 'An existing issue for \'' + event.repo.name + '\' has been updated by ' + event.actor.login + ':' +
                '\n<' + event.payload.issue.html_url + '>';
              }
            } else {
              var chatMessage = 'A new issue for \'' + event.repo.name + '\' has been opened by ' + event.actor.login + ':' +
              '\n<' + event.payload.issue.html_url + '>';
            }
            if (githubData.lastIssue !== '2007-10-01T00:00:00.000Z') {
              sendAnnounce({ type: 'github', message: chatMessage });
            }
          }
        }

        if (event.type === 'PullRequestEvent') {
          var diff = moment(event.payload.pull_request.updated_at).diff(githubData.lastPR);
          if (diff > 0) {
            // Save new PR date
            if (moment(event.payload.pull_request.updated_at).diff(tempLastPR) > 0) tempLastPR = event.payload.pull_request.updated_at;
            newPRData = true;

            // Announce new information to chat room
            if (event.payload.pull_request.created_at !== event.payload.pull_request.updated_at) {
              if (event.payload.action === 'closed') {
                var chatMessage = 'An existing pull request for \'' + event.repo.name + '\' has been closed by ' + event.actor.login + ':' +
                '\n<' + event.payload.pull_request.html_url + '>';
              } else {
                var chatMessage = 'An existing pull request for \'' + event.repo.name + '\' has been updated by ' + event.actor.login + ':' +
                '\n<' + event.payload.pull_request.html_url + '>';
              }
            } else {
              var chatMessage = 'A new pull request for \'' + event.repo.name + '\' has been opened by ' + event.actor.login + ':' +
              '\n<' + event.payload.pull_request.html_url + '>';
            }
            if (githubData.lastPR !== '2007-10-01T00:00:00.000Z') {
              sendAnnounce({ type: 'github', message: chatMessage });
            }
          }
        }

        if (event.type === 'IssueCommentEvent') {
          if (event.payload.issue.pull_request) {
            // Comment is for a pull request
            var diff = moment(event.payload.issue.updated_at).diff(githubData.lastPR);
            if (diff > 0) {
              // Save new PR date
              if (moment(event.payload.issue.updated_at).diff(tempLastPR) > 0) tempLastPR = event.payload.issue.updated_at;
              newPRData = true;

              // Announce new information to chat room
              if (event.payload.issue.created_at !== event.payload.issue.updated_at) {
                var chatMessage = 'An existing pull request for \'' + event.repo.name + '\' has been commented on by ' + event.actor.login + ':' +
                '\n<' + event.payload.issue.html_url + '>';
              } else {
                var chatMessage = 'A new pull request for \'' + event.repo.name + '\' has been commented on by ' + event.actor.login + ':' +
                '\n<' + event.payload.issue.html_url + '>';
              }
              if (githubData.lastPR !== '2007-10-01T00:00:00.000Z') {
                sendAnnounce({ type: 'github', message: chatMessage });
              }
            }
          } else {
            // Comment is for an issue
            var diff = moment(event.payload.issue.updated_at).diff(githubData.lastIssue);
            if (diff > 0) {
              // Save new issue date
              if (moment(event.payload.issue.updated_at).diff(tempLastIssue) > 0) tempLastIssue = event.payload.issue.updated_at;
              newIssueData = true;

              // Announce new information to chat room
              if (event.payload.issue.created_at !== event.payload.issue.updated_at) {
                var chatMessage = 'An existing issue for \'' + event.repo.name + '\' has been commented on by ' + event.actor.login + ':' +
                '\n<' + event.payload.issue.html_url + '>';
              } else {
                var chatMessage = 'A new issue for \'' + event.repo.name + '\' has been commented on by ' + event.actor.login + ':' +
                '\n<' + event.payload.issue.html_url + '>';
              }
              if (githubData.lastIssue !== '2007-10-01T00:00:00.000Z') {
                sendAnnounce({ type: 'github', message: chatMessage });
              }
            }
          }
        }
      }
    }
    if (newIssueData || newPRData) {
      githubData.lastIssue = tempLastIssue;
      githubData.lastPR = tempLastPR;
      fs.writeFile(config.githubFile, JSON.stringify(githubData), function(err) {
        if (err) {
          util.log('[ERROR] Unable to write GitHub data file.');
        }
        util.log('[STATUS] GitHub data file updated with new information.');
      });

      // discordBot.setChannelTopic(extras.message.channel, 'Open Pull Requests: xx | Open Issues: xx | Cards Needing Assistance: xx');

    }
  });
}

// Timer to monitor GitHub and announce updates
var timerTrello = function() { return setInterval(function() { checkTrello(); }, 15000); };
function checkTrello() {
  var curISODate = new Date().toISOString();
  var newActionData = false;
  var tempLastAction = trelloData.lastAction;

  // Poll for all actions
  trelloAllActions().then(function(actions) {
    actions.reverse();
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];

      // Handle Actions
      var diff = moment(action.date).diff(trelloData.lastAction);
      if (diff > 0) {
        // Save new issue date
        if (moment(action.date).diff(tempLastAction) > 0) tempLastAction = action.date;
        newActionData = true;
        var chatMessage = null;

        // Announce new information to chat room
        switch(action.type) {
          case 'createCard':
            chatMessage = action.memberCreator.username + ' created the card \'' + action.data.card.name + '\' on the Trello board \'' + action.data.board.name + '\':' +
              '\n<https://trello.com/c/' + action.data.card.shortLink + '>';
            break;
          case 'updateCard':
            if (action.data.listAfter && action.data.listBefore) {
              // Card was moved.
              chatMessage = action.memberCreator.username + ' moved the card \'' + action.data.card.name + '\' from \'' + action.data.listBefore.name + '\' to \'' + action.data.listAfter.name + '\' on the Trello board \'' + action.data.board.name + '\':' +
                '\n<https://trello.com/c/' + action.data.card.shortLink + '>';
            } else {
              // Card was modified.
              // chatMessage = action.memberCreator.username + ' modified the card \'' + action.data.card.name + '\' on the Trello board \'' + action.data.board.name + '\':' +
              //   '\n<https://trello.com/c/' + action.data.card.shortLink + '>';
            }
            break;
          case 'addChecklistToCard':
          case 'removeChecklistFromCard':
          case 'addAttachmentToCard':
          case 'deleteAttachmentFromCard':
            chatMessage = action.memberCreator.username + ' modified the card \'' + action.data.card.name + '\' on the Trello board \'' + action.data.board.name + '\':' +
              '\n<https://trello.com/c/' + action.data.card.shortLink + '>';
            break;
          case 'commentCard':
            chatMessage = action.memberCreator.username + ' commented on the card \'' + action.data.card.name + '\' on the Trello board \'' + action.data.board.name + '\':' +
              '\n<https://trello.com/c/' + action.data.card.shortLink + '>';
            break;
          case 'addMemberToCard':
            chatMessage = action.member.username + ' was added to the card \'' + action.data.card.name + '\' on the Trello board \'' + action.data.board.name + '\':' +
              '\n<https://trello.com/c/' + action.data.card.shortLink + '>';
            break;
          case 'removeMemberFromCard':
            chatMessage = action.member.username + ' was removed from the card \'' + action.data.card.name + '\' on the Trello board \'' + action.data.board.name + '\':' +
              '\n<https://trello.com/c/' + action.data.card.shortLink + '>';
            break;
          case 'moveCardToBoard':
            chatMessage = action.memberCreator.username + ' moved the card \'' + action.data.card.name + '\' from the board \'' + action.data.boardSource.name + '\' to \'' + action.data.list.name + '\' on the Trello board \'' + action.data.board.name + '\':' +
              '\n<https://trello.com/c/' + action.data.card.shortLink + '>';
            break;
        }
        if (trelloData.lastAction !== '2011-09-01T00:00:00.000Z' && chatMessage) {
          sendAnnounce({ type: 'trello', message: chatMessage });
        }
      }
    }

    if (newActionData) {
      trelloData.lastAction = tempLastAction;
      fs.writeFile(config.trelloFile, JSON.stringify(trelloData), function(err) {
        if (err) {
          util.log('[ERROR] Unable to write Trello data file.');
        }
        util.log('[STATUS] Trello data file updated with new information.');
      });
    }
  });
}


// *** Discord Functionality ***
function updateDiscordChannels() {
  discordBot.channels.forEach(function(channel) {
    discordChannels[channel.name] = channel;
  });
}

function startDiscordBot() {
  discordBot.on('ready', function(error, message) {
    util.log('[STATUS] Discord chat bot is now online.');
    discordBot.setPlayingGame('Camelot Unchained');
    discordBot.timerChanUpdate = setInterval(function() { updateDiscordChannels(); }, 500);
  });

  discordBot.on('message', function(message) {
    const messageAuthorName = message.author.username;
    const messageChannelName = message.channel.name;
    const messageContent = message.content;
    let messageAuthorAdmin = false;
    let commandRoom = false;

    const messageAuthorRoles = message.server ? message.server.rolesOfUser(message.author) : [];
    for (let i = 0; i < messageAuthorRoles.length; i++) {
      if (messageAuthorRoles[i].name === 'CSE') {
        messageAuthorAdmin = true;
        break;
      }
    }
    if (config.botAdmins.indexOf(messageAuthorName) > -1) messageAuthorAdmin = true;

    // Always allow commands via PM.
    if (typeof message.server === 'undefined') commandRoom = true;
    // If message matches a defined command, run it
    for (let i = 0; i < config.commandRooms.length; i++) {
      if (config.commandRooms[i].type === 'discord' && config.commandRooms[i].name === messageChannelName) commandRoom = true;
    }
    if (messageContent[0] === config.commandChar && commandRoom) {
      var userCommand = messageContent.split(' ')[0].split(config.commandChar)[1].toLowerCase();
      chatCommands.forEach(function(cmd) {
        if (userCommand === cmd.command.toLowerCase()) {
          const extras = {
            type: 'discord',
            message: message,
            isAdmin: messageAuthorAdmin,
            sendReply: sendReply,
            memberData: memberData,
            githubAllContribs: githubAllContribs,
            githubAllIssues: githubAllIssues,
            githubAllPullRequests: githubAllPullRequests,
            githubAllRepos: githubAllRepos,
            trelloAllAssists: trelloAllAssists,
            getGithubUser: getGithubUser,
            getTrelloUser: getTrelloUser
          };
          cmd.exec(messageContent, extras);
        }
      });
    }
  });
  discordBot.loginWithToken(config.discordAPIKey);
}

function stopDiscordBot() {
  clearInterval(discordBot.timerChanUpdate);
  discordBot.logout();
}


// ***** Initialization *****
let memberData = [];
getMemberData();

// Set up GitHub monitoring
let githubData = {};
getGithubData();
let github = new githubAPI({
  version: '3.0.0',
  debug: false,
  protocol: 'https',
  host: 'api.github.com',
  timeout: 5000,
  headers: {
    'user-agent': 'CU-SquadBot'
  }
});
const githubTimer = timerGitHub();

// Set up Trello monitoring
// let trelloData = {};
// let trello = new trelloAPI(config.trelloAPIKey);
// getTrelloData();
// const trelloTimer = timerTrello();

// Set up Discord bot
let discordBot = new Discord.Client({autoReconnect: true});
let discordChannels = {};
startDiscordBot();
