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
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// =====================
// BUILD CALL LIST
// =====================
const CALL_LIST = [];
for (let i = 1; i <= 170; i++) {
  const person = process.env[`PERSON_${i}`];
  const from = process.env[`TWILIO_FROM_${((i - 1) % 24) + 1}`];
  if (person && from) {
    CALL_LIST.push({ personIndex: i, to: person, from: from });
  }
}

// Group by "from" number — each Twilio number runs its own lane in parallel
const CALL_GROUPS = {};
for (const entry of CALL_LIST) {
  if (!CALL_GROUPS[entry.from]) CALL_GROUPS[entry.from] = [];
  CALL_GROUPS[entry.from].push(entry);
}

console.log("📞 Call routing:");
CALL_LIST.forEach(entry => {
  console.log(`Person ${entry.personIndex} -> ${entry.to} will be called from ${entry.from}`);
});
console.log(`📦 ${CALL_LIST.length} people across ${Object.keys(CALL_GROUPS).length} parallel lanes`);

// =====================
// SETTINGS
// =====================
const COOLDOWN = 120000; // 2 minutes — bumped up since the cycle is much faster now
const INTRA_GROUP_DELAY_MS = 150; // small gap between sequential calls in a lane
const PERSONAL_NUMBER = "+17572688203";
const PERSONAL_FROM_NUMBER = process.env.TWILIO_FROM_1;
const PERSONAL_REPEAT_COUNT = 10;
const PERSONAL_REPEAT_DELAY_MS = 20000;
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
        await delay(2000);
      }
    }
  }
}

// =====================
// PROCESS ONE LANE SEQUENTIALLY
// =====================
async function processLane(fromNumber, entries) {
  for (const entry of entries) {
    await callWithRetry(entry.to, entry.from);
    await delay(INTRA_GROUP_DELAY_MS);
  }
  console.log(`✅ Lane ${fromNumber} done (${entries.length} calls)`);
}

// =====================
// DISCORD EVENT
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== CHANNEL_ID) return;

  const now = Date.now();
  if (now - lastCallTime < COOLDOWN) {
    const remaining = Math.ceil((COOLDOWN - (now - lastCallTime)) / 1000);
    console.log(`⏳ Cooldown active — ${remaining}s remaining`);
    return;
  }
  lastCallTime = now;

  const startTime = Date.now();
  console.log(`🚀 Triggered by message: "${message.content}"`);
  console.log(`📞 Firing ${CALL_LIST.length} calls across ${Object.keys(CALL_GROUPS).length} lanes`);

  // FIRE ALL LANES IN PARALLEL
  await Promise.all(
    Object.entries(CALL_GROUPS).map(([from, entries]) => processLane(from, entries))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Call cycle finished in ${elapsed}s`);

  // PERSONAL CALL LOOP
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
