import { Request, Response, NextFunction } from "express";

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncHandler = (execution: AsyncFunction) => (
    req: Request,
    res: Response,
    next: NextFunction
) =>
    Promise
        .resolve(execution(req, res, next))
        .catch((error) => next(error));

export default asyncHandler;
