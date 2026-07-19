const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const categorySchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      maxLength: 80,
    },
  },
  { _id: false }
);

const itemSchema = new Schema({
  item_name: { type: String, required: true, trim: true, maxLength: 150 },
  item_description: {
    type: String,
    required: true,
    trim: true,
    maxLength: 1000,
  },
  item_categories: {
    type: [categorySchema],
    required: true,
    validate: {
      validator(categories) {
        return categories.length > 0 && categories.length <= 20;
      },
      message: "Use between 1 and 20 categories",
    },
  },
  price: { type: Number, required: true, min: 10, max: 1_000_000 },
  number_in_stock: {
    type: Number,
    required: true,
    min: 0,
    max: 1_000_000,
    validate: Number.isInteger,
  },
  item_publisher: {
    type: String,
    required: true,
    trim: true,
    maxLength: 150,
  },
  item_author: {
    type: String,
    required: true,
    trim: true,
    maxLength: 150,
  },
  item_picture_path: {
    type: String,
    required: true,
    match: /^data\/uploads\/[A-Za-z0-9._-]+$/,
  },
});

module.exports = mongoose.model("Item", itemSchema);