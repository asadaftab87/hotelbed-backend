import { prisma, IPrisma, Example } from '../../../database';

export const DOCUMENT_NAME = IPrisma.ModelName.Example;

export default Example;

export const ExampleModel = prisma.example;
