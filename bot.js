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
  await bot.sendMessage(userId, ` Recordatori: ${message}`);

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
  const inlineKeyboard = [];
  for (let i = 0; i < options.length; i += 3) {
      inlineKeyboard.push(
          options.slice(i, i + 3).map(option => ({
              text: option,
              callback_data: `day_${option.toLowerCase().replace(/ /g, "_")}`
          }))
      );
  }

  const replyMarkup = {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  };

  await bot.sendMessage(userId, "Selecciona el dia o la recurrència del recordatori:", replyMarkup);
});

const userSteps = {};

bot.on("callback_query", async (query) => {
  const userId = query.message.chat.id;
  const messageId = query.message.message_id; 
  const callbackData = query.data;

  try { 
      if (callbackData.startsWith("day_")) {
          const day = callbackData.replace("day_", "");
          let selectedDate = new Date(); 
          let repeat = null; 
          let dayText = ""; 

          switch (day) {
              case "avui": dayText = "avui"; break; 
              case "demà":
                  selectedDate.setDate(selectedDate.getDate() + 1);
                  dayText = "demà";
                  break;
              case "cada_dia": repeat = "daily"; dayText = "cada dia"; break;
              case "cada_setmana": repeat = "weekly"; dayText = "cada setmana"; break;
              case "cada_mes": repeat = "monthly"; dayText = "cada mes"; break;
              default: 
                  const daysOfWeek = { dilluns: 1, dimarts: 2, dimecres: 3, dijous: 4, divendres: 5, dissabte: 6, diumenge: 0 };
                  const targetDay = daysOfWeek[day];
                  dayText = day.charAt(0).toUpperCase() + day.slice(1); 

                  if (targetDay !== undefined) {
                      const currentDay = selectedDate.getDay();
                      let daysToAdd = (targetDay - currentDay + 7) % 7;
                      if (daysToAdd === 0 && selectedDate.getHours() >= 0) { 
                         daysToAdd = 7;
                      }
                       if (daysToAdd === 0 && targetDay === currentDay) { 
                           daysToAdd = 7;
                      } else if (daysToAdd === 0) {
                      }

                      selectedDate.setDate(selectedDate.getDate() + daysToAdd);
                  }
                  break;
          }

          userSteps[userId] = { step: "awaiting_time", date: selectedDate, repeat: repeat, daySelectionText: dayText };

          await bot.answerCallbackQuery(query.id);

          const hours = [];
          for (let i = 0; i <= 23; i++) {
               hours.push(`${String(i).padStart(2, '0')}:00`);
               hours.push(`${String(i).padStart(2, '0')}:15`);
               hours.push(`${String(i).padStart(2, '0')}:30`);
               hours.push(`${String(i).padStart(2, '0')}:45`);
          }

          const timeInlineKeyboard = [];
          const buttonsPerRow = 4; 
          for (let i = 0; i < hours.length; i += buttonsPerRow) {
              timeInlineKeyboard.push(
                  hours.slice(i, i + buttonsPerRow).map(hour => ({
                      text: hour,
                      callback_data: `hour_${hour}` 
                  }))
              );
          }


          const timeReplyMarkup = {
              reply_markup: {
                  inline_keyboard: timeInlineKeyboard,
              },
          };

          await bot.editMessageText(`Has seleccionat: ${dayText}. Ara selecciona l'hora:`, {
              chat_id: userId,
              message_id: messageId,
              ...timeReplyMarkup 
          });


      } else if (callbackData.startsWith("hour_")) {
          if (!userSteps[userId] || userSteps[userId].step !== "awaiting_time") {
              await bot.answerCallbackQuery(query.id, { text: "Si us plau, comença seleccionant el dia primer amb /recordar.", show_alert: true });
              return; 
          }

          const selectedTime = callbackData.replace("hour_", "");
          const [hours, minutes] = selectedTime.split(":").map(Number);

          let selectedDate = new Date(userSteps[userId].date); 
          const repeat = userSteps[userId].repeat;

          selectedDate.setHours(hours);
          selectedDate.setMinutes(minutes);
          selectedDate.setSeconds(0);
          selectedDate.setMilliseconds(0);

           if (selectedDate < new Date()) {
                if (repeat) {
                    if (repeat === "daily") {
                        selectedDate.setDate(selectedDate.getDate() + 1);
                    } else if (repeat === "weekly") {
                        selectedDate.setDate(selectedDate.getDate() + 7);
                    } else if (repeat === "monthly") {
                        selectedDate.setMonth(selectedDate.getMonth() + 1);
                         const originalDayOfMonth = new Date(userSteps[userId].date).getDate();
                         if (selectedDate.getDate() !== originalDayOfMonth) {
                            selectedDate.setDate(0); 
                        }
                    }
                     console.log(`Hora passada per a recordatori recurrent. Ajustada a la propera ocurrència: ${selectedDate}`);
                } else {
                    await bot.answerCallbackQuery(query.id);
                    await bot.editMessageText(
                        `❌ L'hora seleccionada (${selectedDate.toLocaleString()}) ja ha passat. Si us plau, comença de nou amb /recordar i selecciona una hora futura.`,
                        { chat_id: userId, message_id: messageId }
                    );
                    delete userSteps[userId];
                    return;
                }
           }

          userSteps[userId].step = "awaiting_message";
          userSteps[userId].date = selectedDate;

          await bot.answerCallbackQuery(query.id);

          await bot.editMessageText(`Recordatori per a ${selectedDate.toLocaleString()}. Ara, escriu el missatge del recordatori:`, {
              chat_id: userId,
              message_id: messageId
          });

          bot.removeListener("message", handleReminderMessage); 
          bot.on("message", handleReminderMessage); 

      }
  } catch (error) {
       console.error("Error en callback_query:", error);
       await bot.answerCallbackQuery(query.id, { text: "Hi ha hagut un error.", show_alert: true });
       if (userSteps[userId]) {
           delete userSteps[userId];
       }
  }
});

async function handleReminderMessage(msg) {
    const userId = msg.chat.id;

    if (!userSteps[userId] || userSteps[userId].step !== "awaiting_message") {
        if (!msg.text || msg.text.startsWith('/')) return;
        return;
    }

    if (msg.text && !msg.text.startsWith("/")) {
        const messageText = msg.text; 
        const finalDate = new Date(userSteps[userId].date); 
        const repeat = userSteps[userId].repeat;

        const reminderData = { 
            userId,
            message: messageText,
            time: finalDate,
            repeat,
        };
        delete userSteps[userId]; 
        bot.removeListener("message", handleReminderMessage);


        try { 
            const reminder = new Reminder(reminderData);
            await reminder.save();

            const jobData = { ...reminderData, _id: reminder._id };

            if (finalDate >= new Date()) {
                 await agenda.schedule(finalDate, "send reminder", jobData);
            } else {
                 console.warn(`Intentant agendar un recordatori (${reminder._id}) amb data passada: ${finalDate}`);
                 if(repeat) {
                     await agenda.schedule(finalDate, "send reminder", jobData);
                 }
            }


            const confirmationMsg = `✅ Recordatori desat: "${messageText}" per a ${finalDate.toLocaleString()}${repeat ? ` (recurrencia: ${userSteps[userId]?.daySelectionText || repeat})` : ""}`;

            await bot.sendMessage(userId, confirmationMsg);

        } catch (dbError) {
            console.error("Error guardant o agendant el recordatori:", dbError);
            await bot.sendMessage(userId, "❌ Ho sento, hi ha hagut un error al desar el recordatori.");
        }
    } else if (msg.text && msg.text.startsWith("/")) {
         console.log(`Comando ${msg.text} recibido mientras se esperaba mensaje. Cancelando recordatorio.`);
         delete userSteps[userId];
         bot.removeListener("message", handleReminderMessage);
    }
}


console.log(" Bot de recordatoris amb MongoDB iniciat...");