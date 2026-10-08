export function validate(schema, property = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationError = new Error(error.details.map((detail) => detail.message).join(", "));
      validationError.statusCode = 400;
      return next(validationError);
    }

    req[property] = value;
    return next();
  };
}

export default validate;
