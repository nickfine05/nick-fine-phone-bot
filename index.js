require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const twilio = require("twilio");

console.log("🚨 MULTI-NUMBER BUILD ACTIVE 🚨");

const {
  DISCORD_BOT_TOKEN,
  CHANNEL_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  TO_NUMBER,
} = process.env;

if (
  !DISCORD_BOT_TOKEN ||
  !CHANNEL_ID ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_FROM_NUMBER ||
  !TO_NUMBER
) {
  console.error("Missing env vars. Check your .env file.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const tw = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

let lastCallAt = 0;
const COOLDOWN_MS = 60_000;
const TRIGGER = "callout";

function parseNumbers(raw) {
  return raw
    .split(",")
    .map(n => n.trim())
    .filter(n => n.length > 0);
}

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.channelId !== CHANNEL_ID) return;

    const content = (message.content || "").toLowerCase();
    if (!content.includes(TRIGGER)) return;

    const now = Date.now();
    if (now - lastCallAt < COOLDOWN_MS) return;
    lastCallAt = now;

    const numbers = parseNumbers(TO_NUMBER);

    console.log("Numbers parsed:", numbers);

    for (const num of numbers) {
      try {
        console.log("Calling:", num);

        const call = await tw.calls.create({
          to: num,
          from: TWILIO_FROM_NUMBER,
          twiml:
            "<Response><Say voice='alice'>Discord callout triggered.</Say></Response>",
        });

        console.log("Success:", num, call.sid);
      } catch (err) {
        console.error("Failed:", num, err.message);
      }
    }
  } catch (err) {
    console.error("Error:", err?.message || err);
  }
});

client.once("clientReady", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  console.log(`Listening on channel ID: ${CHANNEL_ID}`);
});

client.login(DISCORD_BOT_TOKEN);
