interface JsonSchema {
  additionalProperties?: boolean;
  allOf?: JsonSchema[];
  const?: unknown;
  enum?: unknown[];
  if?: JsonSchema;
  items?: JsonSchema;
  maxItems?: number;
  maxLength?: number;
  maximum?: number;
  minLength?: number;
  minimum?: number;
  not?: JsonSchema;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  then?: JsonSchema;
  type?: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string';
  uniqueItems?: boolean;
}

const forbiddenObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const maximumValidationDepth = 20;

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function matchesType(value: unknown, type: JsonSchema['type']) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object')
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validateValue(
  schema: JsonSchema,
  value: unknown,
  path: string,
  depth: number,
): string | undefined {
  if (depth > maximumValidationDepth) return `${path} exceeds the validation depth limit.`;
  if (schema.type && !matchesType(value, schema.type)) return `${path} must be ${schema.type}.`;
  if (schema.const !== undefined && !Object.is(value, schema.const))
    return `${path} must equal ${JSON.stringify(schema.const)}.`;
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value)))
    return `${path} must be one of ${schema.enum.map(String).join(', ')}.`;

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      return `${path} must contain at least ${schema.minLength} characters.`;
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      return `${path} must contain at most ${schema.maxLength} characters.`;
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      return `${path} must be at least ${schema.minimum}.`;
    if (schema.maximum !== undefined && value > schema.maximum)
      return `${path} must be at most ${schema.maximum}.`;
  }

  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      return `${path} must contain at most ${schema.maxItems} items.`;
    if (schema.uniqueItems) {
      const seen = new Set<string>();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) return `${path} must contain unique items.`;
        seen.add(key);
      }
    }
    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        const error = validateValue(schema.items, value[index], `${path}[${index}]`, depth + 1);
        if (error) return error;
      }
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    const unsafeKey = keys.find((key) => forbiddenObjectKeys.has(key));
    if (unsafeKey) return `${path}.${unsafeKey} is not allowed.`;
    for (const required of schema.required ?? []) {
      if (!hasOwn(record, required)) return `${path}.${required} is required.`;
    }
    if (schema.additionalProperties === false) {
      const unexpected = keys.find((key) => !hasOwn(schema.properties ?? {}, key));
      if (unexpected) return `${path}.${unexpected} is not allowed.`;
    }
    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (!hasOwn(record, key)) continue;
      const error = validateValue(propertySchema, record[key], `${path}.${key}`, depth + 1);
      if (error) return error;
    }
  }

  for (const childSchema of schema.allOf ?? []) {
    const error = validateValue(childSchema, value, path, depth + 1);
    if (error) return error;
  }
  if (schema.if && !validateValue(schema.if, value, path, depth + 1) && schema.then) {
    const error = validateValue(schema.then, value, path, depth + 1);
    if (error) return error;
  }
  if (schema.not && !validateValue(schema.not, value, path, depth + 1))
    return `${path} matches a disallowed input shape.`;
  if (schema.oneOf) {
    const matchCount = schema.oneOf.filter(
      (candidate) => !validateValue(candidate, value, path, depth + 1),
    ).length;
    if (matchCount !== 1) return `${path} must match exactly one supported input shape.`;
  }
  return undefined;
}

function validate(schema: Record<string, unknown>, input: unknown) {
  return validateValue(schema, input, 'input', 0);
}

export const webMcpInputValidator = { validate };
