import * as Ajv from 'ajv';

export async function validateSchema(jsonSchema: any, data: any) {
  const ajv = new Ajv({ verbose: true });
  const valid = ajv.validate(jsonSchema, data);

  return { isValid: valid, errors: ajv.errors };
}
