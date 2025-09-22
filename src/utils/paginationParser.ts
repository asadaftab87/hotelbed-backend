import { PaginationDataDTO } from "../dto/common.dto";

export class paginationParser {
  
  static  getpaginationData(requestData : any) : PaginationDataDTO {
    const page = +requestData?.page || 1
    const limit = +requestData?.limit || 10
    return { page , limit }
  }

}
