export interface QueryTemplate {
  name: string;
  description: string;
  query: string;
  variables?: string[];
  explanation?: string;
}

export interface TemplateCategory {
  category: string;
  description: string;
  templates: QueryTemplate[];
}

export class SparqlTemplates {
  private static explorationTemplates: QueryTemplate[] = [
    {
      name: "basic_exploration",
      description: "Basic exploration of all triples in the dataset",
      query: "SELECT ?subject ?predicate ?object WHERE { ?subject ?predicate ?object } LIMIT 10",
      variables: ["subject", "predicate", "object"],
      explanation: "Returns the first 10 triples to get a sense of the data structure"
    },
    {
      name: "count_all_triples",
      description: "Count total number of triples in the dataset",
      query: "SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }",
      variables: ["count"],
      explanation: "Provides total triple count for dataset size estimation"
    },
    {
      name: "list_all_types",
      description: "List all rdf:type values (classes) in the dataset",
      query: "SELECT DISTINCT ?type (COUNT(?instance) as ?count) WHERE { ?instance a ?type } GROUP BY ?type ORDER BY DESC(?count)",
      variables: ["type", "count"],
      explanation: "Shows what types of entities exist and their frequency"
    },
    {
      name: "list_all_properties",
      description: "List all properties used in the dataset",
      query: "SELECT DISTINCT ?property (COUNT(?usage) as ?count) WHERE { ?s ?property ?o } GROUP BY ?property ORDER BY DESC(?count)",
      variables: ["property", "count"],
      explanation: "Shows what properties are used and how frequently"
    },
    {
      name: "sample_entities_by_type",
      description: "Sample entities for each type",
      query: `SELECT ?type ?entity ?label WHERE {
  ?entity a ?type .
  OPTIONAL { ?entity rdfs:label ?label }
} GROUP BY ?type HAVING (COUNT(?entity) >= 1) LIMIT 50`,
      variables: ["type", "entity", "label"],
      explanation: "Gets sample entities for each type to understand the data"
    }
  ];

  private static propertyPathTemplates: QueryTemplate[] = [
    {
      name: "friends_of_friends",
      description: "Find friends of friends using property paths",
      query: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?person ?friend_of_friend WHERE {
  ?person foaf:knows/foaf:knows ?friend_of_friend .
  FILTER(?person != ?friend_of_friend)
}`,
      variables: ["person", "friend_of_friend"],
      explanation: "Uses sequence path (/) to find connections two steps away"
    },
    {
      name: "all_connected_people",
      description: "Find all people connected through knows relationships",
      query: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?person ?connected WHERE {
  ?person foaf:knows* ?connected .
  FILTER(?person != ?connected)
}`,
      variables: ["person", "connected"],
      explanation: "Uses zero-or-more path (*) to find all transitive connections"
    },
    {
      name: "organizational_hierarchy",
      description: "Navigate organizational hierarchy using property paths",
      query: `PREFIX org: <http://example.org/org/>
SELECT ?employee ?manager ?level WHERE {
  ?employee org:reportsTo+ ?manager .
  ?employee org:reportsTo{1,3} ?manager .
  BIND(1 as ?level)
}`,
      variables: ["employee", "manager", "level"],
      explanation: "Uses one-or-more path (+) and path length restrictions {1,3}"
    },
    {
      name: "alternative_names",
      description: "Find entities with alternative name properties",
      query: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?entity ?name WHERE {
  ?entity (foaf:name|rdfs:label|foaf:nick) ?name
}`,
      variables: ["entity", "name"],
      explanation: "Uses alternative path (|) to find any of several name properties"
    },
    {
      name: "inverse_relationships",
      description: "Find parent-child relationships using inverse paths",
      query: `PREFIX ex: <http://example.org/>
SELECT ?parent ?child WHERE {
  ?child ^ex:hasParent ?parent
}`,
      variables: ["parent", "child"],
      explanation: "Uses inverse path (^) where ?parent ex:hasParent ?child"
    },
    {
      name: "complex_path_navigation",
      description: "Complex path combining multiple operators",
      query: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX ex: <http://example.org/>
SELECT ?person ?related WHERE {
  ?person (foaf:knows/ex:worksFor|ex:familyOf)+ ?related
}`,
      variables: ["person", "related"],
      explanation: "Combines sequence, alternative, and one-or-more paths"
    }
  ];

  private static statisticsTemplates: QueryTemplate[] = [
    {
      name: "graph_statistics",
      description: "Basic statistics about each named graph",
      query: `SELECT ?graph (COUNT(*) as ?triples) WHERE {
  GRAPH ?graph { ?s ?p ?o }
} GROUP BY ?graph ORDER BY DESC(?triples)`,
      variables: ["graph", "triples"],
      explanation: "Shows triple count per named graph"
    },
    {
      name: "property_usage_stats",
      description: "Statistics about property usage patterns",
      query: `SELECT ?property 
  (COUNT(DISTINCT ?subject) as ?unique_subjects)
  (COUNT(DISTINCT ?object) as ?unique_objects)
  (COUNT(*) as ?total_usage)
WHERE {
  ?subject ?property ?object
} GROUP BY ?property ORDER BY DESC(?total_usage)`,
      variables: ["property", "unique_subjects", "unique_objects", "total_usage"],
      explanation: "Detailed usage statistics for each property"
    },
    {
      name: "degree_distribution",
      description: "Node degree distribution analysis",
      query: `SELECT ?degree (COUNT(?node) as ?node_count) WHERE {
  {
    SELECT ?node (COUNT(?connected) as ?degree) WHERE {
      { ?node ?p ?connected } UNION { ?connected ?p ?node }
    } GROUP BY ?node
  }
} GROUP BY ?degree ORDER BY ?degree`,
      variables: ["degree", "node_count"],
      explanation: "Shows how many nodes have each degree (in+out connections)"
    },
    {
      name: "literal_type_distribution",
      description: "Distribution of literal datatypes",
      query: `SELECT ?datatype (COUNT(?literal) as ?count) WHERE {
  ?s ?p ?literal .
  FILTER(isLiteral(?literal))
  BIND(DATATYPE(?literal) as ?datatype)
} GROUP BY ?datatype ORDER BY DESC(?count)`,
      variables: ["datatype", "count"],
      explanation: "Shows what datatypes are used for literal values"
    }
  ];

  private static validationTemplates: QueryTemplate[] = [
    {
      name: "missing_labels",
      description: "Find entities without human-readable labels",
      query: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?entity WHERE {
  ?entity a ?type .
  FILTER NOT EXISTS { ?entity rdfs:label ?label }
  FILTER NOT EXISTS { ?entity foaf:name ?name }
  FILTER(isURI(?entity))
} LIMIT 20`,
      variables: ["entity"],
      explanation: "Identifies entities that lack human-readable names"
    },
    {
      name: "orphaned_nodes",
      description: "Find nodes with no incoming or outgoing connections",
      query: `SELECT ?node WHERE {
  ?node a ?type .
  FILTER NOT EXISTS { ?node ?p ?o }
  FILTER NOT EXISTS { ?s ?p ?node }
}`,
      variables: ["node"],
      explanation: "Finds isolated nodes that aren't connected to anything"
    },
    {
      name: "invalid_urls",
      description: "Find potentially invalid URL patterns",
      query: `SELECT ?subject ?property ?invalid_uri WHERE {
  ?subject ?property ?invalid_uri .
  FILTER(isURI(?invalid_uri) && REGEX(STR(?invalid_uri), "^http://[^/]*/$"))
} LIMIT 10`,
      variables: ["subject", "property", "invalid_uri"],
      explanation: "Identifies URIs that might be malformed or incomplete"
    },
    {
      name: "duplicate_labels",
      description: "Find entities with identical labels",
      query: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?label (COUNT(?entity) as ?count) WHERE {
  ?entity rdfs:label ?label
} GROUP BY ?label HAVING(?count > 1) ORDER BY DESC(?count)`,
      variables: ["label", "count"],
      explanation: "Identifies potential duplicate entities with same labels"
    }
  ];

  private static schemaTemplates: QueryTemplate[] = [
    {
      name: "class_hierarchy",
      description: "Discover class hierarchy using rdfs:subClassOf",
      query: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?subclass ?superclass WHERE {
  ?subclass rdfs:subClassOf+ ?superclass
} ORDER BY ?superclass ?subclass`,
      variables: ["subclass", "superclass"],
      explanation: "Shows the complete class hierarchy in the dataset"
    },
    {
      name: "property_domains_ranges",
      description: "Find domains and ranges of properties",
      query: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?property ?domain ?range WHERE {
  OPTIONAL { ?property rdfs:domain ?domain }
  OPTIONAL { ?property rdfs:range ?range }
  FILTER EXISTS { ?s ?property ?o }
} ORDER BY ?property`,
      variables: ["property", "domain", "range"],
      explanation: "Documents the expected types for property subjects and objects"
    },
    {
      name: "inferred_property_types",
      description: "Infer property domains and ranges from usage",
      query: `SELECT ?property 
  (GROUP_CONCAT(DISTINCT ?subject_type; separator=", ") as ?inferred_domains)
  (GROUP_CONCAT(DISTINCT ?object_type; separator=", ") as ?inferred_ranges)
WHERE {
  ?subject ?property ?object .
  OPTIONAL { ?subject a ?subject_type }
  OPTIONAL { ?object a ?object_type }
  FILTER(BOUND(?subject_type) || BOUND(?object_type))
} GROUP BY ?property`,
      variables: ["property", "inferred_domains", "inferred_ranges"],
      explanation: "Discovers actual usage patterns for properties"
    },
    {
      name: "namespace_analysis",
      description: "Analyze namespace usage in the dataset",
      query: `SELECT 
  (REPLACE(STR(?uri), "^(https?://[^/]+(?:/[^#]*)?)[#/].*$", "$1") as ?namespace)
  (COUNT(?uri) as ?usage_count)
WHERE {
  { SELECT DISTINCT ?uri WHERE { { ?uri ?p ?o } UNION { ?s ?uri ?o } UNION { ?s ?p ?uri } FILTER(isURI(?uri)) } }
} GROUP BY ?namespace ORDER BY DESC(?usage_count)`,
      variables: ["namespace", "usage_count"],
      explanation: "Shows which vocabularies/namespaces are used most"
    }
  ];

  static getTemplates(category: string): TemplateCategory[] {
    const allCategories: TemplateCategory[] = [
      {
        category: "exploration",
        description: "Basic data exploration and discovery queries",
        templates: this.explorationTemplates
      },
      {
        category: "property-paths", 
        description: "Advanced graph navigation using SPARQL property paths",
        templates: this.propertyPathTemplates
      },
      {
        category: "statistics",
        description: "Statistical analysis and metrics about the knowledge graph",
        templates: this.statisticsTemplates
      },
      {
        category: "validation",
        description: "Data quality and validation queries",
        templates: this.validationTemplates
      },
      {
        category: "schema",
        description: "Schema discovery and documentation queries", 
        templates: this.schemaTemplates
      }
    ];

    if (category === "all") {
      return allCategories;
    }

    return allCategories.filter(cat => cat.category === category);
  }

  static getCommonPrefixes(): Record<string, string> {
    return {
      "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      "rdfs": "http://www.w3.org/2000/01/rdf-schema#", 
      "owl": "http://www.w3.org/2002/07/owl#",
      "foaf": "http://xmlns.com/foaf/0.1/",
      "dcterms": "http://purl.org/dc/terms/",
      "skos": "http://www.w3.org/2004/02/skos/core#",
      "schema": "http://schema.org/",
      "xsd": "http://www.w3.org/2001/XMLSchema#"
    };
  }
} 