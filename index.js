require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const twilio = require("twilio");

// =====================
// ENV VARIABLES
// =====================

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// =====================
// DISCORD CLIENT
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================
// TWILIO CLIENT
// =====================

const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
);

// =====================
// BUILD CALL LIST
// =====================

const CALL_LIST = [];

for (let i = 1; i <= 80; i++) {
  const person = process.env[`PERSON_${i}`];
  const from = process.env[`TWILIO_FROM_${((i - 1) % 24) + 1}`];

  if (person && from) {
    CALL_LIST.push({
      personIndex: i,
      to: person,
      from: from
    });
  }
}

console.log("📞 Call routing:");

CALL_LIST.forEach(entry => {
  console.log(`Person ${entry.personIndex} -> ${entry.to} will be called from ${entry.from}`);
});

// =====================
// SETTINGS
// =====================

const TRIGGER = "@call";
const COOLDOWN = 60000;

const PERSONAL_NUMBER = "+17572688203";
const PERSONAL_FROM_NUMBER = process.env.TWILIO_FROM_1;
const PERSONAL_REPEAT_COUNT = 10;
const PERSONAL_REPEAT_DELAY_MS = 60000;

let lastCallTime = 0;

// =====================
// DELAY
// =====================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================
// CALL WITH RETRY
// =====================

async function callWithRetry(target, fromNumber, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📞 Attempt ${attempt} calling ${target} from ${fromNumber}`);

      const call = await twilioClient.calls.create({
        to: target,
        from: fromNumber,
        twiml: "<Response><Say>Alert triggered</Say></Response>"
      });

      console.log(`✅ Call success SID: ${call.sid}`);
      return true;
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed for ${target}: ${error.message}`);

      if (attempt === retries) {
        console.log(`🚫 All attempts failed for ${target}`);
        return false;
      } else {
        await delay(3000);
      }
    }
  }
}

// =====================
// DISCORD EVENT
// =====================

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (message.channelId !== CHANNEL_ID) return;

  if (!message.content.toLowerCase().includes(TRIGGER)) return;

  const now = Date.now();

  if (now - lastCallTime < COOLDOWN) {
    console.log("⏳ Cooldown active");
    return;
  }

  lastCallTime = now;

  console.log(`🚀 Starting call cycle for ${CALL_LIST.length} people`);

  // =====================
  // CALL EVERYONE
  // =====================

  for (const entry of CALL_LIST) {
    await callWithRetry(entry.to, entry.from);
    await delay(700);
  }

  console.log("✅ Call cycle finished");

  // =====================
  // PERSONAL CALL LOOP
  // =====================

  for (let i = 1; i <= PERSONAL_REPEAT_COUNT; i++) {

    console.log(`📱 Personal call ${i}/${PERSONAL_REPEAT_COUNT}`);

    await callWithRetry(PERSONAL_NUMBER, PERSONAL_FROM_NUMBER);

    if (i < PERSONAL_REPEAT_COUNT) {
      console.log(`⏳ Waiting ${PERSONAL_REPEAT_DELAY_MS / 1000}s...`);
      await delay(PERSONAL_REPEAT_DELAY_MS);
    }
  }

  console.log("🏁 All personal calls complete");

});

// =====================
// READY
// =====================

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`📞 People loaded: ${CALL_LIST.length}`);
});

// =====================
// START BOT
// =====================

client.login(DISCORD_BOT_TOKEN);
