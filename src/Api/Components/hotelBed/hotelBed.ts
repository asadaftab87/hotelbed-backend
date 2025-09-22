import { prisma, IPrisma, HotelBedFile } from '../../../database';

export const DOCUMENT_NAME = IPrisma.ModelName.HotelBedFile;

export default HotelBedFile;

export const HotelBedFileModel = prisma.hotelBedFile;
