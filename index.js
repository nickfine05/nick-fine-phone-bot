require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const twilio = require("twilio");

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
const TRIGGER = "@call";

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.channelId !== CHANNEL_ID) return;

    const content = (message.content || "").toLowerCase();
    if (!content.includes(TRIGGER)) return;

    const now = Date.now();
    if (now - lastCallAt < COOLDOWN_MS) return;
    lastCallAt = now;

    await tw.calls.create({
      to: TO_NUMBER,
      from: TWILIO_FROM_NUMBER,
      twiml:
        "<Response><Say voice='alice'>Discord callout triggered. Check callout test channel.</Say></Response>",
    });

    console.log("Call placed successfully.");
  } catch (err) {
    console.error("Error:", err?.message || err);
  }
});

client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  console.log(`Listening on channel ID: ${CHANNEL_ID}`);
});

client.login(DISCORD_BOT_TOKEN);
