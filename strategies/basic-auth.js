const { Logger } = require("../lib/logger");
const log = Logger.child({
    namespace: 'strategies/basic-auth',
});

const BasicStrategy = require('passport-http').BasicStrategy;
const fs = require('fs-extra');
const bcrypt = require('bcryptjs');


/*
Only bcrypt is supported
https://httpd.apache.org/docs/2.4/misc/password_encryptions.html

*/

const mandatoryVars = ['AUTH_BASIC_HTPASSWD_FILE'];
require('../lib/mandatory.js')(mandatoryVars);


const data = fs.readFileSync(process.env.AUTH_BASIC_HTPASSWD_FILE, 'ascii');
const lines = data.split("\n");
const lineCount = lines.length;
const users = {};
for (let i = 0; i < lineCount; i++) {
    let line = lines[i];
    if (!line) {
        continue;
    }
    let [username, hash, ...rest] = line.split(":");
    if (rest.length !== 0) {
        continue;
    }
    if (!hash.startsWith("$2y$")) {
        continue;
    }
    users[username] = hash;
}

const options = {
    realm: 'User',
    passReqToCallback: false
};

const authStrategy = new BasicStrategy(options, async (username, password, done) => {
    try {
        if (users[username] !== undefined) {
            const match = await bcrypt.compare(password, users[username]);
            if (match) {
                return done(null, { username });
            }
        }
        return done(null, false);
    } catch (err) {
        return done(err, null);
    }
});

const strategyName = 'basic';

module.exports = {
    strategyName,
    authStrategy
}
