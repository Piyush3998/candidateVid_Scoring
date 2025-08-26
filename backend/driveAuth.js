const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const OAUTH_SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const CRED_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");

async function getOAuthDrive() {
  const credentials = JSON.parse(fs.readFileSync(CRED_PATH, "utf8"));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // First run: no token yet
  if (!fs.existsSync(TOKEN_PATH)) {
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: "offline", scope: OAUTH_SCOPES });
    console.log("\nAuthorize this app by visiting:\n", authUrl, "\n");
    console.log("Paste the code here and press Enter:");
    const code = await new Promise((resolve) => {
      process.stdin.resume();
      process.stdin.once("data", (d) => resolve(String(d).trim()));
    });
    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens), "utf8");
    console.log("Saved OAuth token to token.json\n");
  } else {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oAuth2Client.setCredentials(tokens);
  }

  return google.drive({ version: "v3", auth: oAuth2Client });
}
module.exports = { getOAuthDrive };
