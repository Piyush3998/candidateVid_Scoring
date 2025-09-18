import exppress from "express";
import { getNumbers, saveNumbers } from "../controllers/numberCtrl.js";

const numberRoute = exppress.Router();

numberRoute.post("/ats-number", saveNumbers);
numberRoute.get("/ats-number", getNumbers);

export default numberRoute;
