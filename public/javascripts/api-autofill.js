(() => {
  const itemName = document.getElementById("manga-name-create");
  const titleWrapper = document.getElementById("title-autocomplete");
  const itemDescription = document.getElementById("manga-description-create");
  const itemCategories = document.getElementById("manga-categories-create");

  if (!itemName || !titleWrapper || !itemDescription || !itemCategories) {
    return;
  }

  let requestNumber = 0;

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.api+json" },
    });
    if (!response.ok) {
      throw new Error(`Kitsu request failed with status ${response.status}`);
    }
    return response.json();
  }

  async function getMangaData(query) {
    const url = new URL("https://kitsu.io/api/edge/manga");
    url.searchParams.set("filter[text]", query);
    return fetchJson(url);
  }

  async function getMangaCategories(slug) {
    const url = new URL("https://kitsu.io/api/edge/manga");
    url.searchParams.set("fields[categories]", "slug,title");
    url.searchParams.set("filter[slug]", slug);
    url.searchParams.set("include", "categories");
    return fetchJson(url);
  }

  function removeSearchRecommendations() {
    document.getElementById("rec-container")?.remove();
  }

  async function fillFormData(title, description, slug) {
    try {
      const itemData = await getMangaCategories(slug);
      const categories = (itemData.included || [])
        .map((item) => item.attributes && item.attributes.title)
        .filter(Boolean)
        .join(", ");

      itemName.value = title;
      itemDescription.value = description || "";
      itemCategories.value = categories;
      removeSearchRecommendations();
    } catch (err) {
      console.error("Unable to load manga categories", err);
    }
  }

  function createRecommendation(attributes) {
    const button = document.createElement("button");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const poster = new Image();

    button.type = "button";
    button.classList.add("rec-card");
    button.setAttribute("role", "option");

    title.textContent = attributes.canonicalTitle;
    description.textContent = attributes.description || "";
    poster.src =
      attributes.posterImage?.tiny ||
      attributes.posterImage?.small ||
      attributes.posterImage?.medium ||
      "";
    poster.alt = "";
    poster.referrerPolicy = "no-referrer";

    button.append(poster, title, description);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      fillFormData(
        attributes.canonicalTitle,
        attributes.description,
        attributes.slug
      );
    });
    return button;
  }

  async function loadRecommendations() {
    const query = itemName.value.trim();
    const currentRequest = ++requestNumber;

    if (!query) {
      removeSearchRecommendations();
      return;
    }

    try {
      const searchData = await getMangaData(query);
      if (currentRequest !== requestNumber) {
        return;
      }

      removeSearchRecommendations();
      const recommendations = (searchData.data || [])
        .slice(0, 3)
        .map((result) => result.attributes)
        .filter(
          (attributes) =>
            attributes?.canonicalTitle?.trim() && attributes?.slug
        );

      if (!recommendations.length) {
        return;
      }

      const container = document.createElement("div");
      container.id = "rec-container";
      container.classList.add("rec-container");
      container.setAttribute("role", "listbox");
      recommendations.forEach((attributes) => {
        container.appendChild(createRecommendation(attributes));
      });
      titleWrapper.appendChild(container);
    } catch (err) {
      if (currentRequest === requestNumber) {
        removeSearchRecommendations();
      }
      console.error("Unable to load manga suggestions", err);
    }
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  itemName.addEventListener("input", debounce(loadRecommendations, 500));
  document.addEventListener("pointerdown", (event) => {
    if (!titleWrapper.contains(event.target)) {
      removeSearchRecommendations();
    }
  });
})();
