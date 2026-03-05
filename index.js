require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const twilio = require("twilio");

// =========================
// ENV VARIABLES
// =========================

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const TO_NUMBER = process.env.TO_NUMBER;

const TWILIO_FROM_1 = process.env.TWILIO_FROM_1;
const TWILIO_FROM_2 = process.env.TWILIO_FROM_2;
const TWILIO_FROM_3 = process.env.TWILIO_FROM_3;
const TWILIO_FROM_4 = process.env.TWILIO_FROM_4;
const TWILIO_FROM_5 = process.env.TWILIO_FROM_5;

// =========================
// BASIC CHECK
// =========================

if (
  !DISCORD_BOT_TOKEN ||
  !CHANNEL_ID ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN
) {
  console.log("❌ Missing environment variables");
  process.exit(1);
}

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// TWILIO CLIENT
// =========================

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// =========================
// TWILIO NUMBER POOL
// =========================

const TWILIO_NUMBERS = [
  TWILIO_FROM_1,
  TWILIO_FROM_2,
  TWILIO_FROM_3,
  TWILIO_FROM_4,
  TWILIO_FROM_5
].filter(Boolean);

let numberIndex = 0;

function getNextTwilioNumber() {
  const number = TWILIO_NUMBERS[numberIndex];
  numberIndex = (numberIndex + 1) % TWILIO_NUMBERS.length;
  return number;
}

// =========================
// SETTINGS
// =========================

const TRIGGER = "@call";
const COOLDOWN = 60000;

let lastCallTime = 0;

// =========================
// NUMBER PARSER
// =========================

function getTargetNumbers() {
  return (TO_NUMBER || "")
    .replace(/["'\n\r]/g, "")
    .split(",")
    .map(n => n.trim())
    .filter(n => /^\+\d{10,15}$/.test(n));
}

// =========================
// CALL WITH RETRY
// =========================

async function callWithRetry(number, retries = 3) {

  for (let i = 1; i <= retries; i++) {

    const fromNumber = getNextTwilioNumber();

    try {

      console.log(`📞 Attempt ${i} calling ${number} from ${fromNumber}`);

      const call = await twilioClient.calls.create({
        to: number,
        from: fromNumber,
        twiml: "<Response><Say>Alert triggered</Say></Response>"
      });

      console.log(`✅ Call success SID: ${call.sid}`);

      return;

    } catch (error) {

      console.log(`❌ Attempt ${i} failed`);

      if (i === retries) {
        console.log(`🚫 All attempts failed for ${number}`);
      } else {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}

// =========================
// DISCORD EVENT
// =========================

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channelId !== CHANNEL_ID) return;

  const content = message.content.toLowerCase();

  if (!content.includes(TRIGGER)) return;

  const now = Date.now();

  if (now - lastCallTime < COOLDOWN) {
    console.log("⏳ Cooldown active");
    return;
  }

  lastCallTime = now;

  const numbers = getTargetNumbers();

  if (!numbers.length) {
    console.log("❌ No valid target numbers");
    return;
  }

  console.log("🚀 Starting call cycle");

  for (const number of numbers) {
    await callWithRetry(number, 3);
  }

  console.log("✅ Call cycle complete");

});

// =========================
// READY
// =========================

client.once("ready", () => {

  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`📡 Monitoring channel ${CHANNEL_ID}`);

});

// =========================
// START BOT
// =========================

client.login(DISCORD_BOT_TOKEN);
