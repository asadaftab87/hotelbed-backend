import Joi from 'joi';
import { JoiAuthBearer } from '../validations/validator';

export const userCredential = Joi.object().keys({
  email: Joi.string().required().email(),
  password: Joi.string().required(),
})

export const refreshToken = Joi.object().keys({
  refreshToken: Joi.string().required().min(1),
})

export const signupSchema = Joi.object().keys({
  name: Joi.string().required().min(3),
  email: Joi.string().required().email(),
  password: Joi.string().required().min(6),
  role: Joi.string().required()
})

export const apiKeySchema = Joi.object().keys({
  'x-api-key': Joi.string().required(),
}).unknown(true)

export const authBearerSchema = Joi.object().keys({
  authorization: JoiAuthBearer().required(),
}).unknown(true)
export const webhookHeaderSchema = Joi.object().keys({
  'x-100ms-key': Joi.string().required(),
}).unknown(true)
