import Joi, { Root, StringSchema, CustomHelpers, string }  from 'joi';
import { Request, Response, NextFunction } from 'express';
import Logger from '../core/Logger';
import { BadRequestError } from '../core/ApiError';
import { Types } from 'mongoose';
// import { ObjectId, ObjectIdLike } from 'bson';
import { DatabaseId } from '../types/types';
// import joiObjectId from 'joi-objectid';



// const Joi2 = require('@hapi/joi')
// Joi2.objectId = require('joi-objectid')(Joi)


export enum ValidationSource {
  BODY = 'body',
  HEADER = 'headers',
  QUERY = 'query',
  PARAM = 'params',
}


// --------------------------


export const JoiObjectId = () =>
   Joi.string().custom((value: string, helpers) => {
    if (!Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'Object Id Validation');


// type MyInterface = Joi.extractType<typeof schema>;

  // Joi.string()
  // .custom((value: string, helpers) => {
  //   if (!Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  //    return value ;
     
  // }, 'Object Id Validation')
  // .meta({ type: Schema.Types.ObjectId })




// export const JoiObjectId = () => 
//   Joi.string()
//   .custom((value: string, helpers) => {
//     if (!Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
//      return value ;
    
//   }, 'Object Id Validation')  ;



  // -------------------------------------





// export const JoiObjectId = () => 
//   Joi.string()
//   .custom((value: string, helpers) => {
//     if (!Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
//      return value ;
    
//   }, 'Object Id Validation')  ;

export const JoiUrlEndpoint = () =>
  Joi.string().custom((value: string, helpers) => {
    if (value.includes('://')) return helpers.error('any.invalid');
    return value;
  }, 'Url Endpoint Validation');

export const JoiAuthBearer = () =>
  Joi.string().custom((value: string, helpers) => {
    if (!value.startsWith('Bearer ')) return helpers.error('any.invalid');
    if (!value.split(' ')[1]) return helpers.error('any.invalid');
    return value;
  }, 'Authorization Header Validation');

export default (schema: Joi.ObjectSchema, source: ValidationSource = ValidationSource.BODY) => (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error } = schema.validate(req[source]);
    if (!error) return next();

    const { details } = error;
    const message = details.map((i) => i.message.replace(/['"]+/g, '')).join(',');
    Logger.error(message);

    next(new BadRequestError(message));
  } catch (error) {
    next(error);
  }
};

export const JoiNullableObjectId = () =>
Joi.string().custom((value: string, helpers) => {
  if ( !Types.ObjectId.isValid(value) || null ) return helpers.error('any.invalid');
  return value;
}, 'Object Id Validation');

export const JoiStringifiedObjectId = () =>
Joi.any().custom((value: string, helpers) => {
    value = JSON.parse(JSON.stringify(value))
    if (!Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
    return value;
  }, 'Object Id Validation');