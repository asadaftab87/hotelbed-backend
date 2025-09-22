import Joi from 'joi';

export default {
  create: Joi.object().keys({
    name: Joi.string().required().min(3),
  }),
};
