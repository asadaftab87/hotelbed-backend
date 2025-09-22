import { Router, Request, Response, NextFunction } from 'express';
import { NotFoundError, ApiError, InternalError, BadRequestError } from '../core/ApiError';
import Logger from "../core/Logger"

const registerErrorHandler = (router: Router): Response | void => {
  router.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.log("========================================================");
    console.log(req.url, req.method);
    console.log(err);
    console.log("========================================================");

    if (err instanceof ApiError) {
      Logger.error(err);
      ApiError.handle(err, res);
    } else {
      if (err.code === 11000) { // Mongoose duplicate key
        const object = Object.keys(err.keyValue);
        const error = `${object[0]} ${err.keyValue[object[0]]} is already Exists`;
        ApiError.handle(new InternalError(error), res);
      }
      else if (err.name === "CastError") {
        ApiError.handle(new BadRequestError(`Invalid Id, ${err.reason}`), res);
      }
      else if (err.name === 'ValidationError') { // Mongoose validation error
        Object.values(err.errors).map((obj: any) => {
          if (obj.kind === 'Number' || obj.kind === 'Number') {
            ApiError.handle(new BadRequestError(`${obj.path} must be ${obj.kind}`), res);
          }
          if (obj.kind === 'ObjectId') {
            ApiError.handle(new BadRequestError(`${obj.value} is not a valid value for the ${obj.path} field`), res);
          }
          if (obj.kind === 'required') {
            ApiError.handle(new BadRequestError(obj.message), res);
          }
          if (obj.kind === 'enum') {
            ApiError.handle(new BadRequestError(`${obj.value} is not a valid value for ${obj.path}`), res);
          } else {
            ApiError.handle(new BadRequestError("Invalid body!"), res);
          }
        });
      }
      else {
        ApiError.handle(new InternalError(), res);
      }
      // if (env.NODE_ENV === 'development') {
      //     Logger.error(err);
      //     return res.status(500).send(err.message);
      // }
    }

    // let errors: Array<string> = []

    // // API Not Found
    // if (err.message === "Not Found") {
    //     err = new HttpException(404, "Not Found");
    // }

    // // API Not Found
    // if (err.name === "CastError") {
    //     errors.push(`${err.reason}`)
    //     err = new HttpException(400, "Invalid Id", errors);
    // }

    // // Mongoose duplicate key
    // if (err.code === 11000) {
    //     const object = Object.keys(err.keyValue);
    //     const error = `${object[0]} ${err.keyValue[object[0]]} is already Exists`;
    //     errors.push(error)
    //     err = new HttpException(409, "Already Exist!", errors);
    // }

    // // Mongoose validation error
    // if (err.name === 'ValidationError') {
    //     // console.log("ValidationError", err)

    //     Object.values(err.errors).map((obj: any) => {
    //         // console.log(obj)
    //         if (obj.kind === 'Number' || obj.kind === 'Number') {
    //             errors.push(`${obj.path} must be ${obj.kind}`)
    //         }
    //         if (obj.kind === 'ObjectId') {
    //             errors.push(`${obj.value} is not a valid value for the ${obj.path} field`)
    //         }
    //         if (obj.kind === 'required') {
    //             errors.push(obj.message)
    //         }
    //         if (obj.kind === 'enum') {
    //             errors.push(`${obj.value} is not a valid value for ${obj.path}`)
    //         }
    //     });
    //     err = new HttpException(403, "Invalid body!", errors);
    // }

    // res
    //     .status(err.status || 500)
    //     .send({
    //         status: err.status || 500,
    //         message: err.message || "Server Error",
    //         errors: err.errors || []
    //     })
  });
}

export default registerErrorHandler
