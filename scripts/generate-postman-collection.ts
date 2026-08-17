import { readFileSync, writeFileSync } from 'fs';
import {
  parse,
  DocumentNode,
  DefinitionNode,
  FieldDefinitionNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  TypeNode,
} from 'graphql';
import { join } from 'path';

interface PostmanRequest {
  name: string;
  id: string;
  protocolProfileBehavior: {
    disableBodyPruning: boolean;
  };
  request: {
    method: string;
    header: any[];
    body: {
      mode: string;
      graphql: {
        query: string;
        variables: string;
      };
    };
    url: {
      raw: string;
      host: string[];
    };
  };
  response: any[];
}

interface PostmanFolder {
  name: string;
  item: PostmanRequest[];
}

interface PostmanCollection {
  info: {
    _postman_id: string;
    name: string;
    schema: string;
  };
  item: PostmanFolder[];
}

// Generate a unique Postman ID
function generatePostmanId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `31841861-${timestamp}-${random}`;
}

// Get the type name from a TypeNode
function getTypeName(type: TypeNode): string {
  if (type.kind === 'NamedType') {
    return type.name.value;
  } else if (type.kind === 'ListType') {
    return `[${getTypeName(type.type)}]`;
  } else if (type.kind === 'NonNullType') {
    return `${getTypeName(type.type)}!`;
  }
  return 'Unknown';
}

// Generate default value for input types
function generateDefaultValue(typeName: string, isNonNull: boolean): any {
  const baseType = typeName.replace(/[\[\]!]/g, '');

  if (typeName.startsWith('[')) {
    return isNonNull ? [generateDefaultValue(baseType, false)] : [];
  }

  switch (baseType) {
    case 'String':
      return '';
    case 'Int':
    case 'Float':
      return 0;
    case 'Boolean':
      return false;
    case 'ID':
      return '';
    case 'DateTime':
      return new Date().toISOString();
    default:
      return {};
  }
}

// Generate variables object for input types
function generateVariables(
  schema: DocumentNode,
  args: readonly InputValueDefinitionNode[],
): string {
  const variables: Record<string, any> = {};
  const inputTypeDefinitions = new Map<string, InputObjectTypeDefinitionNode>();

  // Build a map of input type definitions
  schema.definitions.forEach((def) => {
    if (def.kind === 'InputObjectTypeDefinition') {
      inputTypeDefinitions.set(def.name.value, def);
    }
  });

  // Process each argument
  args.forEach((arg) => {
    const argName = arg.name.value;
    const typeName = getTypeName(arg.type);
    const baseTypeName = typeName.replace(/[\[\]!]/g, '');
    const isNonNull = typeName.includes('!');

    // Check if this is a custom input type
    const inputTypeDef = inputTypeDefinitions.get(baseTypeName);

    if (inputTypeDef && inputTypeDef.fields) {
      const inputObject: Record<string, any> = {};

      inputTypeDef.fields.forEach((field) => {
        const fieldTypeName = getTypeName(field.type);
        const fieldBaseTypeName = fieldTypeName.replace(/[\[\]!]/g, '');
        const fieldIsNonNull = fieldTypeName.includes('!');

        // Check for nested input types
        const nestedInputTypeDef = inputTypeDefinitions.get(fieldBaseTypeName);

        if (nestedInputTypeDef && nestedInputTypeDef.fields) {
          const nestedObject: Record<string, any> = {};
          nestedInputTypeDef.fields.forEach((nestedField) => {
            const nestedTypeName = getTypeName(nestedField.type);
            const nestedIsNonNull = nestedTypeName.includes('!');
            nestedObject[nestedField.name.value] = generateDefaultValue(
              nestedTypeName,
              nestedIsNonNull,
            );
          });
          inputObject[field.name.value] = nestedObject;
        } else {
          inputObject[field.name.value] = generateDefaultValue(
            fieldTypeName,
            fieldIsNonNull,
          );
        }
      });

      variables[argName] = inputObject;
    } else {
      variables[argName] = generateDefaultValue(typeName, isNonNull);
    }
  });

  return JSON.stringify(variables, null, 2);
}

// Generate fields for return type
function generateReturnFields(
  schema: DocumentNode,
  returnType: string,
  maxDepth: number = 2,
  currentDepth: number = 0,
): string {
  if (currentDepth >= maxDepth) return '';

  const baseType = returnType.replace(/[\[\]!]/g, '');

  // Skip scalar types
  const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime'];
  if (scalarTypes.includes(baseType)) {
    return '';
  }

  const objectTypeDef = schema.definitions.find(
    (def): def is ObjectTypeDefinitionNode =>
      def.kind === 'ObjectTypeDefinition' && def.name.value === baseType,
  );

  if (!objectTypeDef || !objectTypeDef.fields) {
    return '';
  }

  const fields: string[] = [];

  objectTypeDef.fields.forEach((field) => {
    const fieldTypeName = getTypeName(field.type);
    const fieldBaseType = fieldTypeName.replace(/[\[\]!]/g, '');
    const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime'];

    if (scalarTypes.includes(fieldBaseType)) {
      fields.push(`        ${field.name.value}`);
    } else {
      // For nested objects, recurse if we haven't reached max depth
      const nestedFields = generateReturnFields(
        schema,
        fieldTypeName,
        maxDepth,
        currentDepth + 1,
      );
      if (nestedFields) {
        fields.push(
          `        ${field.name.value} {\n${nestedFields}\n        }`,
        );
      } else {
        fields.push(`        ${field.name.value}`);
      }
    }
  });

  return fields.join('\n');
}

// Generate GraphQL query string
function generateGraphQLQuery(
  schema: DocumentNode,
  operationType: 'query' | 'mutation' | 'subscription',
  field: FieldDefinitionNode,
): string {
  const fieldName = field.name.value;
  const args = field.arguments || [];
  const returnType = getTypeName(field.type);

  let argsString = '';
  let argsUsage = '';

  if (args.length > 0) {
    const argDefs = args.map((arg) => {
      const argName = arg.name.value;
      const argType = getTypeName(arg.type);
      return `$${argName}: ${argType}`;
    });
    argsString = ` (${argDefs.join(', ')})`;

    const argUsage = args.map((arg) => {
      const argName = arg.name.value;
      return `${argName}: $${argName}`;
    });
    argsUsage = ` (${argUsage.join(', ')})`;
  }

  const returnFields = generateReturnFields(schema, returnType);
  const fieldsBlock = returnFields ? ` {\n${returnFields}\n    }` : '';

  return `${operationType}${argsString} {\n    ${fieldName}${argsUsage}${fieldsBlock}\n}`;
}

// Main function to generate Postman collection
function generatePostmanCollection() {
  const schemaPath = join(__dirname, '..', 'src', 'schema.gql');
  const collectionPath = join(
    __dirname,
    '..',
    'postman',
    'collections',
    '31841861-7cefd49a-5965-4ea1-9aa4-a43c810a3e9e.json',
  );

  // Read and parse GraphQL schema
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const schema = parse(schemaContent);

  // Find Query, Mutation, and Subscription types
  const queryType = schema.definitions.find(
    (def): def is ObjectTypeDefinitionNode =>
      def.kind === 'ObjectTypeDefinition' && def.name.value === 'Query',
  );

  const mutationType = schema.definitions.find(
    (def): def is ObjectTypeDefinitionNode =>
      def.kind === 'ObjectTypeDefinition' && def.name.value === 'Mutation',
  );

  const subscriptionType = schema.definitions.find(
    (def): def is ObjectTypeDefinitionNode =>
      def.kind === 'ObjectTypeDefinition' && def.name.value === 'Subscription',
  );

  const folders: PostmanFolder[] = [];

  // Generate mutations
  if (mutationType && mutationType.fields) {
    const mutationRequests: PostmanRequest[] = mutationType.fields.map(
      (field) => ({
        name: field.name.value,
        id: generatePostmanId(),
        protocolProfileBehavior: {
          disableBodyPruning: true,
        },
        request: {
          method: 'POST',
          header: [],
          body: {
            mode: 'graphql',
            graphql: {
              query: generateGraphQLQuery(schema, 'mutation', field),
              variables: generateVariables(schema, field.arguments || []),
            },
          },
          url: {
            raw: '{{url}}',
            host: ['{{url}}'],
          },
        },
        response: [],
      }),
    );

    folders.push({
      name: 'mutations',
      item: mutationRequests,
    });
  }

  // Generate queries
  if (queryType && queryType.fields) {
    const queryRequests: PostmanRequest[] = queryType.fields.map((field) => ({
      name: field.name.value,
      id: generatePostmanId(),
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        method: 'POST',
        header: [],
        body: {
          mode: 'graphql',
          graphql: {
            query: generateGraphQLQuery(schema, 'query', field),
            variables: generateVariables(schema, field.arguments || []),
          },
        },
        url: {
          raw: '{{url}}',
          host: ['{{url}}'],
        },
      },
      response: [],
    }));

    folders.push({
      name: 'queries',
      item: queryRequests,
    });
  }

  // Generate subscriptions
  if (subscriptionType && subscriptionType.fields) {
    const subscriptionRequests: PostmanRequest[] = subscriptionType.fields.map(
      (field) => ({
        name: field.name.value,
        id: generatePostmanId(),
        protocolProfileBehavior: {
          disableBodyPruning: true,
        },
        request: {
          method: 'POST',
          header: [],
          body: {
            mode: 'graphql',
            graphql: {
              query: generateGraphQLQuery(schema, 'subscription', field),
              variables: generateVariables(schema, field.arguments || []),
            },
          },
          url: {
            raw: '{{url}}',
            host: ['{{url}}'],
          },
        },
        response: [],
      }),
    );

    folders.push({
      name: 'subscriptions',
      item: subscriptionRequests,
    });
  }

  // Create final collection
  const collection: PostmanCollection = {
    info: {
      _postman_id: '31841861-7cefd49a-5965-4ea1-9aa4-a43c810a3e9e',
      name: 'Errandy Collection - GraphQL',
      schema:
        'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: folders,
  };

  // Write to file
  writeFileSync(collectionPath, JSON.stringify(collection, null, '\t'));

  console.log('✅ Postman collection generated successfully!');
  console.log(`   Mutations: ${mutationType?.fields?.length || 0}`);
  console.log(`   Queries: ${queryType?.fields?.length || 0}`);
  console.log(`   Subscriptions: ${subscriptionType?.fields?.length || 0}`);
}

// Run the generator
generatePostmanCollection();
