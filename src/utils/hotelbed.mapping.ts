// src/utils/sectionMappers.ts

export const sectionMappers: Record<string, (string | null)[]> = {
  // --- Hotel Master Information ---
  // Format: hotelCode:category:destination:chain:market:ranking:noHotelFlag:country:accommodationType:lat:lon:name
  // Note: accommodationType is often EMPTY in ZIP (field 8)
  HOTEL: [
    "hotelCode",         // 0
    "hotelCategory",     // 1
    "destinationCode",   // 2
    "chainCode",         // 3
    "contractMarket",    // 4
    "ranking",           // 5
    "noHotelFlag",       // 6
    "countryCode",       // 7
    "accommodationType", // 8 - Often empty!
    "latitude",          // 9
    "longitude",         // 10
    "hotelName"          // 11
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
  // Format: startDate:endDate:roomCode:characteristic:rateCode:(tuples)
  // Note: releaseDays & allotment are INSIDE tuples, not separate fields!
  CNIN: [
    "startDate",
    "endDate",
    "roomCode",
    "characteristic",
    "rateCode",
    "inventoryTuples"  // Field 5 - contains all (releaseDays,allotment) tuples
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
  // NOTE: ZIP format starts with empty field! :20250908:20250927:T::DBL:SU-VM::2:99:Y:Y:Y:Y:Y:Y:Y
  CNEM: [
    null,           // field_0 is empty in ZIP
    "startDate",    // field_1  - 20250908
    "endDate",      // field_2  - 20250927
    "checkInFlag",  // field_3  - T (true/false)
    "perDateFlag",  // field_4  - empty (true/false)
    "roomCode",     // field_5  - DBL
    "characteristic", // field_6  - SU-VM
    "boardCode",    // field_7  - empty or board code
    "minNights",    // field_8  - 2
    "maxNights",    // field_9  - 99
    "monFlag",      // field_10 - Y (Monday)
    "tueFlag",      // field_11 - Y (Tuesday)
    "wedFlag",      // field_12 - Y (Wednesday)
    "thuFlag",      // field_13 - Y (Thursday)
    "friFlag",      // field_14 - Y (Friday)
    "satFlag",      // field_15 - Y (Saturday)
    "sunFlag"       // field_16 - Y (Sunday)
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
  // NOTE: ZIP format starts with empty field! :20250910:20251231::3:12:0.000:100.000:0.000:0.000::EN
  CNCF: [
    null,              // field_0 is empty in ZIP
    "startDate",       // field_1  - 20250910
    "endDate",         // field_2  - 20251231
    "rateCode",        // field_3  - empty or rate code
    "daysBeforeCheckin", // field_4  - 3
    "chargeType",      // field_5  - 12
    "amount",          // field_6  - 0.000
    "amountFrom",      // field_7  - 100.000 (additional amount field)
    "amountTo",        // field_8  - 0.000 (additional amount field)
    "percentage",      // field_9  - 0.000
    null,              // field_10 - empty (reserved)
    "languageCode"     // field_11 - EN (language)
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
