require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const twilio = require("twilio");

// =======================
// ENV VARIABLES
// =======================

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const TO_NUMBER = process.env.TO_NUMBER;

// =======================
// TWILIO NUMBERS
// =======================

const TWILIO_NUMBERS = Object.keys(process.env)
  .filter(key => key.startsWith("TWILIO_FROM_"))
  .map(key => process.env[key])
  .filter(Boolean);

if (!TWILIO_NUMBERS.length) {
  console.log("❌ No Twilio numbers configured");
  process.exit(1);
}

// =======================
// DISCORD CLIENT
// =======================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =======================
// TWILIO CLIENT
// =======================

const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
);

// =======================
// SETTINGS
// =======================

const TRIGGER = "@call";
const COOLDOWN = 60000;

let lastCallTime = 0;
let numberIndex = 0;

// =======================
// GET NEXT CALLER ID
// =======================

function getNextTwilioNumber() {

  const number = TWILIO_NUMBERS[numberIndex];

  numberIndex++;

  if (numberIndex >= TWILIO_NUMBERS.length) {
    numberIndex = 0;
  }

  return number;
}

// =======================
// PARSE TARGET NUMBERS
// =======================

function getTargetNumbers() {

  return (TO_NUMBER || "")
    .replace(/["'\n\r]/g, "")
    .split(",")
    .map(n => n.trim())
    .filter(n => /^\+\d{10,15}$/.test(n));

}

// =======================
// DELAY FUNCTION
// =======================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =======================
// CALL WITH RETRY
// =======================

async function callWithRetry(target, retries = 3) {

  for (let attempt = 1; attempt <= retries; attempt++) {

    const fromNumber = getNextTwilioNumber();

    try {

      console.log(`📞 Attempt ${attempt} calling ${target} from ${fromNumber}`);

      const call = await twilioClient.calls.create({
        to: target,
        from: fromNumber,
        twiml: "<Response><Say>Alert triggered</Say></Response>"
      });

      console.log(`✅ Call success SID: ${call.sid}`);

      return;

    } catch (error) {

      console.log(`❌ Attempt ${attempt} failed: ${error.message}`);

      if (attempt === retries) {
        console.log(`🚫 All attempts failed for ${target}`);
      } else {
        await delay(3000);
      }

    }

  }

}

// =======================
// DISCORD EVENT
// =======================

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

  const targets = getTargetNumbers();

  if (!targets.length) {
    console.log("❌ No valid numbers in TO_NUMBER");
    return;
  }

  console.log(`🚀 Starting call cycle for ${targets.length} people`);

  for (const target of targets) {

    await callWithRetry(target, 3);

    // small delay so Twilio doesn't drop calls
    await delay(700);

  }

  console.log("✅ Call cycle finished");

});

// =======================
// READY
// =======================

client.once("ready", () => {

  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`📡 Listening on channel ${CHANNEL_ID}`);
  console.log(`📞 Twilio numbers loaded: ${TWILIO_NUMBERS.length}`);

});

// =======================
// START BOT
// =======================

client.login(DISCORD_BOT_TOKEN);
