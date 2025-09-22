import Joi from 'joi';

export const CreateCoupleValidationSchema = Joi.object().keys({
  weddingDate: Joi.string().required(),
  partnerName : Joi.string().required(),
  weddingWebsiteUrl : Joi.string().required(),
  privacySettings : Joi.string().required(),
}).meta({ className: 'CreateCouplePayloadDTO' });

export const UpdateCoupleValidationSchema = Joi.object().keys({
 weddingDate: Joi.string().required(),
  partnerName : Joi.string().required(),
  weddingWebsiteUrl : Joi.string().required(),
  privacySettings : Joi.string().required(),
}).meta({ className: 'UpdateCouplePayloadDTO' });

