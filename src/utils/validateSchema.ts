import Ajv from 'ajv';

export async function validateSchema(title: string, jsonSchema: any, data: any) {
    const ajv = new Ajv({ verbose: true });
  
    const valid = ajv.validate(jsonSchema, data);
    console.log(title+":", valid);
    console.log(title+":", ajv.errors);

    return 0
  }