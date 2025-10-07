// src/utils/sectionMappers.ts

export const sectionMappers: Record<string, string[]> = {
  // --- Hotel Master Information ---
  HOTEL: [
    "hotelCode",
    "hotelCategory",
    "destinationCode",
    "chainCode",
    "contractMarket",
    "ranking",
    "noHotelFlag",
    "countryCode",
    "accommodationType",
    "accommodationCode",
    "latitude",
    "longitude",
    "hotelName"
  ],

  // --- Board Master Information ---
  BOARD: [
    "boardCode",
    "boardType",
    "boardName"
  ],

  // --- Contract Header (CCON) - 26 fields from documentation ---
  CCON: [
    "externalInventory",
    "destinationCode",
    "officeCode",
    "contractNumber",
    "contractName",
    "companyCode",
    "serviceType",
    "hotelCode",
    "giataHotelCode",
    "initialDate",
    "endDate",
    "noHotel",
    "currency",
    "baseBoard",
    "classification",
    "paymentModel",
    "dailyPrice",
    "releaseDays",
    "minChildAge",
    "maxChildAge",
    "opaque",
    "fixRate",
    "contractType",
    "maxRooms",
    "hotelContent",
    "sellingPrice"
  ],

  // --- Promotions (CNPR) - 7 fields from documentation ---
  CNPR: [
    "code",
    "description",
    "initialDate",
    "finalDate",
    "applicationInitialDate",
    "applicationFinalDate",
    "isIncluded"
  ],

  // --- Rooms ---
  CNHA: [
    "roomCode",
    "characteristic",
    "standardCapacity",
    "minPax",
    "maxPax",
    "maxAdults",
    "maxChildren",
    "maxInfants",
    "minAdults",
    "minChildren"
  ],

  // --- Restrictions (CNIN) - Original restriction data ---
  CNIN: [
    "startDate",
    "endDate",
    "roomCode",
    "characteristic",
    "rateCode",
    "releaseDays",
    "allotment",
    "inventoryTuples"
  ],

  // --- Costs / Prices ---
  CNCT: [
    "startDate",
    "endDate",
    "roomCode",
    "characteristic",
    "genericRate",
    "marketPriceCode",
    "perPaxFlag",
    "netPrice",
    "publicPrice",
    "specificRate",
    "boardCode",
    "amount",
    "validFrom",
    "validTo"
  ],

  // --- Minimum & Maximum Stay ---
  CNEM: [
    "startDate",
    "endDate",
    "roomCode",
    "characteristic",
    "boardCode",
    "checkInFlag",
    "perDateFlag",
    "daysRules"
  ],

  // --- Supplements (Board / Pax) ---
  CNSR: [
    "startDate",
    "endDate",
    "boardCode",
    "perPaxFlag",
    "amountSupplement",
    "percentageSupplement",
    "rateCode",
    "roomCode",
    "characteristic",
    "minAge",
    "maxAge",
    "monFlag",
    "tueFlag",
    "wedFlag",
    "thuFlag",
    "friFlag",
    "satFlag",
    "sunFlag",
    "netPrice",
    "publicPrice",
    "marketPrice"
  ],

  // --- Stop Sales ---
  CNPV: [
    "startDate",
    "endDate",
    "rateCode",
    "roomCode",
    "characteristic",
    "boardCode",
    "stopSalesFlag"
  ],

  // --- Cancellation Fees ---
  CNCF: [
    "startDate",
    "endDate",
    "rateCode",
    "daysBeforeCheckin",
    "chargeType",
    "amount",
    "percentage"
  ],

  // --- Valid Rate Codes ---
  CNTA: [
    "rateCode",
    "description"
  ],

  // --- Extra Stay ---
  CNES: ["startDate", "endDate", "roomCode", "characteristic", "checkInFlag", "checkOutFlag"],

  // --- Extra Supplements ---
  CNSU: [
    "startDate",
    "endDate",
    "lastUpdate",
    "releaseEndDate",
    "supplementCode",
    "chargeType",
    "mandatoryFlag",
    "includedFlag",
    "daysBeforeCheckin",
    "applicability",
    "amount",
    "description",
    "perPaxFlag",
    "roomType",
    "rateCode",
    "boardCode",
    "characteristic",
    "minPax",
    "maxPax",
    "minAge",
    "maxAge",
    "monFlag",
    "tueFlag",
    "wedFlag",
    "thuFlag",
    "friFlag",
    "satFlag",
    "sunFlag",
    "netPrice",
    "publicPrice"
  ],

  // --- Groups ---
  CNGR: ["groupCode", "description"],

  // --- Offers ---
  CNOE: ["offerCode", "description"],

  // --- Client/Names (CNNH) ---
  CNNH: ["clientCode", "clientName", "clientType", "activeFlag"],

  // --- Valid Markets (CNCL) - 2 fields from documentation ---
  CNCL: ["countryCode", "validForCountry"],

  // --- Handling Fees (CNHF) - 13 fields from documentation ---
  CNHF: [
    "initialDate",
    "finalDate",
    "code",
    "rate",
    "type",
    "amount",
    "percentage",
    "adultAmount",
    "childAmount",
    "minimumAge",
    "maximumAge",
    "ageAmount",
    "isPerService"
  ],

  // --- Tax Breakdown (ATAX) - 16 fields from documentation ---
  ATAX: [
    "initialDate",
    "finalDate",
    "roomCode",
    "boardCode",
    "taxCode",
    "includedInPrice",
    "maximumNumberOfNights",
    "minimumAge",
    "maximumAge",
    "isPerNight",
    "isPerPax",
    "amount",
    "percentage",
    "currency",
    "applyOver",
    "marketCode",
    "legalDescription"
  ],
};
