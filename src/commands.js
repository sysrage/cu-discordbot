/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

let fs          = require('fs');
let util        = require('util');

// load configuration file
let config = require('../config.js');

const chatCommands = [
{ // #### HELP COMMAND ####
  command: 'help',
  help: "The command " + config.commandChar + "help displays help for using the various available bot commands.\n" +
    "\nUsage: " + config.commandChar + "help [command]\n" +
    "\nAvailable commands: ##HELPCOMMANDS##",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;

    var params = getParams(this.command, message);
    if (params.length > 0) {
      for (var i = 0; i < chatCommands.length; i++) {
        if (chatCommands[i].command == params) {
          sendReply({
            type: extras.type,
            message: extras.message,
            text: chatCommands[i].help
          });
        }
      }
    } else {
      sendReply({
        type: extras.type,
        message: extras.message,
        text: this.help
      });
    }
  }
},
{ // #### ASSIST COMMAND ####
  command: 'assist',
  help: "The command " + config.commandChar + "assist displays current Trello cards in the 'Need Assistance' list.\n" +
    "\nUsage: " + config.commandChar + "assist",
  needs: [
    'sendReply',
    'trelloAllAssists',
  ],
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const trelloAllAssists = extras.trelloAllAssists;
    var assistURLs = "";

    trelloAllAssists().then(function(assists) {
      if (assists.length > 0) {
          assists.forEach(function(assist, index) {
            assistURLs += "\n   " + (index + 1) + ": " + assist.shortUrl;
          });
          sendReply({
            type: extras.type,
            message: extras.message,
            text: "There are currently " + assists.length + " Trello cards marked as needing assistance:" + assistURLs
          });
      } else {
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "No Trello cards currently marked as needing assistance."
        });
      }
    }, function(error) {
      sendReply({
        type: extras.type,
        message: extras.message,
        text: error
      });
    });
  }
},
{ // #### BOTINFO COMMAND ####
  command: 'botinfo',
  help: "The command " + config.commandChar + "botinfo displays information about this chatbot.\n" +
    "\nUsage: " + config.commandChar + "botinfo",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;

    const replyText = "The bot is written in Node.js and is running on an OpenShift gear. Source code for the bot can be found here: https://github.com/CUModSquad/SquadBot" +
      "\n\nMuch thanks to the CU Mod Squad for their help.";
    sendReply({
      type: extras.type,
      message: extras.message,
      text: replyText
    });
  }
},
{ // #### CONTRIBS COMMAND ####
  command: 'contribs',
  help: "The command " + config.commandChar + "contribs displays all contributors to monitored GitHub organizations.\n" +
    "\nUsage: " + config.commandChar + "contribs",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const githubAllContribs = extras.githubAllContribs;

    var contribUsers = [];
    var contribList = "";
    githubAllContribs().then(function(contribs) {
      if (contribs.length > 0) {
        for (var i = 0; i < contribs.length; i++) {
          if (contribUsers.indexOf(contribs[i].login) === -1) contribUsers.push(contribs[i].login);
        }
        for (var i = 0; i < contribUsers.length; i++) {
          if (contribList.length > 0) contribList += ", ";
          contribList += contribUsers[i];
        }
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "Contributing users to all monitored GitHub organizations: " + contribList
        });
      } else {
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "No contributors found for monitored GitHub organizations."
        });
      }
    });
  }
},
{ // #### ISSUES COMMAND ####
  command: 'issues',
  help: "The command " + config.commandChar + "issues displays current issues for all monitored GitHub organizations.\n" +
    "\nUsage: " + config.commandChar + "issues [filter]" +
    "\nIf [filter] is specified, displayed issues will be filtered. Otherwise, issues for all monitored organizations will be displayed.",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const githubAllIssues = extras.githubAllIssues;

    var issueURLs = "";

    var params = getParams(this.command, message);
    if (params.length > 0) {
      var filter = params.split(' ')[0];
      var targetOrgText = "the GitHub filter '" + filter + "'";
    } else {
      var filter = null;
      var targetOrgText = "all monitored GitHub organizations";
    }

    githubAllIssues(filter).then(function(issues) {
      if (issues.length > 0) {
        if (! filter && issues.length > 5) {
          for (var i = 0; i < 5; i++) {
            issueURLs += "\n   " + (i + 1) + ": " + issues[i].html_url;
          }
          const replyText = "There are currently " + issues.length + " issues open against " + targetOrgText + ":" + issueURLs +
            "\n To display more than the first 5 issues, include a filter in your command.";
          sendReply({
            type: extras.type,
            message: extras.message,
            text: replyText
          });
        } else {
          issues.forEach(function(issue, index) {
            issueURLs += "\n   " + (index + 1) + ": " + issue.html_url;
          });
          const replyText = "There are currently " + issues.length + " issues open against " + targetOrgText + ":" + issueURLs;
          sendReply({
            type: extras.type,
            message: extras.message,
            text: replyText
          });
        }
      } else {
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "No issues found for " + targetOrgText + "."
        });
      }
    }, function(error) {
      sendReply({
        type: extras.type,
        message: extras.message,
        text: error
      });
    });
  }
},
{ // #### PRS COMMAND ####
  command: 'prs',
  help: "The command " + config.commandChar + "prs displays current pull requests for all monitored GitHub organizations.\n" +
    "\nUsage: " + config.commandChar + "prs [filter]" +
    "\nIf [filter] is specified, displayed pull requests will be filtered. Otherwise, pull requests for all monitored organizations will be displayed.",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const githubAllPullRequests = extras.githubAllPullRequests;

    var pullURLs = "";

    var params = getParams(this.command, message);
    if (params.length > 0) {
      var filter = params.split(' ')[0];
      var targetOrgText = "the GitHub filter '" + filter + "'";
    } else {
      var filter = null;
      var targetOrgText = "all monitored GitHub organizations";
    }

    githubAllPullRequests(filter).then(function(prs) {
      if (prs.length > 0) {
        if (! filter && prs.length > 5) {
          for (var i = 0; i < 5; i++) {
            pullURLs += "\n   " + (i + 1) + ": " + prs[i].html_url;
          }
          const replyText =  "There are currently " + prs.length + " pull requests open against " + targetOrgText + ":" + pullURLs +
            "\n To display more than the first 5 pull requests, include a filter in your command.";
          sendReply({
            type: extras.type,
            message: extras.message,
            text: replyText
          });
        } else {
          prs.forEach(function(pr, index) {
            pullURLs += "\n   " + (index + 1) + ": " + pr.html_url;
          });
          const replyText = "There are currently " + prs.length + " pull requests open against " + targetOrgText + ":" + pullURLs;
          sendReply({
            type: extras.type,
            message: extras.message,
            text: replyText
          });
        }
      } else {
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "No pull requests found for " + targetOrgText + "."
        });
      }
    }, function(error) {
      sendReply({
        type: extras.type,
        message: extras.message,
        text: error
      });
    });
  }
},
{ // #### REPOS COMMAND ####
  command: 'repos',
  help: "The command " + config.commandChar + "repos displays current repositories for monitored GitHub organizations.\n" +
    "\nUsage: " + config.commandChar + "repos [organization]\n" +
    "\nIf [organization] is specified, displayed repositories will be filtered. Otherwise, repositories for all monitored organizations will be displayed.",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const githubAllRepos = extras.githubAllRepos;

    var repoURLs = "";
    var params = getParams(this.command, message);
    if (params.length > 0) {
      var on = params.split(' ')[0].toLowerCase();
      var onFound = false;
      for (var i = 0; i < config.githubOrgs.length; i++) {
        if (config.githubOrgs[i].toLowerCase() === on) {
          onFound = true;
          break;
        }
      }
      if (onFound) {
        // first parameter is an organization name
        params = params.slice(gn.length + 1);
        var targetOrg = on;
        var targetOrgText = "the GitHub organization '" + on + "'";
      } else {
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "Not currently monitoring an organization named '" + on + "'."
        });
      }
    } else {
      var targetOrg = null;
      var targetOrgText = "all monitored GitHub organizations";
    }

    githubAllRepos(targetOrg).then(function(repos) {
      if (repos.length > 0) {
        repos.forEach(function(repo, index) {
          repoURLs += "\n   " + (index + 1) + ": " + repo.full_name + " - " + repo.html_url;
        });
        const replyText = "There are currently " + repos.length + " repositories within " + targetOrgText + ":" + repoURLs;
        sendReply({
          type: extras.type,
          message: extras.message,
          text: replyText
        });
      } else {
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "No repositories found for " + targetOrgText + "."
        });
      }
    });
  }
},
{ // #### TIPS COMMAND ####
  command: 'tips',
  help: "The command " + config.commandChar + "tips displays tips for new Mod Squad members.\n" +
    "\nUsage: " + config.commandChar + "tips [user]\n" +
    "\nIf [user] is specified, tips will be sent to that user. If 'chat' is specified as the user, tips will be sent to chat.",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const memberData = extras.memberData;

    const wasPublic = typeof extras.message.server === 'undefined' ? false : true;
    const sender = extras.message.author;

    var params = getParams(this.command, message);
    if (params.length > 0) {
      var pn = params.split(' ')[0].toLowerCase();
      if (pn !== 'chat') {
        if (!wasPublic) {
          // Only allow tips requested via PM to be sent to requester to avoid abuse
          sendReply({
            type: extras.type,
            message: extras.message,
            text: "Tips sent to " + sender + "."
          });
        } else {
          // send message as PM to specified user
          sendReply({
            type: extras.type,
            message: extras.message,
            text: "Tips sent to " + pn + "."
          });
        }
      }
    } else {
      // send message as PM to user calling !tips
      sendReply({
        type: extras.type,
        message: extras.message,
        text: "Tips sent to " + sender + "."
      });
    }

    sendReply({
      type: extras.type,
      message: extras.message,
      text: "Quick Tips: Welcome to the Mod Squad. Tips coming soon(tm)!",
      replyWithPM: wasPublic
    });
  }
},
{ // #### USERADD COMMAND ####
  command: 'useradd',
  help: "The command " + config.commandChar + "useradd adds a user to the Mod Squad member list.\n" +
    "\nUsage: " + config.commandChar + "useradd <CU User Name> <GitHub User Name> <Trello User Name>\n" +
    "\nIf a GitHub user name or Trello user name is unknown, enter 'none' for that item.",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const memberData = extras.memberData;
    const getGithubUser = extras.getGithubUser;
    const getTrelloUser = extras.getTrelloUser;

    if (! extras || ! extras.isAdmin) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "You do not have permission to add a user."
      });
    }
    var params = getParams(this.command, message);
    if (! params.length > 0) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "Usage: " + config.commandChar + "useradd <CU User Name> <GitHub User Name> <Trello User Name>"
      });
    }
    var aNames = params.split(' ');
    if (aNames.length !== 3) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "Usage: " + config.commandChar + "useradd <CU User Name> <GitHub User Name> <Trello User Name>"
      });
    }
    var curISODate = new Date().toISOString();
    var cName = aNames[0];
    var gName = aNames[1];
    var tName = aNames[2];
    if (tName.substring(0,1) === '@') tName = tName.substring(1);
    var existingMember = false;
    memberData.forEach(function(user) {
      if (user.cuUser.toLowerCase() === cName.toLowerCase()) existingMember = true;
    });
    if (existingMember) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "The user '" + cName + "' already exists."
      });
    }

    var githubPromise = getGithubUser(gName);
    var trelloPromise = getTrelloUser(tName);
    Promise.all([githubPromise, trelloPromise]).then(function(data) {
      var tFullName = data[1].fullName;
      memberData.push({
        cuUser: cName,
        githubUser: gName,
        trelloUser: tName,
        trelloName: tFullName,
        addDate: curISODate
      });
      fs.writeFile(config.memberFile, JSON.stringify(memberData), function(err) {
        if (err) {
          return util.log("[ERROR] Unable to write to member data file.");
        }
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "User '" + cName + "' added to the Mod Squad member list."
        });
        util.log("[STATUS] User '" + cName + "' added to Mod Squad member list.");
      });
    }, function(error) {
      sendReply({
        type: extras.type,
        message: extras.message,
        text: error
      });
    });
  }
},
{ // #### USERDEL COMMAND ####
  command: 'userdel',
  help: "The command " + config.commandChar + "userdel removes a user from the Mod Squad member list.\n" +
    "\nUsage: " + config.commandChar + "userdel <CU User Name>",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const memberData = extras.memberData;

    if (! extras || ! extras.isAdmin) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "You do not have permission to delete a user."
      });
    }

    var params = getParams(this.command, message);
    if (! params.length > 0) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "You must supply a user name to delete. Type " + config.commandChar + "help userdel for information."
      });
    }
    var dName = params.split(' ')[0].toLowerCase();
    var existingMember = false;
    for (var i = 0; i < memberData.length; i++) {
      if (memberData[i].cuUser.toLowerCase() === dName) {
        existingMember = true;
        memberData.splice(i, 1);
        i--;
      }
    }
    if (existingMember) {
      fs.writeFile(config.memberFile, JSON.stringify(memberData), function(err) {
        if (err) {
          return util.log("[ERROR] Unable to write to member data file.");
        }
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "The user '" + dName + "' has been deleted from the Mod Squad member list."
        });
        util.log("[STATUS] User '" + dName + "' deleted from Mod Squad member list.");
      });
    } else {
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "The user '" + dName + "' does not exist in the Mod Squad member list."
        });
    }
  }
},
{ // #### USERMOD COMMAND ####
  command: 'usermod',
  help: "The command " + config.commandChar + "usermod modifies a user in the Mod Squad member list.\n" +
    "\nUsage: " + config.commandChar + "usermod <CU User Name> <parameters>\n" +
    "\nAvailable Parameters:" +
    "\n  -g <GitHub User Name> = Specify a new GitHub user name for the Mod Squad member" +
    "\n  -t <Trello User Name> = Specify a new Trello user name for the Mod Squad member",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const memberData = extras.memberData;
    const getGithubUser = extras.getGithubUser;
    const getTrelloUser = extras.getTrelloUser;

    if (! extras || ! extras.isAdmin) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "You do not have permission to modify a user."
      });
    }

    var params = getParams(this.command, message);
    if (! params.length > 0) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "You must provide a user name to modify. Type `" + config.commandChar + "help usermod` for help."
      });
    }
    var paramArray = params.split(' ');
    var existingMember = false;
    var userToMod = null;
    memberData.forEach(function(member) {
      if (member.cuUser.toLowerCase() === paramArray[0].toLowerCase()) {
        userToMod = paramArray[0];
        existingMember = true;
      }
    });
    if (! existingMember) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "The user '" + paramArray[0] + "' does not exist in the Mod Squad member list."
      });
    }

    for (var i = 1; i < paramArray.length; i++) {
      switch(paramArray[i]) {
        case '-g':
          // verify next param exists
          if (paramArray[i + 1].search(/^[^\-]+/) === -1) {
            return sendReply({
              type: extras.type,
              message: extras.message,
              text: "The value following '-g' must be a user name."
            });
          }
          var newGitHubName = paramArray[i + 1];
          i++;
          break;
        case '-t':
          // verify next param exists
          if (paramArray[i + 1].search(/^[^\-]+/) === -1) {
            return sendReply({
              type: extras.type,
              message: extras.message,
              text: "The value following '-t' must be a user name."
            });
          }
          var newTrelloName = paramArray[i + 1];
          i++;
          break;
      }
    }

    if (! newGitHubName && ! newTrelloName) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "No parameters specified. Type `" + config.commandChar + "help usermod` for help."
      });
    }

    // verify GitHub and Trello user names are valid
    var promiseArray = [];
    if (newGitHubName) promiseArray.push(getGithubUser(newGitHubName));
    if (newTrelloName) promiseArray.push(getTrelloUser(newTrelloName));

    Promise.all(promiseArray).then(function(data) {
      // update memberData with new GitHub information
      if (newGitHubName) {
        for (var i = 0; i < memberData.length; i++) {
          if (memberData[i].cuUser.toLowerCase() === userToMod.toLowerCase()) memberData[i].githubUser = newGitHubName;
        }
      }

      // update memberData with new Trello information
      if (newTrelloName) {
        if (promiseArray.length > 1) {
          var newFullName = data[1].fullName;
        } else {
          var newFullName = data[0].fullName;
        }
        for (var i = 0; i < memberData.length; i++) {
          if (memberData[i].cuUser.toLowerCase() === userToMod.toLowerCase()) {
            memberData[i].trelloUser = newTrelloName;
            memberData[i].trelloName = newFullName;
          }
        }
      }

      // write memberData changes to file
      fs.writeFile(config.memberFile, JSON.stringify(memberData), function(err) {
        if (err) {
          return util.log("[ERROR] Unable to write to member data file.");
        }
        sendReply({
          type: extras.type,
          message: extras.message,
          text: "User '" + userToMod + "' has been modified."
        });
        util.log("[STATUS] User '" + userToMod + "' modified in Mod Squad member list.");
      });

    }, function(error) {
      sendReply({
        type: extras.type,
        message: extras.message,
        text: error
      });
    });
  }
},
{ // #### USERLIST COMMAND ####
  command: 'userlist',
  help: "The command " + config.commandChar + "userlist displays all users in the Mod Squad member list.\n" +
    "\nUsage: " + config.commandChar + "userlist",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const memberData = extras.memberData;

    const wasPublic = typeof extras.message.server === 'undefined' ? false : true;
    const sender = extras.message.author;
    if (wasPublic) {
      sendReply({
        type: extras.type,
        message: extras.message,
        text: "Mod Squad member list sent to " + sender + "."
      });
    }

    var sortedMembers = memberData.concat().sort(function(a, b) { return a.cuUser.toLowerCase().localeCompare(b.cuUser.toLowerCase()) });
    var userList = "The following users are members of the Mod Squad:";
    sortedMembers.forEach(function(member, index) {
      cName = member.cuUser;
      gName = member.githubUser;
      tName = member.trelloUser;
      tFullName = member.trelloName;
      userList += "\n #" + (index + 1) + ") " + cName + " is known as " + gName + " on GitHub and " + tFullName + " (@" + tName + ") on Trello.";
    });
    sendReply({
      type: extras.type,
      message: extras.message,
      text: userList,
      replyWithPM: wasPublic
    });
  }
},
{ // #### WHOIS COMMAND ####
  command: 'whois',
  help: "The command " + config.commandChar + "whois displays information about a particular Mod Squad member.\n" +
    "\nUsage: " + config.commandChar + "whois <username>",
  exec: function(message, extras) {
    const sendReply = extras.sendReply;
    const memberData = extras.memberData;

    var params = getParams(this.command, message);
    if (! params.length > 0) {
      return sendReply({
        type: extras.type,
        message: extras.message,
        text: "You must supply a user name."
      });
    }
    var sName = params.split(' ')[0].toLowerCase();
    var existingMember = false;
    memberData.forEach(function(member) {
      cName = member.cuUser;
      gName = member.githubUser;
      tName = member.trelloUser;
      tFullName = member.trelloName;
      if (cName.toLowerCase().search(sName) > -1 || gName.toLowerCase().search(sName) > -1 || tName.toLowerCase().search(sName) > -1 || tFullName.toLowerCase().search(sName) > -1) {
        existingMember = true;
        const replyText = cName + " is known as " + gName + " on GitHub and " + tFullName + " (@" + tName + ") on Trello.";
        return sendReply({
          type: extras.type,
          message: extras.message,
          text: replyText
        });
      }
    });
    if (! existingMember) {
      sendReply({
        type: extras.type,
        message: extras.message,
        text: "No user named '" + sName + "' exists in the Mod Squad member list."
      });
    }
  }
},
];

// Add list of available commands to the output of !help
var commandList = "";
chatCommands.forEach(function(cmd) {
  if (commandList.length > 0) commandList = commandList + ", ";
  commandList = commandList + cmd.command;
});
chatCommands[0].help = chatCommands[0].help.replace("##HELPCOMMANDS##", commandList);

// function to get parameters from a message
function getParams(command, message, index) {
  re = new RegExp('^' + config.commandChar + command +'[\ ]*', 'i');
  params = message.replace(re, '');
  if (params.length > 0) {
    if (index === undefined) {
      return params;
    } else {
      return params.split(' ')[index];
    }
  } else {
    return -1;
  }
}

module.exports = chatCommands;