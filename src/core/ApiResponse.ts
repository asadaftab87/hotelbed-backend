import { Response } from 'express';

/**
 * Base API Response class
 */
export abstract class ApiResponse {
  constructor(
    protected statusCode: number,
    protected message: string
  ) {}

  protected prepare<T extends ApiResponse>(res: Response, response: T): Response {
    return res.status(this.statusCode).json(response);
  }

  public send(res: Response): Response {
    return this.prepare<ApiResponse>(res, this);
  }
}

/**
 * Success Response class
 */
export class SuccessResponse extends ApiResponse {
  constructor(message: string, private data?: any) {
    super(200, message);
  }

  send(res: Response): Response {
    return super.prepare<SuccessResponse>(res, {
      statusCode: this.statusCode,
      message: this.message,
      success: true,
      data: this.data,
    } as any);
  }
}

/**
 * Created Response class (201)
 */
export class CreatedResponse extends ApiResponse {
  constructor(message: string, private data?: any) {
    super(201, message);
  }

  send(res: Response): Response {
    return super.prepare<CreatedResponse>(res, {
      statusCode: this.statusCode,
      message: this.message,
      success: true,
      data: this.data,
    } as any);
  }
}

/**
 * No Content Response class (204)
 */
export class NoContentResponse extends ApiResponse {
  constructor(message = 'No Content') {
    super(204, message);
  }

  send(res: Response): Response {
    return res.status(this.statusCode).send();
  }
}

/**
 * Bad Request Response class (400)
 */
export class BadRequestResponse extends ApiResponse {
  constructor(message = 'Bad Request', private errors?: any) {
    super(400, message);
  }

  send(res: Response): Response {
    return super.prepare<BadRequestResponse>(res, {
      statusCode: this.statusCode,
      message: this.message,
      success: false,
      errors: this.errors,
    } as any);
  }
}

/**
 * Unauthorized Response class (401)
 */
export class UnauthorizedResponse extends ApiResponse {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }

  send(res: Response): Response {
    return super.prepare<UnauthorizedResponse>(res, {
      statusCode: this.statusCode,
      message: this.message,
      success: false,
    } as any);
  }
}

/**
 * Forbidden Response class (403)
 */
export class ForbiddenResponse extends ApiResponse {
  constructor(message = 'Forbidden') {
    super(403, message);
  }

  send(res: Response): Response {
    return super.prepare<ForbiddenResponse>(res, {
      statusCode: this.statusCode,
      message: this.message,
      success: false,
    } as any);
  }
}

/**
 * Not Found Response class (404)
 */
export class NotFoundResponse extends ApiResponse {
  constructor(message = 'Not Found') {
    super(404, message);
  }

  send(res: Response): Response {
    return super.prepare<NotFoundResponse>(res, {
      statusCode: this.statusCode,
      message: this.message,
      success: false,
    } as any);
  }
}

/**
 * Internal Server Error Response class (500)
 */
export class InternalErrorResponse extends ApiResponse {
  constructor(message = 'Internal Server Error') {
    super(500, message);
  }

  send(res: Response): Response {
    return super.prepare<InternalErrorResponse>(res, {
      statusCode: this.statusCode,
      message: this.message,
      success: false,
    } as any);
  }
}

