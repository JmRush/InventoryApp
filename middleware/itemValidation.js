const mongoose = require("mongoose");

const ALLOWED_ITEM_FIELDS = new Set([
  "item_name",
  "item_description",
  "item_categories",
  "price",
  "number_in_stock",
  "item_publisher",
  "item_author",
]);

const LIMITS = {
  item_name: 150,
  item_description: 1000,
  item_publisher: 150,
  item_author: 150,
  category: 80,
  categories: 20,
  price: 1_000_000,
  stock: 1_000_000,
};

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function normalizeText(value, field, maxLength, required) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw validationError(`${field} is required`);
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw validationError(`${field} must be text`);
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    if (required) {
      throw validationError(`${field} is required`);
    }
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw validationError(`${field} must be ${maxLength} characters or fewer`);
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    throw validationError(`${field} contains unsupported control characters`);
  }
  return normalized;
}

function normalizeNumber(value, field, { required, integer, min, max }) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw validationError(`${field} is required`);
    }
    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw validationError(`${field} must be a valid number`);
  }
  if (integer && !Number.isInteger(number)) {
    throw validationError(`${field} must be a whole number`);
  }
  if (number < min || number > max) {
    throw validationError(`${field} must be between ${min} and ${max}`);
  }
  return number;
}

function normalizeCategories(value, required) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw validationError("At least one category is required");
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw validationError("Categories must be comma-separated text");
  }

  const unique = [
    ...new Set(
      value
        .split(",")
        .map((category) =>
          normalizeText(category, "Category", LIMITS.category, false)
        )
        .filter(Boolean)
    ),
  ];

  if (required && unique.length === 0) {
    throw validationError("At least one category is required");
  }
  if (unique.length > LIMITS.categories) {
    throw validationError(`Use no more than ${LIMITS.categories} categories`);
  }
  return unique.map((category) => ({ category }));
}

function rejectUnexpectedFields(body) {
  const unexpected = Object.keys(body).filter(
    (key) => key !== "_csrf" && !ALLOWED_ITEM_FIELDS.has(key)
  );
  if (unexpected.length) {
    throw validationError(`Unexpected field: ${unexpected[0]}`);
  }
}

function buildValidatedItem(body, required) {
  rejectUnexpectedFields(body);

  const item = {
    item_name: normalizeText(
      body.item_name,
      "Title",
      LIMITS.item_name,
      required
    ),
    item_description: normalizeText(
      body.item_description,
      "Description",
      LIMITS.item_description,
      required
    ),
    item_categories: normalizeCategories(body.item_categories, required),
    price: normalizeNumber(body.price, "Price", {
      required,
      integer: false,
      min: 10,
      max: LIMITS.price,
    }),
    number_in_stock: normalizeNumber(body.number_in_stock, "Stock", {
      required,
      integer: true,
      min: 0,
      max: LIMITS.stock,
    }),
    item_publisher: normalizeText(
      body.item_publisher,
      "Publisher",
      LIMITS.item_publisher,
      required
    ),
    item_author: normalizeText(
      body.item_author,
      "Author",
      LIMITS.item_author,
      required
    ),
  };

  return Object.fromEntries(
    Object.entries(item).filter(([, value]) => value !== undefined)
  );
}

function validateItemBody({ required }) {
  return function itemValidation(req, res, next) {
    try {
      req.validatedItem = buildValidatedItem(req.body || {}, required);
      if (!required && Object.keys(req.validatedItem).length === 0 && !req.file) {
        throw validationError("Provide at least one field to update");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function validateObjectId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return next(validationError("Invalid item identifier"));
  }
  next();
}

module.exports = {
  validateCreateItem: validateItemBody({ required: true }),
  validateUpdateItem: validateItemBody({ required: false }),
  validateObjectId,
};
