// src/utils/sectionMappers.ts

export const sectionMappers: Record<string, string[]> = {
  // --- Contract Header ---
  CCON: [
    "externalInventoryFlag",
    "destinationCode",
    "officeCode",
    "contractNumber",
    "contractName",
    "companyCode",
    "serviceType",
    "hotelCode",
    "giataHotelCode",
    "startDate",
    "endDate",
    "noHotelFlag",
    "currency",
    "baseBoard",
    "classification",
    "paymentModel",
    "dailyPriceFlag",
    "releaseDaysFlag",
    "minChildAge",
    "maxChildAge",
    "opaqueFlag",
    "fixRateFlag",
    "contractType",
    "maxRooms",
    "hotelContent",
    "sellingPriceFlag"
  ],

  // --- Promotions ---
  CNPR: [
    "promotionId",
    "promotionName",
    "startDate",
    "endDate",
    "applyFrom",
    "applyTo",
    "activeFlag"
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

  // --- Restrictions (Inventory) ---
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
  CNSU: ["supplementCode", "description", "amount"],

  // --- Groups ---
  CNGR: ["groupCode", "description"],

  // --- Offers ---
  CNOE: ["offerCode", "description"],

  // --- Service Info In ---
  SIIN: ["serviceCode", "description", "amount", "currency"],

  // --- Service Info Ap ---
  SIAP: ["serviceCode", "description", "amount", "applicableTo"],

  // --- Service Info Cf ---
  SICF: ["serviceCode", "description", "feeType", "amount", "currency"],

  // --- Service Info A ---
  SIA: ["serviceCode", "description", "availability", "notes"],
};
