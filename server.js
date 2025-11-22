// This file sets up a combined Node.js application:
// 1. An Express Server for handling self-ping (Keep-Alive) on Render.
// 2. A Discord Bot client using discord.js for the !loot command.

// To run this file:
// 1. Initialize Node project: npm init -y
// 2. Install dependencies: npm install express discord.js dotenv node-fetch
// 3. Create a .env file (see instructions below).
// 4. Run: node server.js

// --- 1. Load Environment Variables (DOTENV) ---
require('dotenv').config();

const express = require('express');
const { Client, IntentsBitField, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

// --- Configuration & Global Constants ---

// IMPORTANT: The tokens are now pulled from the .env file / environment variables.
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const PORT = process.env.PORT || 3000;

// Gemini API Configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";

// The target URL for the analysis
const ARCRADERS_MAP_URL = "https://arcraidersmap.app/";

// --- Removed SIMULATED FALLBACK DATA as the goal is to analyze the provided site ---


// Define the structure the model must return for the loot data (JSON Schema)
const LOOT_REPORT_SCHEMA = {
    type: "OBJECT",
    description: "The loot report summarizing the current hot zone.",
    properties: {
        hotZoneMapName: { type: "STRING", description: "The name of the map currently considered the 'Hot Zone' (e.g., Dam Battlegrounds, Spaceport, Buried City)." },
        hotZoneEvent: { type: "STRING", description: "An exciting event name or description for the hot zone." },
        hotZoneLootDescription: { type: "STRING", description: "A description of what high-value gear/materials are expected there, referencing the provided site's content and guides." },
        otherMaps: {
            type: "ARRAY",
            description: "List of the other two maps and their lower tier status.",
            items: {
                type: "OBJECT",
                properties: {
                    mapName: { type: "STRING" },
                    lootTier: { type: "STRING", description: "e.g., 'Tier I', 'Tier II', 'Tier III'. Must not be Tier IV." },
                    eventName: { type: "STRING", description: "A brief, low-key event name for the map." }
                },
                required: ["mapName", "lootTier", "eventName"]
            }
        }
    },
    required: ["hotZoneMapName", "hotZoneEvent", "hotZoneLootDescription", "otherMaps"]
};

// --- Utility Functions for API Communication ---

/**
 * Sends a request to a specified URL with exponential backoff.
 * Note: Only used here for the Gemini API call, as external browsing is handled by Gemini's tool.
 */
async function getApiResponseWithRetry(url, isGemini = false, payload = null, maxRetries = 5) {
    const headers = isGemini ? { 'Content-Type': 'application/json' } : {};
    const data = isGemini && payload ? JSON.stringify(payload) : null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: isGemini ? 'POST' : 'GET',
                headers: headers,
                body: data,
                timeout: 30000 // Increased to 30 seconds for Gemini/Grounding operations
            });

            if (response.status === 200) {
                return await response.json();
            } else if ([429, 500, 503].includes(response.status) && attempt < maxRetries - 1) {
                const delay = 2 ** attempt + Math.random();
                console.log(`[${new Date().toLocaleTimeString()}] API Call failed (Status: ${response.status}). Retrying in ${delay.toFixed(2)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            } else {
                const responseText = await response.text();
                console.log(`[${new Date().toLocaleTimeString()}] API Call failed permanently (Status: ${response.status}, Response: ${responseText.substring(0, 100)}...)`);
                return { error: `API request failed with status ${response.status}` };
            }
        } catch (e) {
            if (attempt < maxRetries - 1) {
                const delay = 2 ** attempt + Math.random();
                console.log(`[${new Date().toLocaleTimeString()}] Network error: ${e.message}. Retrying in ${delay.toFixed(2)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            } else {
                console.log(`[${new Date().toLocaleTimeString()}] Network error after ${maxRetries} attempts: ${e.message}`);
                return { error: `Network error: ${e.message}` };
            }
        }
    }
    return { error: "Max retries exceeded" };
}

/**
 * Uses Gemini's Google Search grounding to analyze the target site
 * and generate a structured report based on the guides and map layouts.
 */
async function fetchAndSynthesizeLootData() {
    console.log(`[${new Date().toLocaleTimeString()}] Preparing Gemini request for site analysis...`);

    // 1. Prepare Prompt for Gemini
    // *** Updated systemPrompt to require clean JSON output since structured output cannot be used with grounding. ***
    const systemPrompt = (
        "You are the Strategic Operations Analyst for a looter game. " +
        "Your task is to use the Google Search grounding tool to analyze external web resources, specifically guides and map layouts. " +
        "Based on the analysis, generate a fictional but highly engaging real-time 'Loot Report'. " +
        "The report MUST be returned as a single, clean JSON object that strictly follows the requested flat structure, with NO extra text, markdown, or commentary outside the JSON block. " +
        "The maps you must choose from are: 'Dam Battlegrounds', 'Spaceport', or 'Buried City'."
    );
    
    // The query now explicitly details the required top-level JSON fields to force compliance.
    const userQuery = (
        `Analyze the guides and map layouts found on the website ${ARCRADERS_MAP_URL} ` +
        `to determine which of the three main maps ('Dam Battlegrounds', 'Spaceport', 'Buried City') is currently the "Hot Zone" (Tier IV equivalent). ` +
        `The report MUST strictly use the following fields at the top level: ` +
        `1. 'hotZoneMapName' (string, the Hot Zone map name). ` +
        `2. 'hotZoneEvent' (string, an exciting event name for the hot zone). ` +
        `3. 'hotZoneLootDescription' (string, describing the high-value loot based on the site's content). ` +
        `4. 'otherMaps' (array of exactly two objects, detailing the two lower-tier maps, each with 'mapName', 'lootTier', and 'eventName'). ` +
        `Generate the full JSON report now based on this exact structure.`
    );


    // 2. Prepare the payload with Google Search grounding
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ "google_search": {} }] // Enable grounding
    };

    console.log(`[${new Date().toLocaleTimeString()}] Calling Gemini API to synthesize report using grounding...`);
    
    if (!GEMINI_API_KEY) {
        return { error: "GEMINI_API_KEY is not set in environment variables." };
    }

    // 3. Call Gemini API
    const apiResponse = await getApiResponseWithRetry(
        `${GEMINI_API_URL}${GEMINI_API_KEY}`, 
        true, // isGemini = true
        payload
    );

    if (apiResponse.error) {
        console.log(`Failed to synthesize report: ${apiResponse.error}`);
        return { error: `Failed to synthesize report: ${apiResponse.error}` };
    }

    try {
        // *** Robust parsing logic to handle the text response containing JSON ***
        let rawText = apiResponse.candidates[0].content.parts[0].text;
        
        // LOGGING: Print the raw output for debugging JSON issues
        console.log(`[${new Date().toLocaleTimeString()}] Raw Gemini Output:`, rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''));


        let jsonString = rawText.trim();
        
        // Safety check: Remove markdown fencing if the model added it (e.g., ```json{...}```)
        if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```json\s*|```$/g, '').trim();
        }

        const report = JSON.parse(jsonString);

        // Explicit validation check for key fields (Now we expect the flat structure we forced in the prompt)
        if (!report.hotZoneMapName || !report.otherMaps || report.otherMaps.length !== 2) {
             throw new Error("Generated JSON is missing the hotZoneMapName or does not contain two otherMaps. The model returned a nested or malformed structure.");
        }
        
        return report;
    } catch (e) {
        console.error(`Error parsing or validating Gemini response: ${e.message}`, apiResponse);
        return { error: `Error parsing or validating Gemini response: ${e.message}. See console for raw output.` };
    }
}

// --- Discord Bot Setup ---

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

client.on('ready', () => {
    console.log('-------------------------------------------');
    console.log(`🤖 Discord Bot Logged in as: ${client.user.tag}`);
    console.log('-------------------------------------------');
});

client.on('messageCreate', async (message) => {
    // Ignore messages from other bots or messages that don't start with '!'
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'loot') {
        try {
            await message.channel.send(`🌐 Analyzing map guides from ${ARCRADERS_MAP_URL}... synthesizing Hot Zone report.`);

            // 1. Fetch item data and synthesize the structured report
            const reportData = await fetchAndSynthesizeLootData();

            if (reportData.error) {
                // Error handling for when Gemini itself fails
                // Updated error message to instruct user to check console for parsing issues
                await message.channel.send(`🚨 Error: Could not generate dynamic loot report. Details: \`${reportData.error}\`\n\n*If this error persists, the model may be outputting invalid JSON. Please check the server console for the raw output.*`);
                return;
            }
            
            // Extract data (using robust fallbacks if any fields are still missing)
            // THESE VARIABLES NOW EXPECT THE FLAT STRUCTURE WE FORCED IN THE PROMPT
            const hotZoneMap = reportData.hotZoneMapName || 'Unknown Hot Zone';
            const hotZoneEvent = reportData.hotZoneEvent || 'Critical Anomaly Detected';
            const hotZoneDescription = reportData.hotZoneLootDescription || 'High value items are circulating, exact details unknown.';
            const otherMaps = reportData.otherMaps || [];
            
            // 2. Create the Discord Embed
            
            const reportColor = 0x4169E1; // Royal Blue for Intelligence Report
            
            // Corrected to be a clean URL string (Re-applying the fix from two steps ago)
            const thumbnail_url = "https://placehold.co/100x100/4169E1/fff?text=Intel"; 

            const embed = new EmbedBuilder()
                .setTitle(`🔥 Loot Intelligence Report - Cycle #${Math.floor(Math.random() * 900) + 100}`)
                .setDescription(`The primary target zone, based on current intelligence, is **${hotZoneMap}**!`)
                .setColor(reportColor)
                .setThumbnail(thumbnail_url)
                .setFooter({ 
                    text: `Report requested by ${message.author.tag} | Data synthesized by analyzing ${ARCRADERS_MAP_URL}.`
                });

            // Add the 'Hot Zone' field
            embed.addFields({
                name: `🥇 ${hotZoneMap} - TIER IV ALERT`,
                value: `**Event:** ${hotZoneEvent}\n*${hotZoneDescription}*`,
                inline: false
            });
            
            // Add fields for the remaining maps
            const tierOrder = { 'Tier I': 1, 'Tier II': 2, 'Tier III': 3 };
            otherMaps.sort((a, b) => (tierOrder[b.lootTier] || 0) - (tierOrder[a.lootTier] || 0));

            for (const otherMap of otherMaps) {
                const tier = otherMap.lootTier || 'Tier I';
                let tierIcon = '⚪';
                if (tier === 'Tier III') tierIcon = '🥉';
                else if (tier === 'Tier II') tierIcon = '🥈';

                embed.addFields({
                    name: `${tierIcon} ${otherMap.mapName || 'Unknown Map'} - ${tier}`,
                    value: `**Event:** ${otherMap.eventName || 'Routine Patrol'}`,
                    inline: true
                });
            }

            await message.channel.send({ embeds: [embed] });

        } catch (e) {
            console.error(`[${new Date().toLocaleTimeString()}] Unhandled error in !loot command handler:`, e);
            await message.channel.send(`⚠️ An unexpected error occurred while processing the loot report. Check the console for details.`);
        }
    }
});


// --- Express Server Setup (For Keep-Alive/Self-Ping) ---

const app = express();
app.use(express.json());

// 1. Simple Keep-Alive Endpoint for Render
app.get('/ping', (req, res) => {
    // This endpoint is what an external service (or Render) can hit to keep the container awake.
    res.status(200).send('Bot Service is Alive.');
});

// 2. Root route (Optional - helpful for manual testing)
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: Inter, sans-serif; text-align: center; padding: 50px; background-color: #f3f4f6; border-radius: 12px; margin: 20px;">
            <h1 style="color: #4f46e5; font-weight: 700;">Loot Bot Service Status</h1>
            <p style="color: #374151;">Discord Bot is active and connected. Now analyzing map data.</p>
            <p>Use the Keep-Alive endpoint: <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">GET /ping</code></p>
            <p style="color: #9ca3af; margin-top: 20px;">Server running on port ${PORT}</p>
        </div>
    `);
});

// --- Initialization ---

function startServices() {
    // Check if critical tokens are available
    if (!DISCORD_BOT_TOKEN) {
        console.error("\n*** CRITICAL ERROR: DISCORD_BOT_TOKEN is missing. Check your .env file or environment variables. ***");
        return;
    }
    if (!GEMINI_API_KEY) {
        console.error("\n*** WARNING: GEMINI_API_KEY is missing. Loot reports will fail. Check your .env file. ***");
    }

    // Start Express Server
    app.listen(PORT, () => {
        console.log(`\n----------------------------------------------------`);
        console.log(`🌐 Express Keep-Alive Server listening on port ${PORT}`);
        console.log(`----------------------------------------------------`);
    });

    // Start Discord Bot
    client.login(DISCORD_BOT_TOKEN)
        .catch(err => {
            console.error("\n*** DISCORD LOGIN FAILED ***");
            console.error("Please check the DISCORD_BOT_TOKEN and bot intents/permissions.");
            console.error(`Error: ${err.message}`);
        });
}

startServices();