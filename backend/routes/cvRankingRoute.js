import exppress from "express";
import multer from "multer";
import { isLoggedIin } from "../middleware/isLoggedIn.js";
import { rankCVsAgainstJD } from "../controllers/scoreCtrl.js";

const scoreRoute = exppress.Router();

// Get ranking for all CVs against latest JD
// scoreRoute.get("/rank-cvs", isLoggedIin, getLatestJobDescription);
scoreRoute.get("/rank-cvs", isLoggedIin, rankCVsAgainstJD);

export default scoreRoute;
