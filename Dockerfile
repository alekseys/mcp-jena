FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code and build configuration
COPY tsconfig.json ./
COPY src ./src

# Build the application
RUN npm run build

FROM node:20-alpine AS release

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --ignore-scripts --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Environment variables
ENV JENA_FUSEKI_URL=http://fuseki:3030
ENV DEFAULT_DATASET=ds

# Serve over Streamable HTTP so remote MCP clients (e.g. Microsoft Foundry IQ)
# can reach the server over the network.
ENV MCP_TRANSPORT=http
ENV PORT=8080

# Expose the Streamable HTTP port (MCP endpoint is served at POST /mcp)
EXPOSE 8080

# Set entrypoint
ENTRYPOINT ["node", "dist/index.js"]

# To run over stdio instead, override the transport:
# CMD ["--stdio", "--endpoint", "http://fuseki:3030", "--dataset", "ds"] 