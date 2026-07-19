#! /usr/bin/env node

/**
 * Seed sample manga inventory items.
 *
 * Usage:
 *   node populatedb.js
 *   node populatedb.js mongodb://...
 *
 * If no URL is passed, uses DEV_MONGODB or PROD_MONGODB from .env.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const Item = require("./models/saleItem");

const mongoDB =
  process.argv[2] || process.env.DEV_MONGODB || process.env.PROD_MONGODB;

if (!mongoDB) {
  console.error(
    "ERROR: Provide a MongoDB URL as an argument or set DEV_MONGODB / PROD_MONGODB in .env",
  );
  process.exit(1);
}

mongoose.set("strictQuery", false);

const seedItems = [
  {
    item_name: "Chainsaw Man Vol. 1-11",
    item_description: "Chainsaw Man Vol. 1-11: Part 1 Brand New",
    item_categories: [{ category: "Supernatural" }, { category: "Action" }],
    price: 115.0,
    number_in_stock: 3,
    item_publisher: "VIZ BOOKS",
    item_author: "Tatsuki Fujimoto",
    item_picture_path: "data/uploads/chainsaw-man.jpg",
  },
  {
    item_name: "Kaguya-Sama Love is War Vol. 9-22",
    item_description: "Kaguya-Sama Love is war volumes 9-22 Brand New",
    item_categories: [{ category: "Comedy" }, { category: "Romance" }],
    price: 115.0,
    number_in_stock: 2,
    item_publisher: "VIZ BOOKS",
    item_author: "Aka Akasaka",
    item_picture_path: "data/uploads/kaguya-sama.jpg",
  },
  {
    item_name: "Jujutsu Kaisen Vol. 1-19",
    item_description: "Jujutsu Kaisen volumes 1-19 Brand New",
    item_categories: [
      { category: "Battles" },
      { category: "Action" },
      { category: "Supernatural" },
    ],
    price: 150.0,
    number_in_stock: 3,
    item_publisher: "VIZ BOOKS",
    item_author: "Gege Akutami",
    item_picture_path: "data/uploads/jujutsu-kaisen.jpg",
  },
];

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoDB);

  // Replace any previous seed rows so re-runs are idempotent for these titles
  const seedNames = seedItems.map((item) => item.item_name);
  const removed = await Item.deleteMany({ item_name: { $in: seedNames } });
  if (removed.deletedCount) {
    console.log(`Removed ${removed.deletedCount} existing seed item(s)`);
  }

  console.log("Adding seed items...");
  await Item.insertMany(seedItems);
  console.log(`Inserted ${seedItems.length} items`);

  await mongoose.connection.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
