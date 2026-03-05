require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const twilio = require("twilio");

const {
  DISCORD_BOT_TOKEN,
  CHANNEL_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_1,
  TWILIO_FROM_2,
  TWILIO_FROM_3,
  TWILIO_FROM_4,
  TWILIO_FROM_5,
  TO_NUMBER,
} = process.env;

if (!DISCORD_BOT_TOKEN || !CHANNEL_ID || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_1 || !TO_NUMBER) {
  console.error("❌ Missing environment variables.");
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
const DELAY_BETWEEN_CALLS_MS = 2000;

const FROM_NUMBERS = [
  TWILIO_FROM_1,
  TWILIO_FROM_2,
  TWILIO_FROM_3,
  TWILIO_FROM_4,
  TWILIO_FROM_5,
].filter(Boolean);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumbers(raw) {
  return (raw || "")
    .replace(/["'\n\r]/g, "")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => /^\+\d{10,15}$/.test(n));
}

function splitIntoGroups(numbers, groupCount) {
  const groups = Array.from({ length: groupCount }, () => []);
  numbers.forEach((num, i) => {
    groups[i % groupCount].push(num);
  });
  return groups;
}

async function callGroup(fromNumber, recipients, groupIndex) {
  let success = 0;
  let fail = 0;
  for (let i = 0; i < recipients.length; i++) {
    const num = recipients[i];
    try {
      console.log(`📞 [Line ${groupIndex + 1}] Calling: ${num}`);
      const call = await tw.calls.create({
        to: num,
        from: fromNumber,
        twiml: "<Response><Pause length=\"20\"/></Response>",
      });
      console.log(`✅ [Line ${groupIndex + 1}] OK: ${num} | SID: ${call.sid}`);
      success++;
    } catch (err) {
      console.error(`❌ [Line ${groupIndex + 1}] FAILED: ${num} | ${err.message}`);
      fail++;
    }
    if (i < recipients.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }
  return { success, fail };
}

async function callAllNumbers(numbers) {
  console.log(`\n📋 Total numbers: ${numbers.length}`);
  console.log(`📱 Twilio lines active: ${FROM_NUMBERS.length}`);
  const groups = splitIntoGroups(numbers, FROM_NUMBERS.length);
  groups.forEach((group, i) => {
    console.log(`   Line ${i + 1} (${FROM_NUMBERS[i]}): ${group.length} numbers`);
  });
  const results = await Promise.all(
    groups.map((group, i) => callGroup(FROM_NUMBERS[i], group, i))
  );
  const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
  const totalFail = results.reduce((sum, r) => sum + r.fail, 0);
  console.log(`\n🏁 Complete — Success: ${totalSuccess} | Failed: ${totalFail}`);
}

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
    console.log(`🔔 Trigger: "${message.content}"`);
    console.log(`👤 By: ${message.author.tag}`);
    const numbers = parseNumbers(TO_NUMBER);
    if (numbers.length === 0) {
      console.error("❌ No valid numbers found.");
      return;
    }
    await callAllNumbers(numbers);
  } catch (err) {
    console.error("🔥 Bot Error:", err?.message || err);
  }
});

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`🎯 Channel: ${CHANNEL_ID}`);
  console.log(`📱 Lines: ${FROM_NUMBERS.length}`);
  console.log(`⏱️ Cooldown: ${COOLDOWN_MS / 1000}s`);
  console.log(`🔑 Trigger: ${TRIGGER}`);
  console.log(`Waiting for @call...`);
});

client.login(DISCORD_BOT_TOKEN);
