import { z } from "zod";

/**
 * Resolves $ref references in OpenAPI schemas
 * @param {object} schema - The schema object that may contain $ref
 * @param {object} swaggerSpec - The full OpenAPI specification
 * @returns {object} The resolved schema
 */
function resolveSchemaRef(schema, swaggerSpec) {
  if (!schema || !schema.$ref) {
    return schema;
  }

  // Resolve $ref like "#/definitions/DownloadFileRequest" or "#/components/schemas/User"
  const refPath = schema.$ref.replace('#/', '').split('/');
  let resolved = swaggerSpec;

  for (const part of refPath) {
    if (resolved && typeof resolved === 'object') {
      resolved = resolved[part];
    } else {
      return schema; // Return original if path can't be resolved
    }
  }

  return resolved || schema;
}

/**
 * Converts OpenAPI schema to Zod validator
 * @param {object} schema - OpenAPI schema
 * @param {boolean} isRequired - Whether the field is required
 * @returns {z.ZodType} Zod validator
 */
function convertToZodValidator(schema, isRequired = true) {
  if (!schema) return isRequired ? z.string() : z.string().optional();

  let validator;

  // Handle type
  if (schema.type) {
    switch (schema.type) {
      case 'integer':
        validator = z.number().int();
        break;
      case 'number':
        validator = z.number();
        break;
      case 'boolean':
        validator = z.boolean();
        break;
      case 'array':
        if (schema.items) {
          const itemValidator = convertToZodValidator(schema.items, true);
          validator = z.array(itemValidator);
        } else {
          validator = z.array(z.any());
        }
        break;
      case 'object':
        if (schema.properties) {
          const shape = {};
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            const propRequired = schema.required && schema.required.includes(key);
            shape[key] = convertToZodValidator(propSchema, propRequired);
          }
          validator = z.object(shape);
        } else {
          validator = z.object({});
        }
        break;
      case 'string':
      default:
        validator = z.string();
        break;
    }
  } else if (schema.$ref) {
    // For refs, we'll resolve them later and create object validators
    validator = z.object({});
  } else {
    // Default to string for unknown types
    validator = z.string();
  }

  // Handle enum
  if (schema.enum && Array.isArray(schema.enum)) {
    validator = validator.refine(val => schema.enum.includes(val), {
      message: `Must be one of: ${schema.enum.join(', ')}`
    });
  }

  // Handle format constraints
  if (schema.format) {
    switch (schema.format) {
      case 'email':
        validator = z.string().email();
        break;
      case 'uri':
        validator = z.string().url();
        break;
      case 'uuid':
        validator = z.string().uuid();
        break;
      // Add more format validations as needed
    }
  }

  // Handle numeric constraints
  if (schema.minimum !== undefined) {
    validator = validator.min(schema.minimum);
  }
  if (schema.maximum !== undefined) {
    validator = validator.max(schema.maximum);
  }
  if (schema.minLength !== undefined) {
    validator = validator.min(schema.minLength);
  }
  if (schema.maxLength !== undefined) {
    validator = validator.max(schema.maxLength);
  }

  // Handle description
  if (schema.description) {
    validator = validator.describe(schema.description);
  }

  // Make optional if not required
  if (!isRequired) {
    validator = validator.optional();
  }

  return validator;
}

/**
 * Builds a Zod schema for MCP tool input from OpenAPI operation
 * @param {object} operation - OpenAPI operation object
 * @param {object} swaggerSpec - Full OpenAPI specification
 * @returns {object} Zod schema object for MCP tool input
 */
function buildInputSchema(operation, swaggerSpec) {
  const shape = {};
  const pathParams = new Set([]);
  const queryParams = new Set([]);
  const bodyParams = new Set([]);
  const formParams = new Set([]);
  const headerParams = new Set([]);

  // Handle OpenAPI 2.0 parameters
  if (operation.parameters && Array.isArray(operation.parameters)) {
    for (const param of operation.parameters) {
      const isRequired = param.required === true;

      if (param.in === 'body') {
        // Handle body parameters - create JSON schema for the body object
        const resolvedSchema = resolveSchemaRef(param.schema, swaggerSpec);

        if (resolvedSchema && resolvedSchema.properties) {
          // Create Zod object schema for the body
          const bodyShape = {};
          for (const [key, propSchema] of Object.entries(resolvedSchema.properties)) {
            const propRequired = resolvedSchema.required && resolvedSchema.required.includes(key);
            bodyShape[key] = convertToZodValidator(propSchema, propRequired);
          }
          const bodyZodSchema = z.object(bodyShape);
          shape['json'] = (bodyZodSchema);
          bodyParams.add('json');
        } else {
          // Simple type - use parameter name
          const paramSchema = param.schema || { type: param.type || 'string' };
          let validator = convertToZodValidator(paramSchema, isRequired);

          if (param.description) {
            validator = validator.describe(param.description);
          }

          shape['raw'] = validator;
          bodyParams.add('raw');
        }
      } else {
        // Handle query, path, header, formData parameters
        const paramSchema = param.schema || { type: param.type || 'string' };
        let validator = convertToZodValidator(paramSchema, isRequired);

        // Add description from parameter
        if (param.description) {
          validator = validator.describe(param.description);
        }

        shape[param.name] = validator;

        // Categorize parameters by type
        if (param.in === 'path') {
          pathParams.add(param.name);
        } else if (param.in === 'query') {
          queryParams.add(param.name);
        } else if (param.in === 'formData') {
          formParams.add(param.name);
        } else if (param.in === 'header') {
          headerParams.add(param.name);
        }
      }
    }
  }

  // Handle OpenAPI 3.0+ requestBody
  if (operation.requestBody && operation.requestBody.content) {
    // Prioritize application/json, but handle other content types
    const contentType = operation.requestBody.content['application/json'] ||
                       operation.requestBody.content['application/x-www-form-urlencoded'] ||
                       Object.values(operation.requestBody.content)[0];

    if (contentType && contentType.schema) {
      const resolvedSchema = resolveSchemaRef(contentType.schema, swaggerSpec);

      if (resolvedSchema && resolvedSchema.properties) {
        // Create Zod object schema for the requestBody
        const bodyShape = {};
        for (const [key, propSchema] of Object.entries(resolvedSchema.properties)) {
          const propRequired = resolvedSchema.required && resolvedSchema.required.includes(key);
          bodyShape[key] = convertToZodValidator(propSchema, propRequired);
        }
        const bodyZodSchema = z.object(bodyShape);
        shape['json'] = (bodyZodSchema);
        bodyParams.add('json');
      } else {
        // Simple body parameter
        const isRequired = operation.requestBody.required === true;
        let validator = convertToZodValidator(resolvedSchema, isRequired);

        if (operation.requestBody.description) {
          validator = validator.describe(operation.requestBody.description);
        }

        shape['json'] = validator;
        bodyParams.add('json');
      }
    }
  }

  return {
    inputSchema: shape,
    pathParams,
    queryParams,
    bodyParams,
    formParams,
    headerParams,
  };
}

export { buildInputSchema, resolveSchemaRef };
