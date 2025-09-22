import Joi from 'joi';

export const AppSigninValidationSchema = Joi.object().keys({
  email: Joi.string().email().min(3).max(50).required(),
  password: Joi.string().min(6).max(500).required(),
}).meta({ className: 'AppSigninPayloadDTO' });

// export const AppSignupValidationSchema = Joi.object().keys({
//   email: Joi.string().email().min(3).max(50).required(),
//   name: Joi.string().min(3).max(50).required(),
//   roleCode: Joi.string().min(3).max(50).required(),
//   password: Joi.string().min(6).max(500).required(),
// }).meta({ className: 'AppSignupPayloadDTO' });

export const AppSignupValidationSchema = Joi.object().keys({
  email: Joi.string().email().min(3).max(50).required(),
  password: Joi.string().min(6).max(500).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  userName: Joi.string().required(),
  // dateofbirth: Joi.string().required(),
  // type: Joi.string().required(),
  meta: Joi.object().optional().default({})
}).meta({ className: 'AppSignupPayloadDTO' });

