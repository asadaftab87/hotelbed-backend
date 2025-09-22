import { Router } from 'express';
import { ExampleController } from './example.controller';
import validator, { ValidationSource } from '../../../helpers/validator';
import authentication from '../../../middleware/authentication';
import authorization from '../../../middleware/authorization';
import schema from './schema'

export class ExampleRoutes {

  readonly router: Router = Router();
  readonly controller: ExampleController = new ExampleController()

  constructor() {
    this.initRoutes();
  }

  initRoutes(): void {

    this.router.get(
      '/:id',
      this.controller.getById
    )

    this.router.get(
      '/',
      this.controller.getAll
    )

    this.router.post(
      '/',
      authentication,
      authorization(["SUPER_ADMIN"]),
      validator(schema.create),
      this.controller.create
    )


    this.router.put(
      '/:id',
      authentication,
      authorization(["SUPER_ADMIN"]),
      this.controller.update
    )

    this.router.delete(
      '/:id',
      authentication,
      authorization(["SUPER_ADMIN"]),
      this.controller.delete
    )

  }

}
