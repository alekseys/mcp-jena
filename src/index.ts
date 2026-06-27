#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "module";
import JenaClient from "./utils/jena-client.js";

// Load package metadata so the server version stays in sync with package.json.
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string; description: string };

// Parse command line arguments
const args = process.argv.slice(2);
let jenaEndpoint = process.env.JENA_FUSEKI_URL || "http://localhost:3030";
let defaultDataset = process.env.DEFAULT_DATASET || "ds";
let jenaUsername = process.env.JENA_USERNAME || "";
let jenaPassword = process.env.JENA_PASSWORD || "";
// Optional explicit endpoint paths for an embedded Jena app (non-Fuseki layout).
let queryPath = process.env.JENA_QUERY_PATH || "";
let updatePath = process.env.JENA_UPDATE_PATH || "";
// Wire protocol: 'fuseki' (default) or 'json' (embedded app JSON envelope).
let protocol = process.env.JENA_PROTOCOL || "fuseki";

// Process CLI arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--endpoint" || args[i] === "-e") {
    if (i + 1 < args.length) {
      jenaEndpoint = args[i + 1];
      i++; // Skip the next arg since we used it
    }
  } else if (args[i] === "--dataset" || args[i] === "-d") {
    if (i + 1 < args.length) {
      defaultDataset = args[i + 1];
      i++; // Skip the next arg since we used it
    }
  } else if (args[i] === "--username" || args[i] === "-u") {
    if (i + 1 < args.length) {
      jenaUsername = args[i + 1];
      i++; // Skip the next arg since we used it
    }
  } else if (args[i] === "--password" || args[i] === "-p") {
    if (i + 1 < args.length) {
      jenaPassword = args[i + 1];
      i++; // Skip the next arg since we used it
    }
  } else if (args[i] === "--query-path") {
    if (i + 1 < args.length) {
      queryPath = args[i + 1];
      i++; // Skip the next arg since we used it
    }
  } else if (args[i] === "--update-path") {
    if (i + 1 < args.length) {
      updatePath = args[i + 1];
      i++; // Skip the next arg since we used it
    }
  } else if (args[i] === "--protocol") {
    if (i + 1 < args.length) {
      protocol = args[i + 1];
      i++; // Skip the next arg since we used it
    }
  } else if (args[i] === "--json") {
    protocol = "json";
  }
}

console.log(`Connecting to Jena endpoint: ${jenaEndpoint}`);
console.log(`Using protocol: ${protocol}`);
if (queryPath || updatePath) {
  console.log(`Using query path: ${queryPath || `${defaultDataset}/query`}`);
  console.log(`Using update path: ${updatePath || `${defaultDataset}/update`}`);
} else {
  console.log(`Using default dataset: ${defaultDataset}`);
}
if (jenaUsername) {
  console.log(`Using authentication for user: ${jenaUsername}`);
}

// Define the tool schemas upfront
const toolSchemas = [
  {
    name: "execute_sparql_query",
    description: `Execute a SPARQL query against an Apache Jena dataset.

SPARQL (SPARQL Protocol and RDF Query Language) is a query language for RDF data.

Key SPARQL Query Forms:
- SELECT: Returns variable bindings as a table
- CONSTRUCT: Returns RDF triples  
- ASK: Returns true/false
- DESCRIBE: Returns RDF description of resources

Basic SPARQL Syntax:
- PREFIX declarations: PREFIX ex: <http://example.org/>
- WHERE clause with triple patterns: ?subject ?predicate ?object
- Optional patterns: OPTIONAL { ?s ?p ?o }
- Filters: FILTER(?var > 10)
- Graph patterns: GRAPH <uri> { ?s ?p ?o }
- Property paths: ?s ex:knows/ex:friend ?o (sequence), ?s ex:knows* ?o (zero or more)

Common Query Templates:
1. Basic exploration: SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10
2. Count triples: SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }
3. List types: SELECT DISTINCT ?type WHERE { ?s a ?type }
4. Property path (friends of friends): SELECT ?person ?friend WHERE { ?person foaf:knows/foaf:knows ?friend }
5. Optional properties: SELECT ?s ?name WHERE { ?s a ex:Person . OPTIONAL { ?s foaf:name ?name } }
6. Named graph query: SELECT ?s ?p ?o FROM NAMED <graph> WHERE { GRAPH <graph> { ?s ?p ?o } }
7. Filter by value: SELECT ?s WHERE { ?s ex:age ?age . FILTER(?age > 18) }

Property Path Operators:
- / (sequence): ?s foaf:knows/foaf:name ?name
- | (alternative): ?s (foaf:name|rdfs:label) ?name  
- * (zero or more): ?s foaf:knows* ?connected
- + (one or more): ?s ex:partOf+ ?container
- ? (zero or one): ?s foaf:knows? ?maybeKnown
- ^ (inverse): ?s ^ex:hasChild ?parent (equivalent to ?parent ex:hasChild ?s)
- ! (negation): ?s !(rdf:type) ?notType`,
    inputSchema: {
      type: "object",
      properties: {
        query: { 
          type: "string",
          description: "The SPARQL query to execute. Must be valid SPARQL syntax (SELECT, CONSTRUCT, ASK, or DESCRIBE). Use property paths for complex graph navigation.",
        },
        dataset: { 
          type: "string",
          description: "Dataset name. If not provided, uses the default dataset.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "execute_sparql_update",
    description: `Execute a SPARQL update query against an Apache Jena dataset.

SPARQL Update Operations:
- INSERT DATA: Add triples to the dataset
- DELETE DATA: Remove specific triples  
- INSERT/DELETE WHERE: Conditional insert/delete based on patterns
- LOAD/CLEAR: Load/clear entire graphs
- CREATE/DROP: Manage graph lifecycle

Basic Update Syntax:
- INSERT DATA { <subject> <predicate> <object> }
- DELETE DATA { <subject> <predicate> <object> }
- INSERT { ?s <new:prop> "value" } WHERE { ?s <old:prop> ?o }
- DELETE { ?s <old:prop> ?o } WHERE { ?s <old:prop> ?o }
- CLEAR GRAPH <graph-uri>

Example Updates:
1. Insert data: INSERT DATA { <ex:person1> foaf:name "John" ; ex:age 25 }
2. Delete data: DELETE DATA { <ex:person1> ex:age 25 }
3. Conditional update: DELETE { ?p ex:status "pending" } INSERT { ?p ex:status "active" } WHERE { ?p ex:status "pending" }
4. Insert with graph: INSERT DATA { GRAPH <ex:metadata> { <ex:dataset1> dcterms:created "2024-01-01"^^xsd:date } }
5. Clear graph: CLEAR GRAPH <ex:temporary>`,
    inputSchema: {
      type: "object",
      properties: {
        update: { 
          type: "string",
          description: "The SPARQL update query to execute. Must be valid SPARQL update syntax (INSERT, DELETE, LOAD, CLEAR, CREATE, DROP).",
        },
        dataset: { 
          type: "string",
          description: "Dataset name. If not provided, uses the default dataset.",
        },
      },
      required: ["update"],
    },
  },
  {
    name: "list_graphs",
    description: `List all available named graphs in an Apache Jena dataset.

Named graphs in RDF provide context and provenance for triples. Each graph is identified by a URI.
This tool helps discover what data contexts are available in your dataset.

Common Graph Patterns:
- Default graph (unnamed): Contains triples not in any specific graph
- Named graphs: <http://example.org/graph1>, <http://data.gov/dataset1>  
- Metadata graphs: Often contain information about other graphs
- Versioned graphs: <http://data.org/v1>, <http://data.org/v2>

Use Case Examples:
- Data provenance: Track where data came from
- Temporal data: Different time periods in separate graphs
- Access control: Different permissions per graph
- Data quality: Separate validated vs raw data`,
    inputSchema: {
      type: "object",
      properties: {
        dataset: { 
          type: "string",
          description: "Dataset name. If not provided, uses the default dataset.",
        },
      },
    },
  },
  {
    name: "sparql_query_templates",
    description: `Get SPARQL query templates for common knowledge graph exploration patterns.

This tool provides pre-built SPARQL query templates covering:
- Basic data exploration and statistics
- Property path navigation for complex relationships
- Knowledge graph analysis patterns
- Data validation and quality checks
- Schema discovery and documentation

Templates include explanations and can be customized with your specific URIs and requirements.`,
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["exploration", "property-paths", "statistics", "validation", "schema", "all"],
          description: "Category of templates to retrieve. 'all' returns all available templates.",
        },
      },
      required: ["category"],
    },
  },
];

// Create server with proper metadata and capabilities
const server = new Server(
  {
    name: pkg.name,
    version: pkg.version,
    description: "MCP server for Apache Jena SPARQL queries",
    vendor: "ramuzes",
    schemas: {
      tools: toolSchemas,
    }
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolSchemas,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "execute_sparql_query") {
    const query = request.params.arguments?.query as string;
    const dataset = request.params.arguments?.dataset as string | undefined || defaultDataset;
    
    try {
      const client = new JenaClient(jenaEndpoint, dataset, jenaUsername, jenaPassword, queryPath, updatePath, protocol as any);
      const result = await client.executeQuery(query);
      
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: errorMessage }],
        isError: true,
      };
    }
  } 
  else if (request.params.name === "execute_sparql_update") {
    const update = request.params.arguments?.update as string;
    const dataset = request.params.arguments?.dataset as string | undefined || defaultDataset;
    
    try {
      const client = new JenaClient(jenaEndpoint, dataset, jenaUsername, jenaPassword, queryPath, updatePath, protocol as any);
      const result = await client.executeUpdate(update);
      
      return {
        content: [{ type: "text", text: result }],
        isError: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: errorMessage }],
        isError: true,
      };
    }
  }
  else if (request.params.name === "list_graphs") {
    const dataset = request.params.arguments?.dataset as string | undefined || defaultDataset;
    
    try {
      const client = new JenaClient(jenaEndpoint, dataset, jenaUsername, jenaPassword, queryPath, updatePath, protocol as any);
      const graphs = await client.listGraphs();
      
      return {
        content: [{ type: "text", text: JSON.stringify(graphs, null, 2) }],
        isError: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: errorMessage }],
        isError: true,
      };
    }
  }
  else if (request.params.name === "sparql_query_templates") {
    const category = request.params.arguments?.category as string || "all";
    
    try {
      const { SparqlTemplates } = await import("./utils/sparql-templates.js");
      const templates = SparqlTemplates.getTemplates(category);
      
      return {
        content: [{ type: "text", text: JSON.stringify(templates, null, 2) }],
        isError: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: errorMessage }],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error); 