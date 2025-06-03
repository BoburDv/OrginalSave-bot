require("dotenv").config();
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const { instagramGetUrl } = require("instagram-url-direct");
const crypto = require("crypto");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const FILE = "saved.json";
const ADMIN = 7676273635;

if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "{}");

function load() {
  return JSON.parse(fs.readFileSync(FILE));
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function genId(url) {
  return crypto.createHash("md5").update(url).digest("hex");
}

bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id.toString();
  const data = load();

  if (!data[userId]) {
    const name = msg.from.username
      ? `@${msg.from.username}`
      : msg.from.first_name;
    bot.sendMessage(ADMIN, `Yangi foydalanuvchi++ ${name}`);
  }

  bot.sendMessage(
    msg.chat.id,
    "🔥 Assalomu alaykum. @OrginalSave_bot ga Xush kelibsiz!\n\n😎 Menga Instagram video havolasini yuboring.",
    {
      reply_markup: {
        keyboard: [[{ text: "📁 Saqlangan videolar" }]],
        resize_keyboard: true,
      },
    }
  );
});

bot.onText(/\/saqlangan/, showSaved);
bot.onText(/📁 Saqlangan videolar/, showSaved);

function showSaved(msg) {
  const userId = msg.from.id.toString();
  const chatId = msg.chat.id;
  const data = load();

  if (!data[userId] || data[userId].length === 0) {
    return bot.sendMessage(chatId, "📂 Saqlangan videolar mavjud emas.");
  }

  data[userId].forEach(async (item, i) => {
    try {
      await bot.sendVideo(chatId, item.file_id, {
        caption: `📁 Saqlangan #${i + 1}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🗑 O'chirish", callback_data: `delete_saved_${item.id}` }],
          ],
        },
      });
    } catch (err) {
      await bot.sendMessage(chatId, `⚠️ Video #${i + 1} yuklab bo'lmadi?`);
    }
  });
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || !text.includes("instagram.com")) return;

  const loading = await bot.sendMessage(chatId, "⏳");

  let videoUrl = null;

  try {
    const res = await instagramGetUrl(text);
    videoUrl = res?.url_list?.[0];
  } catch (err) {
    console.error("Instagram URL parsing failed:", err);
  }

  if (!videoUrl) {
    return bot.editMessageText("❌ Yuklab bo'lmadi.", {
      chat_id: chatId,
      message_id: loading.message_id,
    });
  }

  const id = genId(videoUrl);

  await bot.sendVideo(chatId, videoUrl, {
    caption: `@OrginalSave_bot 🚀`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💾 Saqlash", callback_data: `save_${id}` },
          { text: "🗑 O‘chirish", callback_data: `delete_ui_${id}` },
        ],
      ],
    },
  });

  await bot.deleteMessage(chatId, loading.message_id);
});

bot.on("callback_query", async (query) => {
  const userId = query.from.id.toString();
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = load();

  const sendAlert = (msg) =>
    bot.answerCallbackQuery(query.id, { text: msg, show_alert: true });

  if (query.data.startsWith("save_")) {
    const id = query.data.slice(5);
    const fileId = query.message.video?.file_id;
    if (!fileId) return sendAlert("⚠️ URL topilmadi.");

    if (!data[userId]) data[userId] = [];

    if (data[userId].some((v) => v.id === id)) {
      return bot.answerCallbackQuery(query.id, {
        text: "Videoni allaqachon saqlagansiz ✅",
      });
    }

    if (data[userId].length >= 10) {
      return bot.answerCallbackQuery(query.id, {
        text: "⚠️ Kechirasiz, 10 tadan ortiq video saqlay olmayman:( Videolarni o'chirib qayta urunib ko'ring.",
        show_alert: true,
      });
    }

    data[userId].push({ id, file_id: fileId });
    save(data);
    bot.answerCallbackQuery(query.id, { text: "Saqlandi ✅" });
  }

  if (query.data.startsWith("delete_ui_")) {
    bot.answerCallbackQuery(query.id, { text: "O'chirildi ✅" });
    bot.deleteMessage(chatId, messageId);
  }

  if (query.data.startsWith("delete_saved_")) {
    const id = query.data.slice(13);
    if (data[userId]) {
      data[userId] = data[userId].filter((v) => v.id !== id);
      save(data);
    }
    bot.answerCallbackQuery(query.id, { text: "O'chirildi ✅" });
    bot.deleteMessage(chatId, messageId);
  }
});
