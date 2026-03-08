const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const schema = require('./emailSchema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function validateEmailPayload(payload) {
  const valid = validate(payload);
  if (!valid) {
    const errors = validate.errors.map(e => `${e.instancePath} ${e.message}`).join(', ');
    const error = new Error(`Invalid email payload: ${errors}`);
    error.status = 400;
    throw error;
  }
}

module.exports = { validateEmailPayload };
