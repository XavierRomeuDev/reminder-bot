# ⏰ Telegram Reminder Bot

A custom Telegram bot built with Node.js that lets users create, manage, and receive reminders directly through chat. It supports natural language dates and stores data persistently using MongoDB.

## 📁 Project Structure

- `bot.js`: Main entry point of the bot.
- `commands/`: Directory for modular command handling.
- `db/`: MongoDB database logic (connection and schema).
- `utils/`: Utility functions for date parsing and validation.
- `.env`: Environment variables.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14+)
- [MongoDB](https://www.mongodb.com/)
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### Installation

1. Clone the repository:

   git clone https://github.com/XavierRomeuDev/reminder-bot.git

2. Navigate into the project folder:

  cd reminder-bot

3. Install dependencies:

  npm install

4. Create a .env file in the root directory with the following content:

  TELEGRAM_TOKEN=your_telegram_token
  MONGODB_URI=your_mongodb_connection_string

5. Running the Bot

  node bot.js

## 🛠️ Features

  - ⌨️ Add reminders using natural language (e.g. "Remind me to take medicine at 7pm").
  - 📅 Repeating daily/weekly reminders.
  - 🗑️ Delete or list existing reminders.
  - ⏳ Supports reminders with specific dates and times.
  - 🗄️ Persistent storage using MongoDB.
  - ⏰ Sends reminders at the exact specified time.

## 💬 Supported Commands
 
  -/start – Greet the user and show available commands.
  -/remind – Add a new reminder.
  -/list – List all active reminders.
  -/delete – Delete a specific reminder.

## 🧠 Technologies Used

  Node.js
  MongoDB + Mongoose
  node-telegram-bot-api
  chrono-node (for parsing natural language dates)

## 🤝 Contributing

  Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change or add.

## 📄 License
  This project is licensed under the MIT License. See the LICENSE file for details.
