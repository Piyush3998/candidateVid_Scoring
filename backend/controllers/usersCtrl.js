import bcrypt from "bcryptjs";
import asyncHandler from "express-async-handler";
import expressAsyncHandler from "express-async-handler";

import User from "../model/User.js";
import generateToken from "../utils/generateToken.js";
import { getTokenFromHeader } from "../utils/getTokenFromHeader.js";
import { verifyToken } from "../utils/verifyToken.js";

// @desc Register User
// @route POST /api/v1/users/register
// @access Private/Admin
export const registerUserCtrl = expressAsyncHandler(async (req, res) => {
  const { fullname, email, password } = req.body;
  //   check user exits
  const userExists = await User.findOne({ email });
  if (userExists) {
    // throw
    throw new Error("User already exists");
  }
  //   hash password
  const slat = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, slat);
  // create the user
  const user = await User.create({
    fullname,
    email,
    password: hashedPassword,
  });
  res.status(201).json({
    status: "success",
    message: "User Registered Successfully",
    data: user,
  });
});

// @desc Login User
// @route POST /api/v1/users/login
// @access Public
export const loginUserCtrl = expressAsyncHandler(async (req, res) => {
  const { email, password } = req.body;
  //   Find the user in db in email only
  const userFound = await User.findOne({
    email,
  });
  if (userFound && (await bcrypt.compare(password, userFound?.password))) {
    res.json({
      status: "success",
      message: "User Logged in successfully",
      userFound,
      token: generateToken(userFound?._id),
    });
  } else {
    throw new Error("Invalid login credentials");
  }
});

// @desc Login User
// @route POST /api/v1/users/profile
// @access Private
export const getUserProfileCtrl = asyncHandler(async (req, res) => {
  //   get token from header
  //   const token = req?.headers?.authorization?.split(" ")[1];
  //   console.log(token);
  const token = getTokenFromHeader(req);
  const verified = verifyToken(token);
  console.log(verified);
  res.json({
    msg: "Welcome Profile Page",
  });
});
