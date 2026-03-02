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

// ===============================
// ENV VALIDATION
// ===============================
if (
  !DISCORD_BOT_TOKEN ||
  !CHANNEL_ID ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_FROM_NUMBER ||
  !TO_NUMBER
) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

// ===============================
// DISCORD CLIENT
// ===============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ===============================
// TWILIO CLIENT
// ===============================
const tw = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ===============================
// SETTINGS
// ===============================
let lastCallAt = 0;
const COOLDOWN_MS = 60_000;
const TRIGGER = "@call";
const DELAY_BETWEEN_CALLS_MS = 1000;

// ===============================
// SLEEP HELPER
// ===============================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===============================
// SAFE NUMBER PARSER
// ===============================
function parseNumbers(raw) {
  return (raw || "")
    .replace(/["'\n\r]/g, "")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => /^\+\d{10,15}$/.test(n));
}

// ===============================
// CALL ALL NUMBERS SEQUENTIALLY
// ===============================
async function callAllNumbers(numbers) {
  console.log(`📋 Total numbers to call: ${numbers.length}`);
  console.log("Numbers:", numbers);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < numbers.length; i++) {
    const num = numbers[i];
    const position = `${i + 1} of ${numbers.length}`;

    try {
      console.log(`📞 Calling ${position}: ${num}`);

      const call = await tw.calls.create({
        to: num,
        from: TWILIO_FROM_NUMBER,
        twiml: "<Response><Say>Trade alert triggered. Check your positions now.</Say></Response>",
      });

      console.log(`✅ Called ${position}: ${num} | SID: ${call.sid}`);
      successCount++;

    } catch (err) {
      console.error(`❌ FAILED ${position}: ${num}`);
      console.error(`Reason: ${err.message}`);
      failCount++;
    }

    // Wait between calls except after the last one
    if (i < numbers.length - 1) {
      console.log(`⏳ Waiting ${DELAY_BETWEEN_CALLS_MS}ms before next call...`);
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  console.log(`🏁 Call cycle complete. Success: ${successCount} | Failed: ${failCount}`);
}

// ===============================
// MESSAGE HANDLER
// ===============================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.channelId !== CHANNEL_ID) return;

    const content = (message.content || "").toLowerCase();
    if (!content.includes(TRIGGER)) return;

    const now = Date.now();
    if (now - lastCallAt < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastCallAt)) / 1000);
      console.log(`⏳ Cooldown active. ${remaining}s remaining.`);
      return;
    }

    lastCallAt = now;

    console.log(`🔔 Trigger detected in message: "${message.content}"`);
    console.log(`👤 Triggered by: ${message.author.tag}`);

    const numbers = parseNumbers(TO_NUMBER);

    if (numbers.length === 0) {
      console.error("❌ No valid numbers found. Check TO_NUMBER format.");
      return;
    }

    await callAllNumbers(numbers);

  } catch (err) {
    console.error("🔥 Bot Error:", err?.message || err);
  }
});

// ===============================
// READY EVENT
// ===============================
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`🎯 Listening on channel: ${CHANNEL_ID}`);
  console.log(`🔑 Trigger word: ${TRIGGER}`);
  console.log(`⏱️ Cooldown: ${COOLDOWN_MS / 1000}s`);
  console.log(`📞 Delay between calls: ${DELAY_BETWEEN_CALLS_MS}ms`);
});

// ===============================
// LOGIN
// ===============================
client.login(DISCORD_BOT_TOKEN);
