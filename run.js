const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = "DEIN_GITHUB_TOKEN";
const REPO_OWNER = "DEIN_GITHUB_NUTZERNAME";
const REPO_NAME = "DEIN_REPO_NAME";
const DISCORD_BOT_TOKEN = "DEIN_DISCORD_BOT_TOKEN";

async function fetchFromGitHub(fileName) {
    const url = `https://api.github.com{REPO_OWNER}/${REPO_NAME}/contents/${fileName}`;
    const response = await axios.get(url, {
        headers: { 
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.raw'
        }
    });
    return response.data;
}

async function start() {
    const config = await fetchFromGitHub("config.json");
    const logicCode = await fetchFromGitHub("logic.js");
    
    const tempPath = path.join(__dirname, 'temp_logic.js');
    fs.writeFileSync(tempPath, typeof logicCode === 'string' ? logicCode : JSON.stringify(logicCode));

    const { initializeBot } = require('./temp_logic.js');
    initializeBot(config, DISCORD_BOT_TOKEN);
}

start();
