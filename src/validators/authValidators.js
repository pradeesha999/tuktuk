import { body } from "express-validator";

const mongoId = /^[0-9a-fA-F]{24}$/;
const registerableRoles = ["PROVINCE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER", "DEVICE"];

export const loginValidator = [
  body("username").isString().trim().notEmpty(),
  body("password").isString().notEmpty()
];

export const registerValidator = [
  body("username").isString().trim().isLength({ min: 4, max: 64 }),
  body("password").isString().isLength({ min: 8, max: 128 }),
  body("role").isIn(registerableRoles),
  body("provinceId")
    .optional({ nullable: true })
    .custom((value) => value === null || mongoId.test(String(value))),
  body("districtId")
    .optional({ nullable: true })
    .custom((value) => value === null || mongoId.test(String(value))),
  body("stationId")
    .optional({ nullable: true })
    .custom((value) => value === null || mongoId.test(String(value))),
  body("tukId")
    .optional({ nullable: true })
    .custom((value) => value === null || mongoId.test(String(value))),
  body().custom((value) => {
    const role = value.role;
    if (role === "PROVINCE_ADMIN" && !value.provinceId) {
      throw new Error("provinceId is required for PROVINCE_ADMIN");
    }
    if (role === "DISTRICT_OFFICER" && !value.districtId) {
      throw new Error("districtId is required for DISTRICT_OFFICER");
    }
    if (role === "STATION_OFFICER" && !value.stationId) {
      throw new Error("stationId is required for STATION_OFFICER");
    }
    if (role === "DEVICE" && !value.tukId) {
      throw new Error("tukId is required for DEVICE");
    }
    return true;
  })
];
