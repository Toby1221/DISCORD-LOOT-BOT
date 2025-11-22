🤖 Discord Loot Bot (Node.js + Gemini API)

This bot is a hybrid application built on Node.js. It features a Discord client for handling commands and an Express server for handling a keep-alive endpoint, ensuring it stays awake when deployed to platforms like Render. The core function uses the Gemini API to analyze external resources and generate a dynamic, structured "Loot Report."

1. Core Functionality

Command: !loot

Result: The bot generates a structured report analyzing item data and designating a fictional "Hot Zone" (Tier IV map) with an exciting event, presented in a rich Discord embed.

Keep-Alive: An Express server runs concurrently to maintain the application's uptime on free cloud hosting.

2. Prerequisites

Node.js: Ensure you have Node.js (v18+) installed.

Discord Bot: A Discord Application and Bot User with the necessary permissions (Send Messages, Embed Links, and Message Content intent enabled in the Discord Developer Portal).

API Key: A valid Gemini API Key for content generation.

3. Local Installation & Setup

Clone the repository:

git clone [YOUR_REPO_URL]
cd discord-loot-bot


Install Dependencies:

npm install


(This installs discord.js, express, dotenv, and node-fetch.)

Configure Environment Variables:
Create a file named .env in the root directory and add your secrets. This file is excluded by your .gitignore for security.

DISCORD_BOT_TOKEN="YOUR_ACTUAL_DISCORD_BOT_TOKEN_HERE"
GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY_HERE"


4. Running the Bot

Run the bot from your terminal using the start script defined in package.json:

npm start


This executes node server.js. The console will show both the Express server starting and the Discord bot logging in.

5. Deployment & Keep-Alive

For deployment on platforms like Render, the application is configured to prevent sleeping:

Endpoint: The Express server exposes a route at /ping.

Self-Ping: To keep the service awake, set up an external service (like Uptime Robot or a similar free monitoring tool) to send an HTTP GET request to the following URL every 5-10 minutes:
https://[YOUR_RENDER_SERVICE_URL]/ping