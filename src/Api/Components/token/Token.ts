import { prisma, Tokenstore } from './../../../database';

export const DOCUMENT_NAME = 'Token';
export const COLLECTION_NAME = 'tokens';

export default Tokenstore;

export const TokenModel = prisma.tokenstore;
