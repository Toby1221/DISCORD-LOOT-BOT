# Use a slim Node.js base image
FROM node:20-slim

# Create and set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your bot code
COPY . .

# Cloud Run injects the PORT environment variable
ENV PORT=8080

# The command to run your bot
CMD ["npm", "start"] 
# Ensure your package.json has a "start" script: "node index.js"
