import exppress from "express";

import { isLoggedIin } from "../middleware/isLoggedIn.js";
import {
  createJobDescriptionCtrl,
  getJobDescriptionsCtrl,
} from "../controllers/jobDescriptionCtrl.js";
import { upload } from "../middleware/upload.js";

const jobDescRoutes = exppress.Router();

// private URL with file upload
jobDescRoutes.post(
  "/jd",
  isLoggedIin, // authentication middleware
  upload.single("file"), // multer file upload
  createJobDescriptionCtrl
);
jobDescRoutes.get("/jd", isLoggedIin, getJobDescriptionsCtrl);

export default jobDescRoutes;
