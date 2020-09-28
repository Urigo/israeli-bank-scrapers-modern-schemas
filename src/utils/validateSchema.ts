import Ajv from 'ajv';

export async function validateSchema(jsonSchema: any, data: any) {
  const ajv = new Ajv({ verbose: true });
  const valid = ajv.validate(jsonSchema, data);

  // let schemaName = title? title+' ' : '';
  // console.log(`${schemaName} Schema Validation`);
  // console.log(`Valid: ${valid}`);
  // if (ajv.errors) console.log(`Errors: ${ajv.errors}`);
  // console.log("***");

  return { isValid: valid, errors: ajv.errors };
}
