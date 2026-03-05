require("dotenv").config();
2const { Client, GatewayIntentBits } = require("discord.js");
3const twilio = require("twilio");
4
5const {
6  DISCORD_BOT_TOKEN,
7  CHANNEL_ID,
8  TWILIO_ACCOUNT_SID,
9  TWILIO_AUTH_TOKEN,
10  TWILIO_FROM_1,
11  TWILIO_FROM_2,
12  TWILIO_FROM_3,
13  TWILIO_FROM_4,
14  TWILIO_FROM_5,
15  TO_NUMBER,
16} = process.env;
17
18if (
19  !DISCORD_BOT_TOKEN ||
20  !CHANNEL_ID ||
21  !TWILIO_ACCOUNT_SID ||
22  !TWILIO_AUTH_TOKEN ||
23  !TWILIO_FROM_1 ||
24  !TO_NUMBER
25) {
26  console.error("❌ Missing environment variables.");
27  process.exit(1);
28}
29
30const client = new Client({
31  intents: [
32    GatewayIntentBits.Guilds,
33    GatewayIntentBits.GuildMessages,
34    GatewayIntentBits.MessageContent,
35  ],
36});
37
38const tw = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
39
40let lastCallAt = 0;
41const COOLDOWN_MS = 60_000;
42const TRIGGER = "@call";
43const DELAY_BETWEEN_CALLS_MS = 2000;
44
45const FROM_NUMBERS = [
46  TWILIO_FROM_1,
47  TWILIO_FROM_2,
48  TWILIO_FROM_3,
49  TWILIO_FROM_4,
50  TWILIO_FROM_5,
51].filter(Boolean);
52
53function sleep(ms) {
54  return new Promise((resolve) => setTimeout(resolve, ms));
55}
56
57function parseNumbers(raw) {
58  return (raw || "")
59    .replace(/["'\n\r]/g, "")
60    .split(",")
61    .map((n) => n.trim())
62    .filter((n) => /^\+\d{10,15}$/.test(n));
63}
64
65function splitIntoGroups(numbers, groupCount) {
66  const groups = Array.from({ length: groupCount }, () => []);
67  numbers.forEach((num, i) => {
68    groups[i % groupCount].push(num);
69  });
70  return groups;
71}
72
73async function callGroup(fromNumber, recipients, groupIndex) {
74  let success = 0;
75  let fail = 0;
76
77  for (let i = 0; i < recipients.length; i++) {
78    const num = recipients[i];
79    try {
80      console.log(`📞 [Line ${groupIndex + 1}] Calling: ${num}`);
81      const call = await tw.calls.create({
82        to: num,
83        from: fromNumber,
84        twiml: "<Response><Pause length=\"20\"/></Response>",
85      });
86      console.log(`✅ [Line ${groupIndex + 1}] OK: ${num} | SID: ${call.sid}`);
87      success++;
88    } catch (err) {
89      console.error(`❌ [Line ${groupIndex + 1}] FAILED: ${num} | ${err.message}`);
90      fail++;
91    }
92
93    if (i < recipients.length - 1) {
94      await sleep(DELAY_BETWEEN_CALLS_MS);
95    }
96  }
97
98  return { success, fail };
99}
100
101async function callAllNumbers(numbers) {
102  console.log(`\n📋 Total numbers: ${numbers.length}`);
103  console.log(`📱 Twilio lines active: ${FROM_NUMBERS.length}`);
104
105  const groups = splitIntoGroups(numbers, FROM_NUMBERS.length);
106
107  groups.forEach((group, i) => {
108    console.log(`   Line ${i + 1} (${FROM_NUMBERS[i]}): ${group.length} numbers`);
109  });
110
111  const results = await Promise.all(
112    groups.map((group, i) => callGroup(FROM_NUMBERS[i], group, i))
113  );
114
115  const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
116  const totalFail = results.reduce((sum, r) => sum + r.fail, 0);
117
118  console.log(`\n🏁 Complete — Success: ${totalSuccess} | Failed: ${totalFail}`);
119}
120
121client.on("messageCreate", async (message) => {
122  try {
123    if (message.author.bot) return;
124    if (message.channelId !== CHANNEL_ID) return;
125
126    const content = (message.content || "").toLowerCase();
127    if (!content.includes(TRIGGER)) return;
128
129    const now = Date.now();
130    if (now - lastCallAt < COOLDOWN_MS) {
131      const remaining = Math.ceil((COOLDOWN_MS - (now - lastCallAt)) / 1000);
132      console.log(`⏳ Cooldown active. ${remaining}s remaining.`);
133      return;
134    }
135
136    lastCallAt = now;
137
138    console.log(`🔔 Trigger: "${message.content}"`);
139    console.log(`👤 By: ${message.author.tag}`);
140
141    const numbers = parseNumbers(TO_NUMBER);
142
143    if (numbers.length === 0) {
144      console.error("❌ No valid numbers found.");
145      return;
146    }
147
148    await callAllNumbers(numbers);
149
150  } catch (err) {
151    console.error("🔥 Bot Error:", err?.message || err);
152  }
153});
154
155client.once("ready", () => {
156  console.log(`🤖 Logged in as ${client.user.tag}`);
157  console.log(`🎯 Channel: ${CHANNEL_ID}`);
158  console.log(`📱 Lines: ${FROM_NUMBERS.length}`);
159  console.log(`⏱️ Cooldown: ${COOLDOWN_MS / 1000}s`);
160  console.log(`🔑 Trigger: ${TRIGGER}`);
161  console.log(`Waiting for @call...`);
162});
163
164client.login(DISCORD_BOT_TOKEN);
