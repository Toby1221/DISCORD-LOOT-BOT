# Discord Loot Bot

A Discord bot powered by Node.js, Express (for keep-alive), and the Gemini API for dynamic loot reports.

## Overview

This is a Discord bot that responds to the `!loot` command by using Google's Gemini AI to analyze map guides from arcraidersmap.app and generate fictional loot intelligence reports.

## Project Structure

- `server.js` - Main application file containing both the Discord bot and Express server
- `package.json` - Node.js dependencies and scripts

## Required Environment Variables

The following secrets must be configured for the bot to work:

- `DISCORD_BOT_TOKEN` - Your Discord bot token from the Discord Developer Portal
- `GEMINI_API_KEY` - Your Google Gemini API key

## Running the Bot

The bot runs on port 5000 and includes:
- Discord bot that responds to `!loot` command
- Express server with `/ping` endpoint for keep-alive
- Root endpoint `/` showing service status

## Commands

- `!loot` - Generates an AI-powered loot intelligence report analyzing game map data
