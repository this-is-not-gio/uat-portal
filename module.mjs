// @ts-check
import { module } from "@prisma/composer";
import uatPortalService from "./service.mjs";

export default module("uat-portal", ({ provision }) => {
  provision(uatPortalService, { id: "uatportal" });
});
