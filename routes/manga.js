const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { verifyCsrf } = require("../middleware/csrf");
const {
  validateCreateItem,
  validateUpdateItem,
  validateObjectId,
} = require("../middleware/itemValidation");
const {
  uploadCreateImage,
  uploadUpdateImage,
  verifyUploadedImage,
} = require("../middleware/uploads");
const itemController = require("../controllers/saleItemController");

const router = express.Router();

// Public browse
router.get("/", itemController.manga_list);
router.get("/item/:id", validateObjectId, itemController.manga_details);
router.get("/categories", itemController.get_manga_categories);
router.get("/category/:category", itemController.manga_category);

// Authenticated mutations
router.get("/update", requireAuth, itemController.select_manga_update);
router.get(
  "/update/:id",
  requireAuth,
  validateObjectId,
  itemController.get_manga_update
);
router.post(
  "/update/:id",
  requireAuth,
  validateObjectId,
  uploadUpdateImage,
  verifyCsrf,
  verifyUploadedImage,
  validateUpdateItem,
  itemController.manga_update
);

router.get("/create", requireAuth, itemController.get_manga_create);
router.post(
  "/create",
  requireAuth,
  uploadCreateImage,
  verifyCsrf,
  verifyUploadedImage,
  validateCreateItem,
  itemController.manga_create
);

router.post(
  "/:id/delete",
  requireAuth,
  validateObjectId,
  verifyCsrf,
  itemController.manga_delete
);

module.exports = router;
