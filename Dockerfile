# Build stage
FROM node:20-alpine as build
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Add a stage to build the express server
FROM build as server-build
WORKDIR /app
COPY tsconfig.server.json ./
RUN npx tsc -p tsconfig.server.json

# Production stage Node.js server
FROM node:20-alpine
WORKDIR /app

# Only need production node_modules
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend
COPY --from=build /app/dist ./dist
# Copy built server
COPY --from=server-build /app/dist-server ./server

EXPOSE 8080

CMD ["node", "server/index.js"]
