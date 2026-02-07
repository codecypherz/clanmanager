# --- Stage 1: Build Angular ---
FROM node:20 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
# This populates ../backend/dist/public
RUN npm run build

# --- Stage 2: Build Node Backend ---
FROM node:20 AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npm run build
# Ensure the frontend files are moved into the backend's dist
COPY --from=frontend-builder /app/backend/dist/public ./dist/public

# --- Stage 3: Final Production Image ---
FROM node:20-slim
WORKDIR /app
# Only copy the final compiled dist and production dependencies
COPY --from=backend-builder /app/backend/dist ./dist
COPY backend/package*.json ./
RUN npm install --omit=dev

EXPOSE 8080
CMD ["node", "dist/server.js"]
