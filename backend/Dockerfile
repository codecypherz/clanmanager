FROM node:20-slim
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and config
COPY . .

# Compile TS to JS
RUN npm run build

EXPOSE 8080

# Run the compiled code
CMD ["node", "dist/server.js"]
