import { body } from "express-validator";

const mongoId = /^[0-9a-fA-F]{24}$/;

export const provinceCreateValidator = [
  body("name").isString().trim().notEmpty(),
  body("code").isString().trim().notEmpty()
];

export const provinceUpdateValidator = [
  body("name").optional().isString().trim().notEmpty(),
  body("code").optional().isString().trim().notEmpty()
];

export const districtCreateValidator = [
  body("name").isString().trim().notEmpty(),
  body("code").isString().trim().notEmpty(),
  body("province").matches(mongoId)
];

export const districtUpdateValidator = [
  body("name").optional().isString().trim().notEmpty(),
  body("code").optional().isString().trim().notEmpty(),
  body("province").optional().matches(mongoId)
];

export const policeStationCreateValidator = [
  body("name").isString().trim().notEmpty(),
  body("code").isString().trim().notEmpty(),
  body("district").matches(mongoId)
];

export const policeStationUpdateValidator = [
  body("name").optional().isString().trim().notEmpty(),
  body("code").optional().isString().trim().notEmpty(),
  body("district").optional().matches(mongoId)
];

export const tukCreateValidator = [
  body("registrationNumber").isString().trim().notEmpty(),
  body("deviceId").isString().trim().notEmpty(),
  body("ownerName").optional().isString(),
  body("district").optional().matches(mongoId),
  body("policeStation").optional().matches(mongoId),
  body("legacyDistrictName").optional().isString().trim().notEmpty(),
  body().custom((value) => Boolean(value.district || value.legacyDistrictName))
];

export const tukUpdateValidator = [
  body("registrationNumber").optional().isString().trim().notEmpty(),
  body("deviceId").optional().isString().trim().notEmpty(),
  body("ownerName").optional().isString(),
  body("district").optional().matches(mongoId),
  body("policeStation").optional().matches(mongoId),
  body("legacyDistrictName").optional().isString().trim().notEmpty()
];

export const locationPingCreateValidator = [
  body("tuk").optional().matches(mongoId),
  body("latitude").isFloat({ min: -90, max: 90 }),
  body("longitude").isFloat({ min: -180, max: 180 }),
  body("pingedAt").optional().isISO8601(),
  body("speedKmh").optional().isFloat({ min: 0 }),
  body("heading").optional().isFloat({ min: 0, max: 359 }),
  body("source").optional().isString().trim().notEmpty()
];
