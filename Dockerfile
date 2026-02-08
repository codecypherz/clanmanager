# ----------------------------------
# --- Stage 1: Build Environment ---
# ----------------------------------
FROM node:20 AS builder
WORKDIR /app

# 1. Copy the "Blueprint" of your monorepo
# We copy all package.json files first to leverage Docker layer caching
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# 2. Install dependencies for the WHOLE workspace
# This creates the @clan-manager/shared symlinks in node_modules
RUN npm install

# 3. Copy the source code
COPY shared/ ./shared/
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# 4. Build Shared logic (if it has a build step, otherwise skip)
# 5. Build Frontend
# This populates ../backend/dist/public
RUN cd frontend && npm run build

# 6. Build Backend
RUN cd backend && npm run build

# ---------------------------------------
# --- Stage 2: Final Production Image ---
# ---------------------------------------
FROM node:20-slim
WORKDIR /app

# A. Copy the workspace root files
COPY package*.json ./

# B. Copy the Shared folder (needed for the local dependency)
# We copy the source because the backend TSC output usually points back to these
COPY --from=builder /app/shared ./shared

# C. Copy the Backend compiled dist and package.json
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist

# D. Install production dependencies for the backend workspace
# The --workspace flag tells npm to only install for the backend
# but it will find the @clan-manager/shared link in the root
RUN npm install --omit=dev --workspace=backend

EXPOSE 8080
# This is a direct consequence of how "rootDir" is set in backend/tsconfig.json
CMD ["node", "backend/dist/backend/src/server.js"]
