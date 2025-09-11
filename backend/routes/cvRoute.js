import exppress from "express";

import {
  getAllCVsCtrl,
  createCVsCtrl,
  deleteAllCVsCtrl,
} from "../controllers/cvCtrl.js";
import { uploadCV } from "../middleware/cvupload.js";
import { isLoggedIin } from "../middleware/isLoggedIn.js";

const cvRoutes = exppress.Router();

cvRoutes.post("/upload-cv", isLoggedIin, uploadCV.array("cvs"), createCVsCtrl);

// Get all CVs with links
cvRoutes.get("/all", isLoggedIin, getAllCVsCtrl);

cvRoutes.delete("/delete-all", isLoggedIin, deleteAllCVsCtrl);

export default cvRoutes;
