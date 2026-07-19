const Item = require("../models/saleItem");
const {
  publicPathForUpload,
  deleteStoredUpload,
} = require("../middleware/uploads");

function itemNotFound() {
  const err = new Error("Item not found");
  err.status = 404;
  return err;
}

function formatCategories(docs) {
  return docs.map((doc) =>
    doc.item_categories.map(({ category }) => category).join(", ")
  );
}

exports.manga_list = async function mangaList(req, res, next) {
  try {
    const docs = await Item.find({
      item_name: { $ne: null },
      item_publisher: { $ne: null },
    })
      .sort({ item_name: 1 })
      .exec();

    if (!docs.length) {
      throw new Error("No matching documents found");
    }

    res.render("manga", {
      manga_list: docs,
      categories: formatCategories(docs),
    });
  } catch (err) {
    next(err);
  }
};

exports.get_manga_categories = async function getMangaCategories(req, res, next) {
  try {
    const docs = await Item.find({
      item_categories: { $elemMatch: { category: { $ne: null } } },
    })
      .select("item_categories -_id")
      .exec();

    if (!docs.length) {
      throw new Error("No categories found");
    }

    const uniqueCategories = {};
    for (const doc of docs) {
      for (const { category } of doc.item_categories) {
        uniqueCategories[category] = (uniqueCategories[category] || 0) + 1;
      }
    }

    res.render("viewAllCategories", {
      categoryKeys: Object.keys(uniqueCategories),
      uniqueCategories,
    });
  } catch (err) {
    next(err);
  }
};

exports.manga_details = async function mangaDetails(req, res, next) {
  try {
    const doc = await Item.findById(req.params.id).exec();
    if (!doc) {
      throw itemNotFound();
    }
    res.render("viewItem", { doc });
  } catch (err) {
    next(err);
  }
};

exports.manga_category = async function mangaCategory(req, res, next) {
  try {
    const selectedCategory = req.params.category.trim().slice(0, 80);
    const docs = await Item.find({
      item_categories: { $elemMatch: { category: selectedCategory } },
    }).exec();

    if (!docs.length) {
      throw itemNotFound();
    }

    res.render("viewCategory", { category_list: docs });
  } catch (err) {
    next(err);
  }
};

exports.get_manga_create = function getMangaCreate(req, res) {
  res.render("createItem");
};

exports.manga_create = async function mangaCreate(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error("A valid JPEG or PNG cover image is required");
      err.status = 400;
      throw err;
    }

    const item = new Item({
      ...req.validatedItem,
      item_picture_path: publicPathForUpload(req.file),
    });
    await item.save();

    // The upload now belongs to the saved item, not error cleanup.
    req.file = undefined;
    res.redirect("/manga");
  } catch (err) {
    next(err);
  }
};

exports.select_manga_update = async function selectMangaUpdate(req, res, next) {
  try {
    const docs = await Item.find({
      item_name: { $ne: null },
      item_publisher: { $ne: null },
    })
      .sort({ item_name: 1 })
      .exec();

    if (!docs.length) {
      throw new Error("No matching documents found");
    }

    res.render("selectUpdate", {
      manga_list: docs,
      categories: formatCategories(docs),
    });
  } catch (err) {
    next(err);
  }
};

exports.get_manga_update = async function getMangaUpdate(req, res, next) {
  try {
    const doc = await Item.findById(req.params.id).exec();
    if (!doc) {
      throw itemNotFound();
    }
    res.render("updateItem", { doc });
  } catch (err) {
    next(err);
  }
};

exports.manga_update = async function mangaUpdate(req, res, next) {
  try {
    const updates = { ...req.validatedItem };
    if (req.file) {
      updates.item_picture_path = publicPathForUpload(req.file);
    }

    const previousItem = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { runValidators: true }
    ).exec();

    if (!previousItem) {
      throw itemNotFound();
    }

    if (req.file) {
      req.file = undefined;
      try {
        await deleteStoredUpload(previousItem.item_picture_path);
      } catch (cleanupErr) {
        console.error("Failed to delete replaced cover image", cleanupErr);
      }
    }

    res.redirect("/manga");
  } catch (err) {
    next(err);
  }
};

exports.manga_delete = async function mangaDelete(req, res, next) {
  try {
    const doc = await Item.findByIdAndDelete(req.params.id).exec();
    if (!doc) {
      throw itemNotFound();
    }

    try {
      await deleteStoredUpload(doc.item_picture_path);
    } catch (cleanupErr) {
      console.error("Failed to delete item cover image", cleanupErr);
    }

    res.redirect("/manga");
  } catch (err) {
    next(err);
  }
};
