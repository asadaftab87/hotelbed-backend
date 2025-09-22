
export type FindManyProps<WhereInput, Delegate, Select, Include> = {
  Model: Delegate,
  where: WhereInput,
  select?: Select,
  include?: Include,
  fullNumberSearch?: string[],
  fullTextSearch: string[],
  search?: string | undefined,
  pagination: { page: string, limit: string, }
  orderBy?: Record<string, 'asc' | 'desc'>
}

export class Repository {

  public static async findMany<WhereInput, Delegate, Select, Include>({
    Model,
    where,
    select,
    include,
    search,
    fullTextSearch,
    orderBy = { createdAt: 'desc' },
    pagination = { page: '1', limit: '10' },
  }: FindManyProps<WhereInput, Delegate, Select, Include>) {
    let OR = [];
    //@ts-ignore
    if (Array.isArray(where.OR)) {
      //@ts-ignore
      OR = where.OR
    }

    if (search) {
      where = {
        ...where,
        OR: [...OR, ...fullTextSearch.map((key) => {
          return { [key]: { contains: search, mode: "insensitive" } }
        })]
      }
    }

    // pagination
    const crPage = parseInt(pagination.page, 10) || 1;
    const crLimit = parseInt(pagination.limit, 10) || 10;
    const startIndex = (crPage - 1) * crLimit;
    const endIndex = crPage * crLimit;
    // @ts-ignore
    const total = await Model.count({ where });
    const pages = Math.ceil(total / crLimit)

    const paginationModel: any = {};
    paginationModel.total = total
    paginationModel.pages = pages

    if (endIndex < total) {
      paginationModel.next = {
        page: crPage + 1,
        limit: crLimit,
      };
    }

    if (startIndex > 0) {
      paginationModel.prev = {
        page: crPage - 1,
        limit: crLimit,
      };
    }

    // @ts-ignore
    const entities = await Model.findMany({
      where,
      include,
      select,
      skip: crLimit * (crPage - 1),
      take: crLimit,
      orderBy: orderBy, // Pass the orderBy object to the findMany method
    })
    return { entities, pagination: paginationModel }
  }

}
