# MCP Server for Apache Jena

A Model Context Protocol (MCP) server that connects AI agents to Apache Jena for SPARQL query capabilities.

## Overview

This project implements an MCP server that allows AI agents (such as Cursor, Claude for Cline, or Claude Desktop) to access and query RDF data stored in Apache Jena. The server provides tools for executing SPARQL queries and updates against a Jena Fuseki server.

## Features

- Execute SPARQL queries against a Jena Fuseki server
- Execute SPARQL updates to modify RDF data
- List available named graphs in the dataset
- HTTP Basic authentication support for Jena Fuseki
- Compatible with the Model Context Protocol
- Two MCP transports:
  - **stdio** (default) for local clients such as Cursor, Cline, or Claude Desktop
  - **Streamable HTTP** for remote clients that reach the server over the network (e.g. Microsoft Foundry IQ)

## Prerequisites

- Node.js (v16 or later)
- Apache Jena Fuseki server running with your RDF data loaded
- An AI agent that supports the Model Context Protocol (e.g., Cursor, Claude for Cline)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/ramuzes/mcp-jena.git
   cd mcp-jena
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the TypeScript code:
   ```
   npm run build
   ```

## Usage

Run the server with default settings (localhost:3030 for Jena, 'ds' for dataset):

```
npm start
```

Or specify custom Jena endpoint, dataset, and authentication credentials:

```
npm start -- --endpoint http://your-jena-server:3030 --dataset your_dataset --username your_username --password your_password
```

You can also use short flags:

```
npm start -- -e http://your-jena-server:3030 -d your_dataset -u your_username -p your_password
```

For development mode with automatic transpilation:

```
npm run dev:transpile -- -e http://your-jena-server:3030 -d your_dataset -u your_username -p your_password
```

## Transports

The server can run over either **stdio** (default) or **Streamable HTTP**.

### stdio (local clients)

Used by desktop MCP clients (Cursor, Cline, Claude Desktop). This is the default,
so `npm start` runs in stdio mode.

### Streamable HTTP (remote clients, e.g. Microsoft Foundry IQ)

Microsoft Foundry IQ consumes remote MCP servers over HTTP, so the server must be
reachable on the network. Start it in HTTP mode:

```
npm run build
npm run start:http
```

or equivalently:

```
MCP_TRANSPORT=http PORT=8080 API_KEY=your-secret node dist/index.js
# or
node dist/index.js --http --port 8080
```

The MCP endpoint is served at `POST /mcp` (with `GET`/`DELETE /mcp` for the
Steamable HTTP session lifecycle). A liveness probe is available at `GET /health`.

When `API_KEY` is set, HTTP clients must authenticate by sending either:

- `Authorization: Bearer <API_KEY>`, or
- `x-api-key: <API_KEY>`

Point Foundry IQ at `https://<your-host>/mcp` and configure the API key as the
bearer token. If `API_KEY` is not set, the HTTP endpoint is unauthenticated
(only do this behind a trusted network / gateway).

You can run the MCP Jena server using Docker:

### Building the Docker image

```bash
docker build -t mcp-jena .
```

### Running with Docker

```bash
docker run -e JENA_FUSEKI_URL=http://your-jena-server:3030 -e DEFAULT_DATASET=your_dataset mcp-jena
```

The Docker image defaults to the **Streamable HTTP** transport on port `8080`
(suitable for remote clients such as Foundry IQ). Publish the port and set an
API key:

```bash
docker run -p 8080:8080 \
  -e JENA_FUSEKI_URL=http://your-jena-server:3030 \
  -e DEFAULT_DATASET=your_dataset \
  -e API_KEY=your-secret \
  mcp-jena
```

To run over stdio inside the container instead, override the transport with
`-e MCP_TRANSPORT=stdio` (or pass `--stdio` as a command argument).

## Available Tools

This MCP server provides the following tools:

1. **`execute_sparql_query`** - Execute a SPARQL query against the Jena dataset
   - Includes comprehensive SPARQL syntax documentation
   - Property path operators (/, *, +, ?, ^, |) with examples
   - Common query patterns and templates
   - Automatic query validation and suggestions

2. **`execute_sparql_update`** - Execute a SPARQL update query to modify the dataset  
   - Insert/Delete operations documentation
   - Conditional updates with WHERE clauses
   - Graph management operations

3. **`list_graphs`** - List all available named graphs in the dataset
   - Graph usage patterns and best practices
   - Provenance and versioning examples

4. **`sparql_query_templates`** - Get pre-built SPARQL query templates
   - **exploration**: Basic data discovery and statistics
   - **property-paths**: Complex graph navigation patterns  
   - **statistics**: Knowledge graph metrics and analysis
   - **validation**: Data quality and consistency checks
   - **schema**: Structure discovery and documentation


## Environment Variables

You can also configure the server using environment variables:

- `JENA_FUSEKI_URL`: URL of your Jena Fuseki server (default: http://localhost:3030)
- `DEFAULT_DATASET`: Default dataset name (default: ds)
- `JENA_USERNAME`: Username for HTTP Basic authentication to Jena Fuseki
- `JENA_PASSWORD`: Password for HTTP Basic authentication to Jena Fuseki
- `MCP_TRANSPORT`: MCP transport to use, `stdio` (default) or `http`
- `PORT`: Port for the HTTP transport (default: 8080)
- `API_KEY`: Optional shared secret for HTTP transport authentication (Bearer token or `x-api-key`)

## Example SPARQL Queries

### Basic SELECT query:

```sparql
SELECT ?subject ?predicate ?object
WHERE {
  ?subject ?predicate ?object
}
LIMIT 10
```

### Insert data with UPDATE:

```sparql
PREFIX ex: <http://example.org/>
INSERT DATA {
  ex:subject1 ex:predicate1 "object1" .
  ex:subject2 ex:predicate2 42 .
}
```

### Query a specific named graph:

```sparql
SELECT ?subject ?predicate ?object
FROM NAMED <http://example.org/graph1>
WHERE {
  GRAPH <http://example.org/graph1> {
    ?subject ?predicate ?object
  }
}
LIMIT 10
```

## Resources

- [Apache Jena](https://jena.apache.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [SPARQL Query Language](https://www.w3.org/TR/sparql11-query/) 