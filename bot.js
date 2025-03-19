require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const Agenda = require("agenda");

// 🔹 Configuració del bot i MongoDB
const TOKEN = process.env.TELEGRAM_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

const bot = new TelegramBot(TOKEN, { polling: true });

// Conectar a MongoDB
mongoose.connect(MONGO_URI);

const agenda = new Agenda({ db: { address: MONGO_URI, collection: "jobs" } });

// 🔹 Esquema de Recordatoris
const reminderSchema = new mongoose.Schema({
  userId: Number,
  message: String,
  time: Date,
});
const Reminder = mongoose.model("Reminder", reminderSchema);

// 🔹 Processar recordatoris quan arribi l'hora
agenda.define("send reminder", async (job) => {
  const { userId, message } = job.attrs.data;
  await bot.sendMessage(userId, `🔔 Recordatori: ${message}`);
  await Reminder.deleteOne({ _id: job.attrs._id }); // Eliminar després d'enviar-lo
});

(async function () {
  await agenda.start();
})();

// 🔹 Comando /recordar
bot.onText(/\/recordar/, async (msg) => {
  const userId = msg.chat.id;

  // Afegir el diumenge a la selecció de dies
  const days = [
    "Avui",
    "Demà",
    "Dilluns",
    "Dimarts",
    "Dimecres",
    "Dijous",
    "Divendres",
    "Dissabte",
    "Diumenge",  // Afegit el diumenge
  ];
  const replyMarkup = {
    reply_markup: {
      inline_keyboard: days.map((day) => [
        { text: day, callback_data: day.toLowerCase() },
      ]),
    },
  };

  await bot.sendMessage(userId, "Selecciona el dia per al recordatori:", replyMarkup);
});

// 🔹 Gestió dels botons inline per a la selecció de data
bot.on("callback_query", async (query) => {
  const userId = query.message.chat.id;
  const callbackData = query.data;

  let selectedDate = new Date();

  // Convertir la selecció de dia a una data de JavaScript
  switch (callbackData) {
    case "avui":
      // Avui (ja és la data per defecte)
      break;
    case "demà":
      selectedDate.setDate(selectedDate.getDate() + 1);
      break;
    case "dilluns":
      selectedDate.setDate(selectedDate.getDate() + (1 - selectedDate.getDay() + 7) % 7);
      break;
    case "dimarts":
      selectedDate.setDate(selectedDate.getDate() + (2 - selectedDate.getDay() + 7) % 7);
      break;
    case "dimecres":
      selectedDate.setDate(selectedDate.getDate() + (3 - selectedDate.getDay() + 7) % 7);
      break;
    case "dijous":
      selectedDate.setDate(selectedDate.getDate() + (4 - selectedDate.getDay() + 7) % 7);
      break;
    case "divendres":
      selectedDate.setDate(selectedDate.getDate() + (5 - selectedDate.getDay() + 7) % 7);
      break;
    case "dissabte":
      selectedDate.setDate(selectedDate.getDate() + (6 - selectedDate.getDay() + 7) % 7);
      break;
    case "diumenge": // Afegit per al diumenge
      selectedDate.setDate(selectedDate.getDate() + (0 - selectedDate.getDay() + 7) % 7);
      break;
  }

  // Afegir l'hora després de seleccionar el dia
  const hours = [];
  for (let i = 7; i <= 23; i++) {
    hours.push(`${i}:00`);
    hours.push(`${i}:30`);
  }

  const timeReplyMarkup = {
    reply_markup: {
      inline_keyboard: hours.map((hour) => [
        { text: hour, callback_data: hour },
      ]),
    },
  };

  bot.sendMessage(userId, "Has seleccionat el dia. Ara selecciona l'hora:", timeReplyMarkup);

  // Esperar que seleccionin l'hora
  bot.once("callback_query", async (timeQuery) => {
    const selectedTime = timeQuery.data;

    // Verificar si s'ha seleccionat l'hora correctament
    if (!selectedTime) {
      return bot.sendMessage(userId, "❌ No has seleccionat cap hora. Intenta-ho de nou.");
    }

    // Afegir l'hora seleccionada a la data
    const [hours, minutes] = selectedTime.split(":").map(Number);
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    // Eliminar el botó de selecció d'hora per evitar que es mostri més
    bot.answerCallbackQuery(timeQuery.id);

    // Ara, afegeix el missatge per al recordatori
    bot.sendMessage(userId, "Ara, afegeix un missatge per al recordatori:");

    // Esperar missatge per afegir anotació
    bot.once("message", async (msg) => {
      if (msg.chat.id === userId && msg.text && !msg.text.startsWith("/")) {
        const messageText = `${msg.text} a les ${selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const reminder = new Reminder({
          userId,
          message: messageText,
          time: selectedDate,
        });
        await reminder.save();

        // Programar el recordatori
        await agenda.schedule(selectedDate, "send reminder", {
          userId,
          message: messageText,
        });

        bot.sendMessage(userId, `✅ Recordatori desat: "${messageText}" per a ${selectedDate.toLocaleString()}`);
      }
    });
  });

});

// 🔹 Iniciar el bot
console.log("🤖 Bot de recordatoris amb MongoDB iniciat...");
