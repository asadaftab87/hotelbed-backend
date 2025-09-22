
import Example, { ExampleModel } from './Example';

export default class ExampleRepo {

  public static findById(id: Example['id']): Promise<Example | null> {
    return ExampleModel.findUnique({ where: { id } })
  }

  public static findOne(example: Example): Promise<Example | null> {
    return ExampleModel.findFirst({ where: example })
  }

  public static find(): Promise<Example[] | null> {
    return ExampleModel.findMany({ where: { isPublish: true, isDeleted: false }, orderBy: { createdAt: 'desc' } })
  }

  public static async create(example: Example): Promise<Example | null> {
    return ExampleModel.create({
      data: { ...example, }
    });
  }

  public static async update(id: Example['id'], example: Example): Promise<Example | null> {
    return ExampleModel.update({
      where: { id },
      data: example
    });
  }

  public static async delete(id: Example['id']): Promise<Example | null> {
    return ExampleModel.delete({
      where: { id }
    });
  }

}
