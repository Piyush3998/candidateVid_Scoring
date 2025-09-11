/**
 * You need to do this because it gives your MongoDB collections structure, validation, and relationships while still letting you use MongoDB’s flexibility. Without it, your app would be harder to maintain, validate, and scale.
 */

import mongoose from "mongoose";

const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    fullname: {
      type: String,
      require: true,
    },
    email: {
      type: String,
      require: true,
    },
    password: {
      type: String,
      require: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compile the schema to model
const User = mongoose.model("User", UserSchema);

export default User;
