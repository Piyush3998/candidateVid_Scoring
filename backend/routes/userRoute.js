import exppress from "express";

import { isLoggedIin } from "../middleware/isLoggedIn.js";
import {
  getUserProfileCtrl,
  loginUserCtrl,
  registerUserCtrl,
} from "../controllers/usersCtrl.js";

const userRoutes = exppress.Router();

userRoutes.post("/register", registerUserCtrl);
userRoutes.post("/login", loginUserCtrl);

// private url
userRoutes.get("/profile", isLoggedIin, getUserProfileCtrl);

export default userRoutes;
