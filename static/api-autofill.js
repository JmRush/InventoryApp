async function getMangaData(mangaName) {
  const res = await fetch(
    encodeURI(`https://kitsu.io/api/edge/manga?filter[text]=${mangaName}`)
  );
  if (res.ok) {
    return res.json();
  } else {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
}
async function getMangaCategories(mangaSlug) {
  const res = await fetch(
    `https://kitsu.io/api/edge/manga?fields%5Bcategories%5D=slug%2Ctitle&filter%5Bslug%5D=${encodeURI(
      mangaSlug
    )}&include=categories`
  );
  if (res.ok) {
    return res.json();
  } else {
    throw new Error(`${res.stauts}: ${res.text()}`);
  }
}
async function fillFormData(title, desc, imageSrc, slug) {
  //make request to kitsu using ID
  let itemData = await getMangaCategories(slug);
  if (!itemData) {
    return;
  }
  itemData = itemData.included;
  let itemName = document.getElementById("manga-name-create");
  let itemDesc = document.getElementById("manga-description-create");
  let itemCategories = document.getElementById("manga-categories-create");
  let categories = "";
  itemData.map((item, index) => {
    if (index != itemData.length - 1) {
      categories += `${item.attributes.title}, `;
    } else {
      categories += `${item.attributes.title}`;
    }
  });
  itemName.value = title;
  itemDesc.value = desc;
  itemCategories.value = categories;

  //maybe recommend an image from kitsu's cdn?
}
function createRecCard(title, desc, imageSrc, slug) {
  //this will return a single element that can be appended upon return to the original function
  //everything is under attributes:
  let recCard = document.createElement("div"); //
  recCard.classList.add("rec-card");
  recCard.addEventListener("click", (event) => {
    //fill the form with data
    fillFormData(title, desc, imageSrc, slug);
  });
  let recTitle = document.createElement("h3"); // canonicalTitle
  let recDesc = document.createElement("p");
  let recPoster = new Image();
  recTitle.innerHTML = title;
  recDesc.innerHTML = desc;
  recPoster.src = imageSrc;
  recCard.appendChild(recPoster);
  recCard.appendChild(recTitle);
  recCard.appendChild(recDesc);
  return recCard;
}

async function autoFillItem() {
  let itemName = document.getElementById("manga-name-create");
  //hit an external api to autofill the form, give multiple options on a dropdown menu for what possible items are wanted
  const searchData = await getMangaData(itemName.value);
  if (searchData) {
    if (document.getElementById("rec-container")) {
      //delete element
      removeSearchRecs();
    }
    let recContainer = document.createElement("div");
    recContainer.setAttribute("id", "rec-container");
    recContainer.classList.add("rec-container");
    let recommendations = searchData.data.slice(0, 3);
    if (
      recommendations[0].attributes.canonicalTitle == "" ||
      recommendations[0].attributes.canonicalTitle == " "
    ) {
      removeSearchRecs();
      return;
    }
    for (let i = 0; i < recommendations.length; i++) {
      recContainer.appendChild(
        createRecCard(
          recommendations[i].attributes.canonicalTitle,
          recommendations[i].attributes.description,
          recommendations[i].attributes.posterImage.medium,
          recommendations[i].attributes.slug
        )
      );
    }
    itemName.after(recContainer);
  }
}

function removeSearchRecs() {
  let recContainer = document.getElementById("rec-container");
  if (recContainer) {
    recContainer.remove();
  }
}

function debounce(fn, time) {
  var timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, arguments);
    }, time);
  };
}

let api_call = debounce(autoFillItem, 500);
