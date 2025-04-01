require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const Agenda = require("agenda");

const TOKEN = process.env.TELEGRAM_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

const bot = new TelegramBot(TOKEN, { polling: true });

mongoose.connect(MONGO_URI);

const agenda = new Agenda({ db: { address: MONGO_URI, collection: "jobs" } });

const reminderSchema = new mongoose.Schema({
  userId: Number,
  message: String,
  time: Date,
  repeat: String,
});
const Reminder = mongoose.model("Reminder", reminderSchema);

agenda.define("send reminder", async (job) => {
  const { userId, message, repeat, time } = job.attrs.data;
  await bot.sendMessage(userId, `🔔 Recordatori: ${message}`);

  if (repeat === "daily") {
    await agenda.schedule(new Date(time.getTime() + 24 * 60 * 60 * 1000), "send reminder", job.attrs.data);
  } else if (repeat === "weekly") {
    await agenda.schedule(new Date(time.getTime() + 7 * 24 * 60 * 60 * 1000), "send reminder", job.attrs.data);
  } else if (repeat === "monthly") {
    let nextMonth = new Date(time);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    await agenda.schedule(nextMonth, "send reminder", job.attrs.data);
  } else {
    await Reminder.deleteOne({ _id: job.attrs._id });
  }
});

(async function () {
  await agenda.start();
})();

bot.onText(/\/recordar/, async (msg) => {
  const userId = msg.chat.id;

  const options = [
    "Avui", "Demà", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge",
    "Cada dia", "Cada setmana", "Cada mes"
  ];
  const replyMarkup = {
    reply_markup: {
      inline_keyboard: options.map((option) => [
        { text: option, callback_data: `day_${option.toLowerCase().replace(/ /g, "_")}` },
      ]),
    },
  };

  await bot.sendMessage(userId, "Selecciona el dia o la recurrència del recordatori:", replyMarkup);
});

bot.on("callback_query", async (query) => {
  const userId = query.message.chat.id;
  const callbackData = query.data;

  let selectedDate = new Date();
  let repeat = null;

  if (callbackData.startsWith("day_")) {
    const day = callbackData.replace("day_", "");
    switch (day) {
      case "avui": break;
      case "demà": selectedDate.setDate(selectedDate.getDate() + 1); break;
      case "cada_dia": repeat = "daily"; break;
      case "cada_setmana": repeat = "weekly"; break;
      case "cada_mes": repeat = "monthly"; break;
      default:
        const daysOfWeek = ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"];
        const targetDay = daysOfWeek.indexOf(day);
        selectedDate.setDate(selectedDate.getDate() + (targetDay - selectedDate.getDay() + 7) % 7);
    }

    bot.answerCallbackQuery(query.id);
    
    const hours = [];
    for (let i = 6; i <= 23; i++) {
      hours.push(`${i}:00`);
      hours.push(`${i}:15`);
      hours.push(`${i}:30`);
      hours.push(`${i}:45`);
    }

    const timeReplyMarkup = {
      reply_markup: {
        inline_keyboard: hours.map((hour) => [
          { text: hour, callback_data: `hour_${hour}_${repeat || "once"}` },
        ]),
      },
    };

    bot.sendMessage(userId, "Has seleccionat el dia. Ara selecciona l'hora:", timeReplyMarkup);
  } else if (callbackData.startsWith("hour_")) {
    const [_, selectedTime, repeatType] = callbackData.split("_");
    const [hours, minutes] = selectedTime.split(":").map(Number);
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);
    selectedDate.setHours(selectedDate.getHours() - 1);
    repeat = repeatType === "once" ? null : repeatType;

    bot.answerCallbackQuery(query.id);
    bot.sendMessage(userId, "Ara, afegeix un missatge per al recordatori:");

    bot.once("message", async (msg) => {
      if (msg.chat.id === userId && msg.text && !msg.text.startsWith("/")) {
        const messageText = `${msg.text} a les ${(new Date(selectedDate.getTime() + 60 * 60 * 1000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const reminder = new Reminder({
          userId,
          message: messageText,
          time: selectedDate,
          repeat,
        });
        await reminder.save();

        await agenda.schedule(selectedDate, "send reminder", {
          userId,
          message: messageText,
          time: selectedDate,
          repeat,
        });

        bot.sendMessage(userId, `✅ Recordatori desat: "${messageText}" per a ${selectedDate.toLocaleString()}${repeat ? " (" + repeat + ")" : ""}`);
      }
    });
  }
});

console.log("🤖 Bot de recordatoris amb MongoDB iniciat...");
