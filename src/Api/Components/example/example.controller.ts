import { Response, Request, NextFunction } from "express";
import asyncHandler from "../../../helpers/async";
import ExampleRepo from './example.repository';
import { BadRequestError } from '../../../core/ApiError';
import { SuccessResponse } from '../../../core/ApiResponse';
import Example from './Example'

export class ExampleController {

  getAll = asyncHandler(
    async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {

      const examples = await ExampleRepo.find();
      new SuccessResponse('fetch success', { examples }).send(res);

    }
  )

  getById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const example = await ExampleRepo.findById(req.params.id);
      new SuccessResponse('fetch success', { example }).send(res);
    }
  )

  create = asyncHandler(
    async (req: any, res: Response, next: NextFunction): Promise<Response | void> => {
      const { body } = req;

      const isExist = await ExampleRepo.findOne({ name: body.name } as Example)
      if (isExist) throw new BadRequestError("this example type already exist!")

      const example = await ExampleRepo.create(body);
      new SuccessResponse('create success', { example }).send(res);
    }
  )

  update = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const { body, params } = req;
      const example = await ExampleRepo.update(params.id, body);
      new SuccessResponse('update success', { example }).send(res);
    }
  )

  delete = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
      const { params } = req;
      const example = await ExampleRepo.delete(params.id);
      new SuccessResponse('delete success', { example }).send(res);
    }
  )

}
