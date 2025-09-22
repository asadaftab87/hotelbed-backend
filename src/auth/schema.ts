import Joi from 'joi';
import { JoiAuthBearer } from '../validations/validator';

export default {
  apiKey: Joi.object()
    .keys({
      'x-api-key': Joi.string().required(),
    })
    .unknown(true),
  auth: Joi.object()
    .keys({
      authorization: JoiAuthBearer().required(),
    })
    .unknown(true),
};
