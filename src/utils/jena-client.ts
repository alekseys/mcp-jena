import axios from 'axios';
import dotenv from 'dotenv';
import { SparqlHelper } from './sparql-helper.js';

dotenv.config();

const FUSEKI_URL = process.env.JENA_FUSEKI_URL || 'http://localhost:3030';
const DEFAULT_DATASET = process.env.DEFAULT_DATASET || 'ds';
const JENA_USERNAME = process.env.JENA_USERNAME || '';
const JENA_PASSWORD = process.env.JENA_PASSWORD || '';
// Optional explicit endpoint paths (e.g. for an embedded Jena app instead of Fuseki).
// When set, these override the default Fuseki-style `${dataset}/query` and `${dataset}/update` layout.
const QUERY_PATH = process.env.JENA_QUERY_PATH || '';
const UPDATE_PATH = process.env.JENA_UPDATE_PATH || '';
// Wire protocol: 'fuseki' (standard SPARQL protocol) or 'json' (embedded app that
// accepts {"sparql": "..."} JSON bodies and wraps results under a `results` field).
const PROTOCOL = (process.env.JENA_PROTOCOL || 'fuseki') as JenaProtocol;

export type JenaProtocol = 'fuseki' | 'json';

/**
 * Represents the result of a SPARQL query
 */
export interface SparqlResult {
  head: {
    vars: string[];
  };
  results: {
    bindings: Array<{
      [key: string]: {
        type: string;
        value: string;
        datatype?: string;
        "xml:lang"?: string;
      };
    }>;
  };
}

/**
 * Client for interacting with Apache Jena Fuseki SPARQL endpoint
 */
export class JenaClient {
  private baseUrl: string;
  private dataset: string;
  private username: string;
  private password: string;
  private queryUrl: string;
  private updateUrl: string;
  private protocol: JenaProtocol;

  /**
   * Creates a new Jena client
   * @param baseUrl - Jena server URL. Defaults to environment variable or 'http://localhost:3030'
   * @param dataset - Dataset name (Fuseki layout only). Defaults to environment variable or 'ds'
   * @param username - Username for HTTP Basic authentication. Defaults to environment variable
   * @param password - Password for HTTP Basic authentication. Defaults to environment variable
   * @param queryPath - Explicit SPARQL query path. When set, overrides the Fuseki `${dataset}/query` layout
   * @param updatePath - Explicit SPARQL update path. When set, overrides the Fuseki `${dataset}/update` layout
   * @param protocol - Wire protocol: 'fuseki' (standard) or 'json' (embedded app JSON envelope)
   */
  constructor(
    baseUrl = FUSEKI_URL, 
    dataset = DEFAULT_DATASET, 
    username = JENA_USERNAME, 
    password = JENA_PASSWORD,
    queryPath = QUERY_PATH,
    updatePath = UPDATE_PATH,
    protocol: JenaProtocol = PROTOCOL
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.dataset = dataset;
    this.username = username;
    this.password = password;
    this.protocol = protocol;
    // Use explicit paths when provided (embedded Jena app); otherwise default to Fuseki layout.
    this.queryUrl = queryPath
      ? `${this.baseUrl}/${queryPath.replace(/^\/+/, '')}`
      : `${this.baseUrl}/${this.dataset}/query`;
    this.updateUrl = updatePath
      ? `${this.baseUrl}/${updatePath.replace(/^\/+/, '')}`
      : `${this.baseUrl}/${this.dataset}/update`;
  }

  /**
   * Executes a SPARQL query against the Jena dataset
   * @param sparqlQuery - The SPARQL query to execute
   * @returns Query results
   */
  async executeQuery(sparqlQuery: string): Promise<SparqlResult> {
    try {
      // Validate query before execution
      const validation = SparqlHelper.validateQuery(sparqlQuery);
      if (!validation.valid) {
        const errorMsg = `Invalid SPARQL query:\n${validation.errors.join('\n')}`;
        const suggestions = validation.suggestions.length > 0 
          ? `\n\nSuggestions:\n${validation.suggestions.join('\n')}` 
          : '';
        throw new Error(errorMsg + suggestions);
      }

      // Add performance suggestions as warnings (but don't block execution)
      const improvements = SparqlHelper.suggestImprovements(sparqlQuery);
      if (improvements.length > 0) {
        console.warn('💡 Query suggestions:', improvements.join(', '));
      }

      // Embedded Jena app: POST {"sparql": ...} as JSON, results wrapped in an envelope.
      if (this.protocol === 'json') {
        const config: any = {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        };
        if (this.username && this.password) {
          config.auth = { username: this.username, password: this.password };
        }

        const response = await axios.post(this.queryUrl, { sparql: sparqlQuery }, config);
        const data = response.data;
        if (data && data.error) {
          throw new Error(
            SparqlHelper.enhanceErrorMessage(`SPARQL query failed: ${data.error}`, sparqlQuery)
          );
        }
        return data.results as SparqlResult;
      }

      const config: any = {
        params: {
          query: sparqlQuery,
        },
        headers: {
          Accept: 'application/sparql-results+json',
        },
      };

      // Add authentication if credentials are provided
      if (this.username && this.password) {
        config.auth = {
          username: this.username,
          password: this.password
        };
      }

      const response = await axios.get(this.queryUrl, config);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const enhancedError = SparqlHelper.enhanceErrorMessage(
          `SPARQL query failed: ${error.message}. ${error.response?.data?.message || ''}`,
          sparqlQuery
        );
        throw new Error(enhancedError);
      }
      throw error;
    }
  }

  /**
   * Executes a SPARQL update query against the Jena dataset
   * @param sparqlUpdate - The SPARQL update query to execute
   * @returns Success message
   */
  async executeUpdate(sparqlUpdate: string): Promise<string> {
    try {
      // Basic validation for update queries
      const validation = SparqlHelper.validateQuery(sparqlUpdate);
      if (!validation.valid) {
        const errorMsg = `Invalid SPARQL update:\n${validation.errors.join('\n')}`;
        const suggestions = validation.suggestions.length > 0 
          ? `\n\nSuggestions:\n${validation.suggestions.join('\n')}` 
          : '';
        throw new Error(errorMsg + suggestions);
      }

      // Embedded Jena app: POST {"sparql": ...} as JSON.
      if (this.protocol === 'json') {
        const config: any = {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        };
        if (this.username && this.password) {
          config.auth = { username: this.username, password: this.password };
        }

        const response = await axios.post(this.updateUrl, { sparql: sparqlUpdate }, config);
        const data = response.data;
        if (data && data.error) {
          throw new Error(
            SparqlHelper.enhanceErrorMessage(`SPARQL update failed: ${data.error}`, sparqlUpdate)
          );
        }
        return 'Update successful';
      }

      const config: any = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };

      // Add authentication if credentials are provided
      if (this.username && this.password) {
        config.auth = {
          username: this.username,
          password: this.password
        };
      }

      await axios.post(
        this.updateUrl,
        new URLSearchParams({ update: sparqlUpdate }),
        config
      );

      return 'Update successful';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const enhancedError = SparqlHelper.enhanceErrorMessage(
          `SPARQL update failed: ${error.message}. ${error.response?.data?.message || ''}`,
          sparqlUpdate
        );
        throw new Error(enhancedError);
      }
      throw error;
    }
  }

  /**
   * Lists all available graphs in the dataset
   * @returns Array of graph URIs
   */
  async listGraphs(): Promise<string[]> {
    const query = `
      SELECT DISTINCT ?g
      WHERE {
        GRAPH ?g { ?s ?p ?o }
      }
    `;

    const result = await this.executeQuery(query);
    return result.results.bindings.map(binding => binding.g.value);
  }
}

export default JenaClient; 