const navigationToggle = document.querySelector(".nav-toggle");
const siteNavigation = document.getElementById("site-menu");
const menu = document.getElementById("menu");
const submenuToggles = [...document.querySelectorAll(".submenu-toggle")];
const languageOptions = [...document.querySelectorAll(".language-option")];

const ARCHIVE_MENU_ITEMS = [
  { href: "index.html#top", kr: "홈", en: "Home" },
  { href: "index.html#about", kr: "연구실소개", en: "About" },
  { href: "index.html#projects", kr: "연구과제", en: "Projects" },
  { href: "index.html#publications", kr: "연구업적", en: "Publications" },
  { href: "index.html#members", kr: "구성원", en: "Members" },
  { href: "index.html#courses", kr: "강의", en: "Courses" },
  { href: "index.html#news", kr: "소식", en: "News" },
  { href: "join.html", kr: "지원안내", en: "Join Our Lab" },
];

function createArchiveMenuItem(item) {
  const listItem = document.createElement("li");
  const link = document.createElement("a");
  link.href = item.href;
  setLocalizedContent(link, item.kr, item.en);
  listItem.append(link);
  return listItem;
}

function initializeArchiveNavigation() {
  const actions = document.querySelector(".archive-page-actions");
  if (!actions || actions.querySelector(".archive-menu")) {
    return;
  }

  const menu = document.createElement("details");
  menu.className = "archive-menu";

  const summary = document.createElement("summary");
  setLocalizedContent(summary, "메뉴", "Menu");

  const list = document.createElement("ul");
  list.className = "archive-menu-list";
  ARCHIVE_MENU_ITEMS.forEach((item) => {
    list.append(createArchiveMenuItem(item));
  });

  list.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      menu.open = false;
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".archive-menu")) {
      menu.open = false;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });

  menu.append(summary, list);
  actions.insertBefore(menu, actions.querySelector(".language-switcher"));
}

function setMobileMenuState(isOpen) {
  siteNavigation.classList.toggle("open", isOpen);
  navigationToggle.setAttribute("aria-expanded", String(isOpen));

  if (!isOpen) {
    closeAllSubmenus();
  }
}

function closeAllSubmenus(exceptItem = null) {
  document.querySelectorAll(".menu-item.open").forEach((item) => {
    if (item === exceptItem) {
      return;
    }

    item.classList.remove("open");
    item.classList.remove("is-collapsed");
    const button = item.querySelector(":scope > .submenu-toggle");
    if (button) {
      button.setAttribute("aria-expanded", "false");
    }
  });
}

function toggleSubmenu(button) {
  const menuItem = button.closest(".menu-item");
  const willOpen = !menuItem.classList.contains("open");

  closeAllSubmenus(menuItem);
  menuItem.classList.toggle("open", willOpen);
  button.setAttribute("aria-expanded", String(willOpen));

  // 데스크톱에서는 :hover와 :focus-within이 하위 메뉴를 계속 열어두기 때문에,
  // 사용자가 직접 닫았을 때는 is-collapsed로 그 둘을 눌러 둡니다.
  menuItem.classList.toggle("is-collapsed", !willOpen);
  if (!willOpen) {
    button.blur();
  }
}

/* 메뉴에서 섹션으로 갈 때만 부드러운 스크롤을 잠시 꺼서 즉시 이동시킵니다.
   (뉴스 카드 열기처럼 스스로 behavior를 지정하는 곳은 영향을 받지 않습니다.) */
function jumpWithoutScrollAnimation() {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.setTimeout(() => {
    root.style.scrollBehavior = previous;
  }, 120);
}

function initializeNavigation() {
  if (!navigationToggle || !siteNavigation || !menu) {
    return;
  }

  navigationToggle.addEventListener("click", () => {
    const willOpen = !siteNavigation.classList.contains("open");
    setMobileMenuState(willOpen);
  });

  submenuToggles.forEach((button) => {
    button.addEventListener("click", () => {
      toggleSubmenu(button);
    });

    const menuItem = button.closest(".menu-item");
    if (menuItem) {
      menuItem.addEventListener("mouseleave", () => {
        menuItem.classList.remove("is-collapsed");
      });
    }
  });

  menu.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) {
      return;
    }

    if (link.classList.contains("is-placeholder")) {
      event.preventDefault();
      return;
    }

    // 같은 페이지 앵커는 스르륵 내려가지 않고 곧바로 이동시킵니다.
    if (link.hash && link.getAttribute("href").startsWith("#")) {
      jumpWithoutScrollAnimation();
    }

    if (window.matchMedia("(max-width: 1060px)").matches) {
      setMobileMenuState(false);
    } else {
      closeAllSubmenus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav")) {
      closeAllSubmenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    closeAllSubmenus();
    setMobileMenuState(false);
    navigationToggle.focus();
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 1060px)").matches) {
      siteNavigation.classList.remove("open");
      navigationToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setLanguage(language) {
  const selectedLanguage = language === "en" ? "en" : "kr";

  document.documentElement.lang = selectedLanguage === "kr" ? "ko" : "en";

  document.querySelectorAll("[data-kr][data-en]").forEach((element) => {
    element.textContent = element.dataset[selectedLanguage];
  });

  document.querySelectorAll("[data-aria-kr][data-aria-en]").forEach((element) => {
    element.setAttribute("aria-label", element.dataset["aria" + selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)]);
  });

  document.querySelectorAll("[data-alt-kr][data-alt-en]").forEach((element) => {
    element.setAttribute("alt", element.dataset["alt" + selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)]);
  });

  languageOptions.forEach((button) => {
    const isActive = button.dataset.lang === selectedLanguage;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  localStorage.setItem("soclab-language", selectedLanguage);
}

function initializeLanguageSwitcher() {
  const savedLanguage = localStorage.getItem("soclab-language");
  setLanguage(savedLanguage === "en" ? "en" : "kr");

  languageOptions.forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.lang);
    });
  });
}

function initializeSectionHighlighting() {
  if (!menu) {
    return;
  }

  const sectionLinks = [...menu.querySelectorAll('a[href^="#"]:not([href="#"])')];
  const sections = [...document.querySelectorAll("section[id]")];

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        sectionLinks.forEach((link) => {
          link.removeAttribute("aria-current");
        });

        submenuToggles.forEach((button) => {
          button.removeAttribute("aria-current");
        });

        const activeLink = sectionLinks.find(
          (link) => link.getAttribute("href") === "#" + entry.target.id
        );

        if (!activeLink) {
          return;
        }

        activeLink.setAttribute("aria-current", "page");
        const parentToggle = activeLink
          .closest(".menu-item")
          ?.querySelector(":scope > .submenu-toggle");

        if (parentToggle) {
          parentToggle.setAttribute("aria-current", "true");
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );

  sections.forEach((section) => {
    observer.observe(section);
  });
}

function initializeImageSlots() {
  document.querySelectorAll("[data-image-slot]").forEach((slot) => {
    const image = slot.querySelector("img");

    if (!image) {
      return;
    }

    const showImage = () => {
      slot.classList.remove("is-missing");
    };

    const showPlaceholder = () => {
      slot.classList.add("is-missing");
    };

    image.addEventListener("load", showImage);
    image.addEventListener("error", showPlaceholder);

    if (image.complete) {
      if (image.naturalWidth > 0) {
        showImage();
      } else {
        showPlaceholder();
      }
    }
  });
}

function getMemberDisplayNames(member) {
  const englishName = String(member.name_en || "").trim();
  const koreanName = String(member.name_kr || "").trim();

  return {
    kr: koreanName && englishName
      ? koreanName + " (" + englishName + ")"
      : koreanName || englishName,
    en: englishName || koreanName,
  };
}

function getMemberInitials(member) {
  const sourceName = String(member.name_en || member.name_kr || "?").trim();
  const words = sourceName.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function getMemberCategoryLabels(category) {
  const labels = {
    "박사후연구원": { kr: "박사후연구원", en: "Postdoctoral Researcher" },
    "박사/통합과정": { kr: "박사/통합과정", en: "Ph.D. / Integrated Program" },
    "석사과정": { kr: "석사과정", en: "M.S. Program" },
    "인턴": { kr: "학부인턴", en: "Undergraduate Intern" },
    "박사": { kr: "박사", en: "Ph.D." },
    "석사": { kr: "석사", en: "M.S." },
  };

  return labels[category] || { kr: category, en: category };
}

const currentMemberOrderByCategory = {
  "박사후연구원": [
    "윤효준",
  ],
  "박사/통합과정": [
    "박종호",
    "이수령",
    "김성훈",
    "유연우",
    "신승호",
    "문영기",
    "이주용",
    "원두연",
    "김원준",
    "김재현",
    "윤두현",
    "김나연",
    "김다영",
    "정유진",
    "김다훈",
    "김승태",
    "박경규",
    "이미혜",
    "임수민",
    "김강현",
  ],
  "석사과정": [
    "손누리",
    "최연호",
    "손정현",
    "위호연",
    "김준거",
    "조준희",
    "신재우",
    "권인아",
  ],
  "인턴": [
    "김준혁",
  ],
};

function getCurrentMemberDisplayOrder(member) {
  const categoryOrder = currentMemberOrderByCategory[member.category] || [];
  const memberIndex = categoryOrder.indexOf(member.name_kr);
  return memberIndex === -1 ? Number.MAX_SAFE_INTEGER : memberIndex;
}

function createMemberPhoto(member, className) {
  const names = getMemberDisplayNames(member);
  const frame = document.createElement("figure");
  frame.className = className + " member-photo-frame";

  const placeholder = document.createElement("span");
  placeholder.className = "member-photo-placeholder";
  placeholder.textContent = getMemberInitials(member);
  placeholder.setAttribute("aria-hidden", "true");
  frame.append(placeholder);

  const photoPath = String(member.photo_new || "").trim();
  if (!photoPath) {
    frame.classList.add("is-missing");
    return frame;
  }

  const image = document.createElement("img");
  image.src = photoPath;
  image.loading = "lazy";
  image.decoding = "async";
  image.dataset.altKr = names.kr + " 사진";
  image.dataset.altEn = "Photo of " + names.en;
  image.alt = localStorage.getItem("soclab-language") === "en"
    ? image.dataset.altEn
    : image.dataset.altKr;

  const showImage = () => frame.classList.remove("is-missing");
  const showPlaceholder = () => frame.classList.add("is-missing");
  image.addEventListener("load", showImage);
  image.addEventListener("error", showPlaceholder);
  frame.prepend(image);
  return frame;
}

function createProfileField(
  labelKr,
  labelEn,
  value,
  linkPrefix = "",
  localizedValueEn = ""
) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "member-profile-field";
  const term = document.createElement("dt");
  setLocalizedContent(term, labelKr, labelEn);
  const description = document.createElement("dd");

  if (linkPrefix) {
    const link = document.createElement("a");
    link.href = linkPrefix + normalizedValue;
    link.textContent = normalizedValue;
    description.append(link);
  } else if (localizedValueEn) {
    setLocalizedContent(description, normalizedValue, localizedValueEn);
  } else {
    description.textContent = normalizedValue;
  }

  wrapper.append(term, description);
  return wrapper;
}

function createCurrentMemberName(member, className) {
  const name = document.createElement("h4");
  name.className = className + " member-bilingual-name";
  const koreanName = String(member.name_kr || "").trim();
  const englishName = String(member.name_en || "").trim();

  if (koreanName) {
    const korean = document.createElement("span");
    korean.className = "member-name-korean";
    korean.textContent = koreanName;
    name.append(korean);
  }

  if (englishName) {
    const english = document.createElement("span");
    english.className = "member-name-english";
    english.textContent = englishName;
    name.append(english);
  }

  return name;
}

function createCurrentMemberDetail(member, detailId) {
  const category = getMemberCategoryLabels(member.category);
  const detail = document.createElement("section");
  detail.className = "member-detail-panel";
  detail.id = detailId;
  detail.hidden = true;

  const photo = createMemberPhoto(member, "member-detail-photo");
  const content = document.createElement("div");
  content.className = "member-detail-content";
  const name = createCurrentMemberName(member, "member-detail-name");
  const fields = document.createElement("dl");
  fields.className = "member-profile-fields";

  [
    createProfileField("과정", "Program", category.kr, "", category.en),
    createProfileField("연구분야", "Research Area", member.research_interests),
    createProfileField("메일", "Email", member.email, "mailto:"),
    createProfileField("취미", "Hobby", member.hobby),
  ].filter(Boolean).forEach((field) => fields.append(field));

  content.append(name, fields);
  detail.append(photo, content);
  return detail;
}

function closeCurrentMemberDetails(exceptButton = null) {
  document.querySelectorAll(".member-photo-button[aria-expanded=\"true\"]").forEach((button) => {
    if (button === exceptButton) {
      return;
    }

    button.setAttribute("aria-expanded", "false");
    const detail = document.getElementById(button.getAttribute("aria-controls"));
    if (detail) {
      detail.hidden = true;
    }
  });
}

function placeDetailAfterCardRow(
  card,
  detail,
  cardSelector = ".member-card, .alumni-card"
) {
  const container = card.parentElement;
  if (!container) {
    return;
  }

  const wasHidden = detail.hidden;
  detail.hidden = true;
  const cardTop = card.offsetTop;
  const rowCards = [...container.children].filter(
    (element) =>
      element.matches(cardSelector) &&
      Math.abs(element.offsetTop - cardTop) <= 1
  );
  const lastCardInRow = rowCards[rowCards.length - 1] || card;
  lastCardInRow.after(detail);
  detail.hidden = wasHidden;
}

function repositionOpenMemberDetails() {
  document
    .querySelectorAll(
      '.member-photo-button[aria-expanded="true"], ' +
      '.alumni-card-button[aria-expanded="true"]'
    )
    .forEach((button) => {
      const card = button.closest(".member-card, .alumni-card");
      const detail = document.getElementById(button.getAttribute("aria-controls"));

      if (card && detail) {
        placeDetailAfterCardRow(card, detail);
      }
    });
}

let memberDetailResizeFrame = 0;
window.addEventListener("resize", () => {
  window.cancelAnimationFrame(memberDetailResizeFrame);
  memberDetailResizeFrame = window.requestAnimationFrame(() => {
    repositionOpenMemberDetails();
    repositionOpenNewsDetail();
  });
});

function createCurrentMemberElements(member, index) {
  const names = getMemberDisplayNames(member);
  const detailId = "member-detail-" + String(member.post_id || index);
  const card = document.createElement("article");
  card.className = "person member-card";
  const photoButton = document.createElement("button");
  photoButton.className = "member-photo-button";
  photoButton.type = "button";
  photoButton.setAttribute("aria-expanded", "false");
  photoButton.setAttribute("aria-controls", detailId);
  photoButton.dataset.ariaKr = names.kr + " 상세정보 보기";
  photoButton.dataset.ariaEn = "View profile for " + names.en;
  photoButton.setAttribute(
    "aria-label",
    localStorage.getItem("soclab-language") === "en"
      ? photoButton.dataset.ariaEn
      : photoButton.dataset.ariaKr
  );
  photoButton.append(createMemberPhoto(member, "member-card-photo"));

  const name = createCurrentMemberName(member, "member-card-name");
  const research = document.createElement("p");
  research.className = "member-card-research";
  research.textContent = String(member.research_interests || "").trim();
  card.append(photoButton, name);
  if (research.textContent) {
    card.append(research);
  }

  const detail = createCurrentMemberDetail(member, detailId);
  photoButton.addEventListener("click", () => {
    const willOpen = detail.hidden;
    closeCurrentMemberDetails(photoButton);

    if (willOpen) {
      placeDetailAfterCardRow(card, detail);
    }

    detail.hidden = !willOpen;
    photoButton.setAttribute("aria-expanded", String(willOpen));
  });

  return { card, detail };
}

function renderCurrentMembers(members) {
  document.querySelectorAll("[data-member-category]").forEach((container) => {
    const category = container.dataset.memberCategory;
    const categoryMembers = members
      .filter(
        (member) =>
          member &&
          member.category === category &&
          !["faculty", "staff", "alumni"].includes(member.group)
      )
      .sort(
        (first, second) =>
          getCurrentMemberDisplayOrder(first) -
          getCurrentMemberDisplayOrder(second)
      );
    const fragment = document.createDocumentFragment();

    if (categoryMembers.length === 0) {
      const empty = document.createElement("p");
      empty.className = "member-empty";
      setLocalizedContent(
        empty,
        "현재 해당 과정의 구성원이 없습니다.",
        "There are currently no members in this group."
      );
      fragment.append(empty);
    } else {
      const cards = document.createDocumentFragment();
      const details = document.createDocumentFragment();

      categoryMembers.forEach((member, index) => {
        const elements = createCurrentMemberElements(member, index);
        cards.append(elements.card);
        details.append(elements.detail);
      });

      fragment.append(cards, details);
    }

    container.replaceChildren(fragment);
  });
}

function getProfessorProfileValues(member, sectionName) {
  const values = member && member.profile && member.profile[sectionName];
  return Array.isArray(values)
    ? values.filter((value) => String(value).trim() !== "")
    : [];
}

function createProfessorProfileSection(
  member,
  sectionName,
  labelEn,
  className = ""
) {
  const values = getProfessorProfileValues(member, sectionName);
  return createProfessorProfileSectionFromValues(
    sectionName,
    labelEn,
    values,
    className
  );
}

function createProfessorProfileSectionFromValues(
  labelKr,
  labelEn,
  values,
  className = ""
) {
  if (values.length === 0) {
    return null;
  }

  const section = document.createElement("section");
  section.className = ["professor-profile-section", className]
    .filter(Boolean)
    .join(" ");
  const heading = document.createElement("h5");
  setLocalizedContent(heading, labelKr, labelEn);
  const list = document.createElement("ul");

  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = String(value);
    list.append(item);
  });

  section.append(heading, list);
  return section;
}

function createProfessorEducationSection(member) {
  const values = getProfessorProfileValues(member, "학력");
  const educationEntries = [];

  for (let index = 0; index < values.length; index += 2) {
    const institution = String(values[index] || "")
      .trim()
      .replace(/,$/, "");
    const degree = String(values[index + 1] || "").trim();

    if (institution && degree) {
      educationEntries.push(institution + " · " + degree);
    } else if (institution) {
      educationEntries.push(institution);
    }
  }

  return createProfessorProfileSectionFromValues(
    "학력",
    "Education",
    educationEntries,
    "professor-education-section"
  );
}

function createProfessorTagSection(member, sectionName, labelEn, className) {
  return createProfessorProfileSection(
    member,
    sectionName,
    labelEn,
    "professor-tag-section " + className
  );
}

function getProfessorDisplayNameParts(member) {
  const originalName = getProfessorProfileValues(member, "이름")[0];
  const normalizedName = originalName === undefined
    ? ""
    : String(originalName).trim();
  const parenthesisIndex = normalizedName.indexOf("(");

  if (parenthesisIndex > 0) {
    return {
      primary: normalizedName.slice(0, parenthesisIndex).trimEnd(),
      secondary: normalizedName.slice(parenthesisIndex).trim(),
    };
  }

  return {
    primary: normalizedName || String(member.name_kr || "").trim(),
    secondary: String(member.name_en || "").trim(),
  };
}

function renderProfessorProfile(members) {
  const container = document.querySelector("[data-professor-profile]");
  if (!container) {
    return;
  }

  const professor = members.find(
    (member) => member && member.group === "faculty" && member.category === "지도교수"
  );
  if (!professor) {
    const empty = document.createElement("p");
    empty.className = "member-empty";
    setLocalizedContent(
      empty,
      "지도교수 정보가 없습니다.",
      "Professor information is unavailable."
    );
    container.replaceChildren(empty);
    return;
  }

  const profile = document.createElement("article");
  profile.className = "professor-profile";
  const introduction = document.createElement("div");
  introduction.className = "professor-profile-intro";
  const photo = createMemberPhoto(professor, "professor-photo");
  const main = document.createElement("div");
  main.className = "professor-profile-main";
  const name = document.createElement("h4");
  name.className = "professor-profile-name";
  const nameParts = getProfessorDisplayNameParts(professor);
  const primaryName = document.createElement("span");
  primaryName.className = "professor-name-primary";
  primaryName.textContent = nameParts.primary;
  const secondaryName = document.createElement("span");
  secondaryName.className = "professor-name-secondary";
  secondaryName.textContent = nameParts.secondary;
  name.append(primaryName);
  if (nameParts.secondary) {
    name.append(secondaryName);
  }

  const mainSections = document.createElement("div");
  mainSections.className = "professor-main-sections";
  [
    createProfessorEducationSection(professor),
    createProfessorTagSection(
      professor,
      "연구분야",
      "Research Areas",
      "professor-research-section"
    ),
    createProfessorTagSection(
      professor,
      "취미",
      "Hobbies",
      "professor-hobby-section"
    ),
  ].filter(Boolean).forEach((section) => mainSections.append(section));
  main.append(name, mainSections);
  introduction.append(photo, main);

  const career = createProfessorProfileSection(
    professor,
    "경력",
    "Career",
    "professor-career-section"
  );

  const detailSections = document.createElement("div");
  detailSections.className =
    "more-panel-body professor-more-body professor-detail-sections";
  [
    createProfessorProfileSection(
      professor,
      "수상",
      "Awards",
      "professor-awards-section"
    ),
    createProfessorProfileSection(
      professor,
      "사무실",
      "Office",
      "professor-contact-section"
    ),
    createProfessorProfileSection(
      professor,
      "면담시간",
      "Office Hours",
      "professor-contact-section"
    ),
  ].filter(Boolean).forEach((section) => detailSections.append(section));

  profile.append(introduction);
  if (career) {
    profile.append(career);
  }
  profile.append(detailSections);
  container.replaceChildren(profile);
}

function getGraduationSortValue(graduation) {
  const match = String(graduation || "")
    .trim()
    .match(/^((?:19|20)\d{2})(?:[.\/-](\d{1,2}))?/);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const year = Number(match[1]);
  const month = Number(match[2] || 0);
  return year * 12 + month;
}

function compareAlumniByGraduation(first, second) {
  return (
    getGraduationSortValue(first.graduation) -
    getGraduationSortValue(second.graduation)
  );
}

function getObfuscationSeed(member) {
  return [
    String(member.name_kr || ""),
    String(member.graduation || ""),
    "soclab-alumni-v1",
  ].join("|");
}

function createObfuscationState(value) {
  let state = 2166136261;
  const bytes = new TextEncoder().encode(value);

  bytes.forEach((byte) => {
    state ^= byte;
    state = Math.imul(state, 16777619) >>> 0;
  });

  return state || 1;
}

function advanceObfuscationState(state) {
  let next = state >>> 0;
  next ^= (next << 13) >>> 0;
  next ^= next >>> 17;
  next ^= (next << 5) >>> 0;
  return next >>> 0;
}

function decodeAlumniPrivateDetail(member) {
  const protectedValue = String(member.private_detail_obfuscated || "");
  const [version, encodedValue] = protectedValue.split(".", 2);

  if (version !== "v1" || !encodedValue) {
    return {};
  }

  try {
    const base64Value = encodedValue.replace(/-/g, "+").replace(/_/g, "/");
    const paddedValue = base64Value.padEnd(
      Math.ceil(base64Value.length / 4) * 4,
      "="
    );
    const encryptedText = window.atob(paddedValue);
    const decryptedBytes = new Uint8Array(encryptedText.length);
    let state = createObfuscationState(getObfuscationSeed(member));

    for (let index = 0; index < encryptedText.length; index += 1) {
      state = advanceObfuscationState(state);
      decryptedBytes[index] = encryptedText.charCodeAt(index) ^ (state & 0xff);
    }

    const detail = JSON.parse(new TextDecoder().decode(decryptedBytes));
    return detail && typeof detail === "object" ? detail : {};
  } catch (error) {
    console.error("Alumni detail could not be decoded.", error);
    return {};
  }
}

function populateAlumniDetail(detail, member) {
  const privateDetail = decodeAlumniPrivateDetail(member);
  const affiliationValue = String(member.work || "").trim();
  const photo = createMemberPhoto(
    member,
    "member-detail-photo alumni-detail-photo"
  );
  const content = document.createElement("div");
  content.className = "member-detail-content";
  const name = createCurrentMemberName(member, "member-detail-name");
  const fields = document.createElement("dl");
  fields.className = "member-profile-fields";

  [
    createProfileField(
      "재직처",
      "Affiliation",
      affiliationValue,
      "",
      affiliationValue
    ),
    createProfileField("학위논문", "Thesis", member.thesis),
    createProfileField("메일", "Email", privateDetail.email, "mailto:"),
    createProfileField("취미", "Hobby", privateDetail.hobby),
  ].filter(Boolean).forEach((field) => fields.append(field));

  content.append(name, fields);
  detail.replaceChildren(photo, content);
}

function clearAlumniDetail(detail) {
  detail.hidden = true;
  detail.replaceChildren();
}

function closeAlumniDetails(exceptButton = null) {
  document
    .querySelectorAll('.alumni-card-button[aria-expanded="true"]')
    .forEach((button) => {
      if (button === exceptButton) {
        return;
      }

      button.setAttribute("aria-expanded", "false");
      const detail = document.getElementById(button.getAttribute("aria-controls"));
      if (detail) {
        clearAlumniDetail(detail);
      }
    });
}

function createAlumniElements(member, index) {
  const names = getMemberDisplayNames(member);
  const detailId = "alumni-detail-" + String(index);
  const card = document.createElement("article");
  card.className = "alumni-card";
  const button = document.createElement("button");
  button.className = "alumni-card-button";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", detailId);
  button.dataset.ariaKr = names.kr + " 상세정보 보기";
  button.dataset.ariaEn = "View profile for " + names.en;
  button.setAttribute(
    "aria-label",
    localStorage.getItem("soclab-language") === "en"
      ? button.dataset.ariaEn
      : button.dataset.ariaKr
  );

  const name = createCurrentMemberName(member, "alumni-card-name");
  button.append(name);

  const affiliationValue = String(member.work || "").trim();
  const affiliation = document.createElement("span");
  affiliation.className = "alumni-card-affiliation";
  setLocalizedContent(affiliation, affiliationValue, affiliationValue);
  button.append(affiliation);
  card.append(button);

  const detail = document.createElement("section");
  detail.className = "member-detail-panel alumni-detail-panel";
  detail.id = detailId;
  detail.hidden = true;

  button.addEventListener("click", () => {
    const willOpen = detail.hidden;
    closeAlumniDetails(button);

    if (willOpen) {
      placeDetailAfterCardRow(card, detail);
      populateAlumniDetail(detail, member);
      detail.hidden = false;
    } else {
      clearAlumniDetail(detail);
    }

    button.setAttribute("aria-expanded", String(willOpen));
  });

  return { card, detail };
}

function createAlumniDegreeSection(category, alumni) {
  const labels = getMemberCategoryLabels(category);
  const section = document.createElement("section");
  section.className = "alumni-degree-section";
  const heading = document.createElement("div");
  heading.className = "alumni-degree-heading";
  const title = document.createElement("h2");
  setLocalizedContent(title, labels.kr, labels.en);
  const count = document.createElement("span");
  count.className = "publication-count";
  setLocalizedContent(count, alumni.length + "명", alumni.length + " alumni");
  heading.append(title, count);

  const entries = document.createElement("div");
  entries.className = "alumni-card-grid";
  const cards = document.createDocumentFragment();
  const details = document.createDocumentFragment();
  alumni.forEach((member, index) => {
    const categoryKey = category === "박사" ? "phd" : "ms";
    const elements = createAlumniElements(
      member,
      categoryKey + "-" + String(index)
    );
    cards.append(elements.card);
    details.append(elements.detail);
  });
  entries.append(cards, details);
  section.append(heading, entries);
  return section;
}

function renderAlumni(members) {
  const container = document.getElementById("alumni-list");
  const total = document.getElementById("alumni-total");

  if (!container || !total) {
    return;
  }

  const alumni = members.filter(
    (member) =>
      member &&
      member.group === "alumni" &&
      ["박사", "석사"].includes(member.category)
  );
  const doctoralAlumni = alumni
    .filter((member) => member.category === "박사")
    .sort(compareAlumniByGraduation);
  const mastersAlumni = alumni
    .filter((member) => member.category === "석사")
    .sort(compareAlumniByGraduation);
  setLocalizedContent(total, "총 " + alumni.length + "명", alumni.length + " alumni");
  container.replaceChildren(
    createAlumniDegreeSection("박사", doctoralAlumni),
    createAlumniDegreeSection("석사", mastersAlumni)
  );
}

function setLabStatistic(name, value) {
  const statistic = document.querySelector('[data-lab-stat="' + name + '"]');

  if (statistic) {
    statistic.textContent = String(value);
  }
}

function updateLabStatisticsFromMembers(members) {
  const statisticsText = document.querySelector("[data-lab-stats]");

  if (!statisticsText) {
    return;
  }

  const foundedYear = Number(statisticsText.dataset.foundedYear);
  const currentYear = new Date().getFullYear();

  if (Number.isFinite(foundedYear) && foundedYear <= currentYear) {
    setLabStatistic("years", currentYear - foundedYear);
  }

  setLabStatistic(
    "phd-alumni",
    members.filter((member) => member.group === "alumni" && member.category === "박사").length
  );
  setLabStatistic(
    "ms-alumni",
    members.filter((member) => member.group === "alumni" && member.category === "석사").length
  );
  setLabStatistic(
    "doctoral-members",
    members.filter((member) => member.group === "student" && member.category === "박사/통합과정").length
  );
  setLabStatistic(
    "masters-members",
    members.filter((member) => member.group === "student" && member.category === "석사과정").length
  );

  statisticsText.dataset.countStatus = "live";
}

function renderMemberLoadError() {
  const professorContainer = document.querySelector("[data-professor-profile]");
  if (professorContainer) {
    const message = document.createElement("p");
    message.className = "member-error";
    setLocalizedContent(
      message,
      "지도교수 정보를 불러오지 못했습니다.",
      "The professor profile could not be loaded."
    );
    professorContainer.replaceChildren(message);
  }

  document.querySelectorAll("[data-member-category]").forEach((container) => {
    const message = document.createElement("p");
    message.className = "member-error";
    setLocalizedContent(
      message,
      "구성원 정보를 불러오지 못했습니다.",
      "The member list could not be loaded."
    );
    container.replaceChildren(message);
  });

  const alumniContainer = document.getElementById("alumni-list");
  if (alumniContainer) {
    const message = document.createElement("p");
    message.className = "member-error";
    setLocalizedContent(
      message,
      "동문 정보를 불러오지 못했습니다.",
      "The alumni list could not be loaded."
    );
    alumniContainer.replaceChildren(message);
  }
}

async function initializeMembers() {
  const sourceElement = document.querySelector("[data-members-source]");
  if (!sourceElement) {
    return;
  }

  try {
    const response = await fetch(sourceElement.dataset.membersSource, {
      cache: "no-cache",
    });

    if (!response.ok) {
      throw new Error("Member data request failed: " + response.status);
    }

    const members = await response.json();
    if (!Array.isArray(members)) {
      throw new TypeError("Member data must be an array.");
    }

    renderProfessorProfile(members);
    renderCurrentMembers(members);
    renderAlumni(members);
    updateLabStatisticsFromMembers(members);
  } catch (error) {
    renderMemberLoadError();
    console.error(error);
  }
}

function parseProjectDate(value) {
  const match = String(value || "")
    .trim()
    .match(/^((?:19|20)\d{2})\.(\d{2})\.(\d{2})$/);

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  date.setHours(0, 0, 0, 0);
  return date;
}

function isCurrentProject(project, today) {
  const endDate = parseProjectDate(project.end);
  return Boolean(endDate && endDate >= today);
}

function compareCompletedProjects(first, second) {
  const firstEnd = parseProjectDate(first.end)?.getTime() || 0;
  const secondEnd = parseProjectDate(second.end)?.getTime() || 0;

  if (firstEnd !== secondEnd) {
    return secondEnd - firstEnd;
  }

  const firstStart = parseProjectDate(first.start)?.getTime() || 0;
  const secondStart = parseProjectDate(second.start)?.getTime() || 0;

  if (firstStart !== secondStart) {
    return secondStart - firstStart;
  }

  return Number(second.id || 0) - Number(first.id || 0);
}

function compareCurrentProjects(first, second) {
  const firstStart = parseProjectDate(first.start)?.getTime() || 0;
  const secondStart = parseProjectDate(second.start)?.getTime() || 0;

  if (firstStart !== secondStart) {
    return secondStart - firstStart;
  }

  const firstEnd = parseProjectDate(first.end)?.getTime() || 0;
  const secondEnd = parseProjectDate(second.end)?.getTime() || 0;

  if (firstEnd !== secondEnd) {
    return secondEnd - firstEnd;
  }

  return Number(second.id || 0) - Number(first.id || 0);
}

function getProjectLocalizedValue(project, key) {
  const koreanValue = String(project[key + "_kr"] || "").trim();
  const englishValue = String(project[key + "_en"] || "").trim();
  return {
    kr: koreanValue || englishValue,
    en: englishValue || koreanValue,
  };
}

function getProjectDateRange(project) {
  return [project.start, project.end]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" – ");
}

function getProjectMachineDateRange(project) {
  return [project.start, project.end]
    .map((value) => String(value || "").trim().replace(/\./g, "-"))
    .filter(Boolean)
    .join("/");
}

function createProjectMoreLink(project, titleValue) {
  const imagePath = String(project.image || "").trim();

  if (!imagePath) {
    return null;
  }

  const link = document.createElement("a");
  link.className = "more project-more";
  link.href = imagePath;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View More →";
  link.setAttribute("aria-label", "View project image: " + titleValue.en);
  return link;
}

function createCurrentProjectCard(project, index) {
  const titleValue = getProjectLocalizedValue(project, "title");
  const agencyValue = getProjectLocalizedValue(project, "agency");
  const card = document.createElement("article");
  card.className = "feature-card project-card";
  const label = document.createElement("span");
  label.className = "item-label";
  label.textContent =
    "CURRENT PROJECT " +
    String(index + 1).padStart(2, "0");
  const title = document.createElement("h3");
  setLocalizedContent(title, titleValue.kr, titleValue.en);
  const date = document.createElement("time");
  date.className = "project-date";
  date.dateTime = getProjectMachineDateRange(project);
  date.textContent = getProjectDateRange(project);
  const agency = document.createElement("p");
  agency.className = "project-agency";
  setLocalizedContent(agency, agencyValue.kr, agencyValue.en);
  card.append(label, title, date, agency);
  const moreLink = createProjectMoreLink(project, titleValue);
  if (moreLink) {
    card.append(moreLink);
  }
  return card;
}

function createCompletedProjectItem(project) {
  const titleValue = getProjectLocalizedValue(project, "title");
  const agencyValue = getProjectLocalizedValue(project, "agency");
  const item = document.createElement("article");
  item.className = "tl";
  const id = document.createElement("span");
  id.className = "item-label project-id";
  id.textContent = String(project.id);
  const date = document.createElement("time");
  date.className = "yr";
  date.dateTime = getProjectMachineDateRange(project);
  date.textContent = getProjectDateRange(project);
  const title = document.createElement("h3");
  setLocalizedContent(title, titleValue.kr, titleValue.en);
  const agency = document.createElement("div");
  agency.className = "src";
  setLocalizedContent(agency, agencyValue.kr, agencyValue.en);
  item.append(id, date, title, agency);
  const moreLink = createProjectMoreLink(project, titleValue);
  if (moreLink) {
    item.append(moreLink);
  }
  return item;
}

function renderProjects(projects) {
  const currentContainer = document.querySelector("[data-current-projects]");
  const completedContainer = document.querySelector("[data-completed-projects]");

  if (!currentContainer || !completedContainer) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentProjects = projects
    .filter((project) => isCurrentProject(project, today))
    .sort(compareCurrentProjects);
  const completedProjects = projects
    .filter((project) => !isCurrentProject(project, today))
    .sort(compareCompletedProjects);

  if (currentProjects.length === 0) {
    const empty = document.createElement("p");
    empty.className = "project-empty";
    setLocalizedContent(
      empty,
      "현재 수행 중인 과제가 없습니다.",
      "There are no current projects."
    );
    currentContainer.replaceChildren(empty);
  } else {
    currentContainer.replaceChildren(
      ...currentProjects.map(createCurrentProjectCard)
    );
  }

  if (completedProjects.length === 0) {
    const empty = document.createElement("p");
    empty.className = "project-empty";
    setLocalizedContent(
      empty,
      "기수행 과제가 없습니다.",
      "There are no completed projects."
    );
    completedContainer.replaceChildren(empty);
  } else {
    completedContainer.replaceChildren(
      ...completedProjects.map(createCompletedProjectItem)
    );
  }
}

function renderProjectLoadError() {
  document
    .querySelectorAll("[data-current-projects], [data-completed-projects]")
    .forEach((container) => {
      const message = document.createElement("p");
      message.className = "project-error";
      setLocalizedContent(
        message,
        "연구과제 정보를 불러오지 못했습니다.",
        "Project information could not be loaded."
      );
      container.replaceChildren(message);
    });
}

function initializeCompletedProjectLinks() {
  const completedPanel = document.getElementById("completed-projects");
  if (!completedPanel) {
    return;
  }

  document
    .querySelectorAll('a[href="#completed-projects"]')
    .forEach((link) => {
      link.addEventListener("click", () => {
        completedPanel.open = true;
      });
    });

  if (window.location.hash === "#completed-projects") {
    completedPanel.open = true;
  }
}

async function initializeProjects() {
  const projectSection = document.querySelector("[data-projects-source]");
  if (!projectSection) {
    return;
  }

  initializeCompletedProjectLinks();

  try {
    const response = await fetch(projectSection.dataset.projectsSource, {
      cache: "no-cache",
    });

    if (!response.ok) {
      throw new Error("Project data request failed: " + response.status);
    }

    const projects = await response.json();
    if (!Array.isArray(projects)) {
      throw new TypeError("Project data must be an array.");
    }

    renderProjects(projects);
  } catch (error) {
    renderProjectLoadError();
    console.error(error);
  }
}

const NEWS_PAGE_SIZE = 9;

const NEWS_IMAGE_BASE = "images/notice/";

const NEWS_BOARDS = {
  publication: "achievement",
  patent: "achievement",
  award: "achievement",
  achievement: "achievement",
  event: "notice",
  recruit: "notice",
  notice: "notice",
};

const NEWS_CATEGORY_LABELS = {
  publication: { kr: "논문", en: "Publication" },
  patent: { kr: "특허", en: "Patent" },
  award: { kr: "수상", en: "Award" },
  event: { kr: "행사", en: "Event" },
  recruit: { kr: "모집", en: "Recruitment" },
  notice: { kr: "공지", en: "Notice" },
};

const newsState = {
  items: [],
  imagesById: {},
  board: "all",
  visibleCount: NEWS_PAGE_SIZE,
  openId: null,
};

function getNewsFilterCategory(category) {
  return NEWS_BOARDS[category] || "notice";
}

function getNewsCategoryLabel(category) {
  return (
    NEWS_CATEGORY_LABELS[category] ||
    NEWS_CATEGORY_LABELS[getNewsFilterCategory(category)]
  );
}

function formatNewsDate(value) {
  if (typeof value !== "string") {
    return "";
  }

  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return parts ? parts[1] + "." + parts[2] + "." + parts[3] : value;
}

function sortNewsItems(items) {
  return [...items].sort((first, second) => {
    const firstDate = typeof first.date === "string" ? first.date : "";
    const secondDate = typeof second.date === "string" ? second.date : "";

    if (firstDate !== secondDate) {
      return firstDate < secondDate ? 1 : -1;
    }

    return (Number(second.id) || 0) - (Number(first.id) || 0);
  });
}

function getNewsImages(item) {
  const files = newsState.imagesById[String(item.id)];
  return Array.isArray(files) ? files : [];
}

function createNewsMeta(item) {
  const meta = document.createElement("div");
  meta.className = "news-meta";

  const label = getNewsCategoryLabel(item.category);
  const category = document.createElement("span");
  category.className = "cat";
  setLocalizedContent(category, label.kr, label.en);

  const date = document.createElement("time");
  if (typeof item.date === "string") {
    date.dateTime = item.date;
  }
  date.textContent = formatNewsDate(item.date);

  meta.append(category, date);
  return meta;
}

function createNewsBody(body) {
  const fragment = document.createDocumentFragment();

  String(body ?? "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .forEach((block) => {
      const paragraph = document.createElement("p");
      block.split("\n").forEach((line, index) => {
        if (index > 0) {
          paragraph.append(document.createElement("br"));
        }
        paragraph.append(document.createTextNode(line));
      });
      fragment.append(paragraph);
    });

  return fragment;
}

function createNewsGallery(item) {
  const files = getNewsImages(item);
  if (!files.length) {
    return null;
  }

  const gallery = document.createElement("div");
  gallery.className = "news-gallery";
  if (files.length === 1) {
    gallery.classList.add("news-gallery-single");
  }

  files.forEach((file, index) => {
    const source = NEWS_IMAGE_BASE + encodeURIComponent(file);
    const link = document.createElement("a");
    link.className = "news-gallery-item";
    link.href = source;
    link.target = "_blank";
    link.rel = "noopener";

    const image = document.createElement("img");
    image.src = source;
    image.loading = "lazy";
    image.decoding = "async";
    image.alt =
      (typeof item.title === "string" ? item.title : "") +
      (files.length > 1 ? " (" + (index + 1) + ")" : "");

    link.append(image);
    gallery.append(link);
  });

  return gallery;
}

function createNewsDetailPanel(item, detailId) {
  const panel = document.createElement("li");
  panel.className = "news-detail-panel";
  panel.id = detailId;
  panel.hidden = true;

  const title = document.createElement("h3");
  title.className = "news-detail-title";
  title.textContent = typeof item.title === "string" ? item.title : "";

  panel.append(createNewsMeta(item), title);

  const body = createNewsBody(item.body);
  if (body.childNodes.length) {
    const bodyContainer = document.createElement("div");
    bodyContainer.className = "news-detail-body";
    bodyContainer.append(body);
    panel.append(bodyContainer);
  }

  const gallery = createNewsGallery(item);
  if (gallery) {
    panel.append(gallery);
  }

  return panel;
}

function closeOpenNewsDetail() {
  newsState.openId = null;

  document
    .querySelectorAll('.news-card-button[aria-expanded="true"]')
    .forEach((button) => {
      button.setAttribute("aria-expanded", "false");
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      if (panel) {
        panel.hidden = true;
      }
    });
}

function repositionOpenNewsDetail() {
  document
    .querySelectorAll('.news-card-button[aria-expanded="true"]')
    .forEach((button) => {
      const card = button.closest(".news-card");
      const panel = document.getElementById(button.getAttribute("aria-controls"));

      if (card && panel) {
        placeDetailAfterCardRow(card, panel, ".news-card");
      }
    });
}

function createNewsCard(item, index) {
  const card = document.createElement("li");
  card.className = "news-card";
  card.dataset.cat = typeof item.category === "string" ? item.category : "notice";
  card.dataset.board = getNewsFilterCategory(item.category);

  const title = document.createElement("h3");
  title.textContent = typeof item.title === "string" ? item.title : "";

  const hasBody = Boolean(String(item.body ?? "").trim());
  const hasImages = getNewsImages(item).length > 0;

  if (!hasBody && !hasImages) {
    const static_ = document.createElement("div");
    static_.className = "news-card-static";
    static_.append(createNewsMeta(item), title);
    card.append(static_);
    return { card, panel: null };
  }

  const detailId = "news-detail-" + String(item.id ?? index);
  const button = document.createElement("button");
  button.className = "news-card-button";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", detailId);

  const toggle = document.createElement("span");
  toggle.className = "news-card-toggle";
  const toggleText = document.createElement("span");
  setLocalizedContent(toggleText, "내용 보기", "Read more");
  const toggleIcon = document.createElement("span");
  toggleIcon.className = "summary-icon";
  toggleIcon.setAttribute("aria-hidden", "true");
  toggle.append(toggleText, toggleIcon);

  button.append(createNewsMeta(item), title, toggle);
  card.append(button);

  const panel = createNewsDetailPanel(item, detailId);

  button.addEventListener("click", () => {
    const willOpen = panel.hidden;
    closeOpenNewsDetail();

    if (willOpen) {
      placeDetailAfterCardRow(card, panel, ".news-card");
      newsState.openId = item.id;
    }

    panel.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
  });

  return { card, panel };
}

const NEWS_HIGHLIGHT_COUNT = 5;

function createHighlightItem(item) {
  const entry = document.createElement("li");

  const link = document.createElement("a");
  link.className = "highlight-item";
  link.href = "#news";
  link.dataset.newsId = String(item.id);

  const title = document.createElement("span");
  title.className = "highlight-item-title";
  title.textContent = typeof item.title === "string" ? item.title : "";

  const date = document.createElement("time");
  date.className = "highlight-item-date";
  if (typeof item.date === "string") {
    date.dateTime = item.date;
  }
  date.textContent = formatNewsDate(item.date);

  link.append(title, date);
  link.addEventListener("click", (event) => {
    event.preventDefault();
    openNewsItem(item.id);
  });

  entry.append(link);
  return entry;
}

function renderNewsHighlights() {
  document.querySelectorAll("[data-highlight-board]").forEach((list) => {
    const board = list.dataset.highlightBoard;
    const items = newsState.items
      .filter((item) => getNewsFilterCategory(item.category) === board)
      .slice(0, NEWS_HIGHLIGHT_COUNT);

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "highlight-empty";
      setLocalizedContent(
        empty,
        "표시할 소식이 없습니다.",
        "There are no news items to display."
      );
      list.replaceChildren(empty);
      return;
    }

    list.replaceChildren(...items.map(createHighlightItem));
  });
}

function openNewsItem(id) {
  const target = newsState.items.find(
    (item) => String(item.id) === String(id)
  );

  if (!target) {
    return;
  }

  setNewsBoard(getNewsFilterCategory(target.category));

  const position = getVisibleNewsItems().findIndex(
    (item) => String(item.id) === String(id)
  );

  if (position >= newsState.visibleCount) {
    newsState.visibleCount =
      Math.ceil((position + 1) / NEWS_PAGE_SIZE) * NEWS_PAGE_SIZE;
    renderNewsList();
  }

  const button = document.querySelector(
    '.news-card-button[aria-controls="news-detail-' + String(id) + '"]'
  );

  if (!button) {
    document.getElementById("news")?.scrollIntoView();
    return;
  }

  if (button.getAttribute("aria-expanded") !== "true") {
    button.click();
  }

  button.closest(".news-card").scrollIntoView({
    behavior: "auto",
    block: "center",
  });
}

function getVisibleNewsItems() {
  if (newsState.board === "all") {
    return newsState.items;
  }

  return newsState.items.filter(
    (item) => getNewsFilterCategory(item.category) === newsState.board
  );
}

function renderNewsList() {
  const list = document.getElementById("news-list");
  if (!list) {
    return;
  }

  newsState.openId = null;

  const items = getVisibleNewsItems();
  const visible = items.slice(0, newsState.visibleCount);

  if (visible.length) {
    const nodes = [];
    visible.forEach((item, index) => {
      const parts = createNewsCard(item, index);
      nodes.push(parts.card);
      if (parts.panel) {
        nodes.push(parts.panel);
      }
    });
    list.replaceChildren(...nodes);
  } else {
    const empty = document.createElement("li");
    empty.className = "news-status";
    setLocalizedContent(
      empty,
      "표시할 소식이 없습니다.",
      "There are no news items to display."
    );
    list.replaceChildren(empty);
  }

  const moreButton = document.getElementById("news-more");
  if (!moreButton) {
    return;
  }

  const remaining = items.length - visible.length;
  moreButton.hidden = remaining <= 0;

  if (remaining > 0) {
    setLocalizedContent(
      moreButton,
      "소식 더보기 (" + remaining + ")",
      "View more news (" + remaining + ")"
    );
  }
}

function setNewsBoard(board) {
  newsState.board = board;
  newsState.visibleCount = NEWS_PAGE_SIZE;

  document.querySelectorAll(".filters button").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.filter === board)
    );
  });

  renderNewsList();
}

function initializeNewsFilters() {
  document.querySelectorAll(".filters button").forEach((filterButton) => {
    filterButton.addEventListener("click", () => {
      setNewsBoard(filterButton.dataset.filter);
    });
  });

  document.querySelectorAll("[data-news-filter]").forEach((link) => {
    link.addEventListener("click", () => {
      setNewsBoard(link.dataset.newsFilter);
    });
  });

  const moreButton = document.getElementById("news-more");
  if (moreButton) {
    moreButton.addEventListener("click", () => {
      const openButton = document.querySelector(
        '.news-card-button[aria-expanded="true"]'
      );
      const openId = openButton
        ? openButton.getAttribute("aria-controls")
        : null;

      newsState.visibleCount += NEWS_PAGE_SIZE;
      renderNewsList();

      if (openId) {
        const restored = document.querySelector(
          '.news-card-button[aria-controls="' + openId + '"]'
        );
        if (restored) {
          restored.click();
        }
      }
    });
  }
}

async function loadNewsImageMap(source) {
  if (!source) {
    return {};
  }

  try {
    const response = await fetch(source, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("News image map request failed: " + response.status);
    }

    const map = await response.json();
    return map && typeof map === "object" ? map : {};
  } catch (error) {
    console.error(error);
    return {};
  }
}

async function initializeNews() {
  const list = document.getElementById("news-list");
  if (!list) {
    return;
  }

  initializeNewsFilters();

  try {
    const [response, imageMap] = await Promise.all([
      fetch(list.dataset.source, { cache: "no-cache" }),
      loadNewsImageMap(list.dataset.imageSource),
    ]);

    if (!response.ok) {
      throw new Error("News data request failed: " + response.status);
    }

    const items = await response.json();
    if (!Array.isArray(items)) {
      throw new TypeError("News data must be an array.");
    }

    newsState.imagesById = imageMap;
    newsState.items = sortNewsItems(items);
    renderNewsHighlights();
    renderNewsList();
  } catch (error) {
    const message = document.createElement("li");
    message.className = "news-status";
    setLocalizedContent(
      message,
      "소식을 불러오지 못했습니다.",
      "News could not be loaded."
    );
    list.replaceChildren(message);
    console.error(error);
  }
}

function initializeLinkedDetailsPanels() {
  const openLinkedPanel = (hash) => {
    if (!hash || !hash.startsWith("#")) {
      return;
    }

    const target = document.getElementById(hash.slice(1));
    if (target instanceof HTMLDetailsElement) {
      target.open = true;
    }
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      openLinkedPanel(link.getAttribute("href"));
    });
  });

  openLinkedPanel(window.location.hash);
}

const publicationMonthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function setLocalizedContent(element, koreanText, englishText) {
  element.dataset.kr = koreanText;
  element.dataset.en = englishText;
  element.textContent =
    document.documentElement.lang === "en" ? englishText : koreanText;
}

function getPublicationUrl(publication) {
  if (typeof publication.url !== "string" || publication.url.trim() === "") {
    return "";
  }

  try {
    const url = new URL(publication.url);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch (error) {
    return "";
  }
}

function formatPublicationDate(publication) {
  const year = Number(publication.year);
  const month = Number(publication.month);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return "";
  }

  return publicationMonthNames[month - 1] + " " + year;
}

function createPublicationMeta(publication, publicationUrl) {
  const meta = document.createElement("div");
  meta.className = "publication-meta";

  const journal = document.createElement("em");
  journal.className = "publication-journal";
  journal.textContent = publication.journal || "Journal information pending";
  meta.append(journal);

  if (publication.status === "accepted") {
    const status = document.createElement("span");
    status.className = "publication-status";
    status.textContent = "· To be Published";
    meta.append(status);
  } else {
    const bibliographicParts = [];

    if (publication.volume) {
      bibliographicParts.push("vol. " + publication.volume);
    }

    if (publication.issue) {
      bibliographicParts.push("no. " + publication.issue);
    }

    if (publication.pages) {
      bibliographicParts.push("pp. " + publication.pages);
    }

    if (bibliographicParts.length > 0) {
      const bibliographicInfo = document.createElement("span");
      bibliographicInfo.textContent = "· " + bibliographicParts.join(", ");
      meta.append(bibliographicInfo);
    }

    const publicationDate = formatPublicationDate(publication);

    if (publicationDate) {
      const date = document.createElement("span");
      date.textContent = "· " + publicationDate;
      meta.append(date);
    }
  }

  if (publicationUrl) {
    const link = document.createElement("a");
    link.className = "publication-link";
    link.href = publicationUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View Paper ↗";
    meta.append(link);
  }

  return meta;
}

function normalizePublicationAuthorName(authorName) {
  return String(authorName)
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

function isHighlightedPublicationAuthor(authorName, authorIndex) {
  return (
    authorIndex === 0 ||
    normalizePublicationAuthorName(authorName) === "sungho kang"
  );
}

function appendPublicationAuthors(container, authorNames) {
  authorNames.forEach((authorName, authorIndex) => {
    if (authorIndex > 0) {
      container.append(document.createTextNode(", "));
    }

    if (isHighlightedPublicationAuthor(authorName, authorIndex)) {
      const highlightedAuthor = document.createElement("strong");
      highlightedAuthor.textContent = authorName;
      container.append(highlightedAuthor);
      return;
    }

    container.append(document.createTextNode(authorName));
  });
}

function createPublicationItem(publication) {
  const item = document.createElement("li");
  item.className = "publication-item";

  const number = document.createElement("span");
  number.className = "publication-number";
  number.textContent = publication.id + ".";

  const content = document.createElement("article");
  const title = document.createElement("h4");
  title.className = "publication-title";
  const publicationUrl = getPublicationUrl(publication);

  if (publicationUrl) {
    const titleLink = document.createElement("a");
    titleLink.href = publicationUrl;
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    titleLink.textContent = publication.title;
    title.append(titleLink);
  } else {
    title.textContent = publication.title;
  }

  const authors = document.createElement("p");
  authors.className = "publication-authors";
  if (Array.isArray(publication.authors)) {
    appendPublicationAuthors(authors, publication.authors);
  }

  content.append(
    title,
    authors,
    createPublicationMeta(publication, publicationUrl)
  );
  item.append(number, content);

  return item;
}

function createPublicationYear(yearLabelText, publications, shouldOpen, units) {
  const panel = document.createElement("details");
  panel.className = "publication-year";
  panel.open = shouldOpen;

  const summary = document.createElement("summary");
  const yearLabel = document.createElement("span");
  yearLabel.className = "publication-year-label";
  yearLabel.textContent = yearLabelText;

  const count = document.createElement("span");
  count.className = "publication-count";
  setLocalizedContent(
    count,
    publications.length + units.kr,
    publications.length + " " + units.en
  );

  const chevron = document.createElement("span");
  chevron.className = "publication-chevron";
  chevron.setAttribute("aria-hidden", "true");
  summary.append(yearLabel, count, chevron);

  const list = document.createElement("ol");
  list.className = "publication-list";
  publications.forEach((publication) => {
    list.append(createPublicationItem(publication));
  });

  panel.append(summary, list);
  return panel;
}

function getPublicationYearGroup(year) {
  if (year >= 2020) {
    return { key: String(year), label: String(year), sortValue: year };
  }

  if (year >= 2010) {
    return { key: "2010-2019", label: "2010–2019", sortValue: 2019 };
  }

  if (year >= 2000) {
    return { key: "2000-2009", label: "2000–2009", sortValue: 2009 };
  }

  if (year >= 1989) {
    return { key: "1989-1999", label: "1989–1999", sortValue: 1999 };
  }

  return { key: "before-1989", label: "~1988", sortValue: 1988 };
}

function groupPublicationsByYear(publications) {
  return publications.reduce((groups, publication) => {
    const year = Number(publication.year);

    if (!Number.isInteger(year)) {
      return groups;
    }

    const groupDefinition = getPublicationYearGroup(year);

    if (!groups.has(groupDefinition.key)) {
      groups.set(groupDefinition.key, {
        label: groupDefinition.label,
        sortValue: groupDefinition.sortValue,
        publications: [],
      });
    }

    groups.get(groupDefinition.key).publications.push(publication);
    return groups;
  }, new Map());
}

function renderPublications(publications) {
  const container = document.getElementById("publication-years");
  const total = document.getElementById("publication-total");

  if (!container || !total) {
    return;
  }

  const category = container.dataset.category || "international-journal";
  const units = {
    kr: container.dataset.unitKr || "편",
    en: container.dataset.unitEn || "papers",
  };
  const categoryEntries = publications
    .filter(
      (publication) =>
        publication && publication.type === category
    )
    .sort((first, second) => Number(second.id) - Number(first.id));

  setLocalizedContent(
    total,
    "총 " + categoryEntries.length + units.kr,
    categoryEntries.length + " " + units.en
  );

  container.replaceChildren();

  const groupedPublications = groupPublicationsByYear(categoryEntries);
  const yearGroups = [...groupedPublications.values()].sort(
    (first, second) => second.sortValue - first.sortValue
  );

  if (yearGroups.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "publication-empty";
    setLocalizedContent(
      emptyMessage,
      container.dataset.emptyKr || "표시할 자료가 없습니다.",
      container.dataset.emptyEn || "No records are available."
    );
    container.append(emptyMessage);
    return;
  }

  const latestYearPublicationCount = yearGroups[0].publications.length;

  yearGroups.forEach((yearGroup, index) => {
    const shouldOpen =
      index === 0 || (index === 1 && latestYearPublicationCount <= 3);
    container.append(
      createPublicationYear(
        yearGroup.label,
        yearGroup.publications,
        shouldOpen,
        units
      )
    );
  });
}

async function initializePublications() {
  const container = document.getElementById("publication-years");

  if (!container) {
    return;
  }

  try {
    const response = await fetch(container.dataset.source, { cache: "no-cache" });

    if (!response.ok) {
      throw new Error("Publication data request failed: " + response.status);
    }

    const publications = await response.json();

    if (!Array.isArray(publications)) {
      throw new TypeError("Publication data must be an array.");
    }

    renderPublications(publications);
  } catch (error) {
    const errorMessage = document.createElement("p");
    errorMessage.className = "publication-error";
    setLocalizedContent(
      errorMessage,
      "논문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "The publication list could not be loaded. Please try again later."
    );
    container.replaceChildren(errorMessage);
    console.error(error);
  }
}

function createPatentField(labelKr, labelEn, value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return null;
  }

  const field = document.createElement("div");
  field.className = "patent-field";
  const label = document.createElement("dt");
  setLocalizedContent(label, labelKr, labelEn);
  const content = document.createElement("dd");
  content.textContent = normalizedValue;
  field.append(label, content);
  return field;
}

function getPatentNumberLabels(status) {
  if (status === "granted") {
    return {
      kr: "등록번호",
      en: "Registration No.",
    };
  }

  return {
    kr: "출원번호",
    en: "Application No.",
  };
}

function createPatentItem(patent, status) {
  const item = document.createElement("li");
  item.className = "patent-item";

  const id = document.createElement("span");
  id.className = "patent-id";
  id.textContent = String(patent.id);

  const content = document.createElement("article");
  content.className = "patent-content";
  const title = document.createElement("h3");
  title.className = "patent-title";
  title.textContent = String(patent.title || "").trim();

  const details = document.createElement("dl");
  details.className = "patent-fields";
  const numberLabels = getPatentNumberLabels(status);
  const inventors = Array.isArray(patent.inventors)
    ? patent.inventors.map((inventor) => String(inventor).trim()).filter(Boolean)
    : [];
  [
    createPatentField(
      "발명자",
      "Inventors",
      inventors.join(", ")
    ),
    createPatentField(
      numberLabels.kr,
      numberLabels.en,
      patent.number
    ),
    createPatentField(
      "출원지정국",
      "Designated Country",
      patent.country
    ),
  ].filter(Boolean).forEach((field) => details.append(field));

  content.append(title, details);
  item.append(id, content);
  return item;
}

function createPatentYear(yearGroup, shouldOpen, status) {
  const panel = document.createElement("details");
  panel.className = "publication-year patent-year";
  panel.open = shouldOpen;

  const summary = document.createElement("summary");
  const yearLabel = document.createElement("span");
  yearLabel.className = "publication-year-label";
  yearLabel.textContent = yearGroup.label;
  const count = document.createElement("span");
  count.className = "publication-count";
  setLocalizedContent(
    count,
    yearGroup.publications.length + "건",
    yearGroup.publications.length + " patents"
  );
  const chevron = document.createElement("span");
  chevron.className = "publication-chevron";
  chevron.setAttribute("aria-hidden", "true");
  summary.append(yearLabel, count, chevron);

  const list = document.createElement("ol");
  list.className = "patent-list";
  yearGroup.publications.forEach((patent) => {
    list.append(createPatentItem(patent, status));
  });

  panel.append(summary, list);
  return panel;
}

function renderPatents(patents) {
  const container = document.getElementById("patent-years");
  const total = document.getElementById("patent-total");

  if (!container || !total) {
    return;
  }

  const status = container.dataset.status === "granted" ? "granted" : "filed";
  const entries = patents
    .filter((patent) => patent && patent.type === "patent")
    .sort((first, second) => Number(second.id) - Number(first.id));

  setLocalizedContent(
    total,
    "총 " + entries.length + "건",
    entries.length + " patents"
  );
  container.replaceChildren();

  const yearGroups = [...groupPublicationsByYear(entries).values()].sort(
    (first, second) => second.sortValue - first.sortValue
  );

  if (yearGroups.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "publication-empty";
    setLocalizedContent(
      emptyMessage,
      container.dataset.emptyKr || "표시할 특허가 없습니다.",
      container.dataset.emptyEn || "No patents are available."
    );
    container.append(emptyMessage);
    return;
  }

  yearGroups.forEach((yearGroup, index) => {
    container.append(createPatentYear(yearGroup, index === 0, status));
  });
}

async function initializePatents() {
  const container = document.getElementById("patent-years");
  if (!container) {
    return;
  }

  try {
    const response = await fetch(container.dataset.source, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Patent data request failed: " + response.status);
    }

    const patents = await response.json();
    if (!Array.isArray(patents)) {
      throw new TypeError("Patent data must be an array.");
    }

    renderPatents(patents);
  } catch (error) {
    const errorMessage = document.createElement("p");
    errorMessage.className = "publication-error";
    setLocalizedContent(
      errorMessage,
      "특허 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "The patent list could not be loaded. Please try again later."
    );
    container.replaceChildren(errorMessage);
    console.error(error);
  }
}

function formatResearchOutputDate(value, monthOnly = false) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return "–";
  }

  if (monthOnly) {
    const match = normalizedValue.match(/^((?:19|20)\d{2})\.(\d{2})/);
    if (!match) {
      return normalizedValue;
    }

    const monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex >= publicationMonthNames.length) {
      return normalizedValue;
    }

    return publicationMonthNames[monthIndex] + " " + match[1];
  }

  return normalizedValue;
}

function formatVolumeAndIssue(record) {
  return [record.volume, record.issue]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ") || "–";
}

function createResearchOutputRecordItem(record, layout) {
  const item = document.createElement("li");
  item.className = "patent-item research-output-record-item";
  const id = document.createElement("span");
  id.className = "patent-id";
  id.textContent = String(record.id);

  const content = document.createElement("article");
  content.className = "patent-content";
  const title = document.createElement("h3");
  title.className = "patent-title";
  title.textContent = String(record.title || "").trim();
  const details = document.createElement("dl");
  details.className = "patent-fields";
  const authors = Array.isArray(record.authors)
    ? record.authors.map((author) => String(author).trim()).filter(Boolean).join(", ")
    : "";
  const isJournal = layout === "journal-list";

  const fields = isJournal
    ? [
        createPatentField("저자", "Authors", authors),
        createPatentField("학술지명", "Journal", record.journal),
        createPatentField("권·호", "Volume · Issue", formatVolumeAndIssue(record)),
        createPatentField("수록면", "Pages", record.pages),
        createPatentField(
          "게재일",
          "Publication Date",
          formatResearchOutputDate(record.date)
        ),
      ]
    : [
        createPatentField("저자", "Authors", authors),
        createPatentField("학술대회명", "Conference", record.conference),
        createPatentField("수록면", "Pages", record.pages),
        createPatentField(
          "개최기간",
          "Conference Date",
          formatResearchOutputDate(record.date, true)
        ),
      ];

  fields.filter(Boolean).forEach((field) => details.append(field));
  content.append(title, details);
  item.append(id, content);
  return item;
}

function createResearchOutputRecordList(records, layout) {
  const list = document.createElement("ol");
  list.className = "patent-list research-output-record-list";
  records.forEach((record) => {
    list.append(createResearchOutputRecordItem(record, layout));
  });
  return list;
}

function createResearchOutputSegment(text, className = "") {
  const segment = document.createElement("span");
  segment.className = ["research-output-segment", className]
    .filter(Boolean)
    .join(" ");
  segment.textContent = text;
  return segment;
}

function createResearchOutputList(records, layout) {
  const list = document.createElement("ol");
  list.className = "research-output-list";

  records.forEach((record) => {
    const item = document.createElement("li");
    item.className = "research-output-list-item";
    const title = createResearchOutputSegment(
      "“" + String(record.title || "").trim() + "”",
      "research-output-list-title"
    );
    const authors = createResearchOutputSegment(
      Array.isArray(record.authors) ? record.authors.join(", ") : ""
    );
    let sourceText = "";

    if (layout === "books") {
      sourceText = [
        record.publisher,
        record.edition ? String(record.edition).trim() + " ed." : "",
        record.pages ? "pp. " + String(record.pages).trim() : "",
        formatResearchOutputDate(record.date),
      ]
        .map((value) => String(value || "").trim())
        .filter((value) => value && value !== "–")
        .join(", ");
      if (record.isbn) {
        sourceText += (sourceText ? " " : "") + "<ISBN " + record.isbn + ">";
      }
    } else {
      const sourceParts = [
        record.journal,
        record.volume ? "vol. " + record.volume : "",
        record.issue ? "no. " + record.issue : "",
        record.pages ? "pp. " + record.pages : "",
        record.year,
      ].map((value) => String(value || "").trim()).filter(Boolean);
      sourceText = sourceParts.join(", ") + (sourceParts.length > 0 ? "." : "");
    }

    const segments = [title];
    if (layout === "books" && record.chapter) {
      segments.push(
        createResearchOutputSegment(
          "Chapter: “" + String(record.chapter).trim() + "”",
          "research-output-list-chapter"
        )
      );
    }
    if (authors.textContent.trim()) {
      segments.push(authors);
    }
    if (sourceText) {
      segments.push(createResearchOutputSegment(sourceText));
    }

    segments.forEach(
      (segment, index) => {
        if (index > 0) {
          const separator = document.createElement("span");
          separator.className = "research-output-separator";
          separator.setAttribute("aria-hidden", "true");
          separator.textContent = "/";
          item.append(separator);
        }
        item.append(segment);
      }
    );
    list.append(item);
  });

  return list;
}

function compareResearchOutputs(first, second) {
  const dateComparison = String(second.date || "").localeCompare(
    String(first.date || "")
  );
  if (dateComparison !== 0) {
    return dateComparison;
  }

  if (Number(second.year || 0) !== Number(first.year || 0)) {
    return Number(second.year || 0) - Number(first.year || 0);
  }

  return Number(second.id || 0) - Number(first.id || 0);
}

function renderResearchOutputs(records) {
  const container = document.getElementById("research-output-archive");
  const total = document.getElementById("research-output-total");
  if (!container || !total) {
    return;
  }

  const layout = container.dataset.layout || "conference-list";
  const entries = records.filter(Boolean).sort(compareResearchOutputs);
  const isBookLayout = layout === "books";
  setLocalizedContent(
    total,
    "총 " + entries.length + (isBookLayout ? "권" : "편"),
    entries.length + (isBookLayout ? " books" : " records")
  );

  if (entries.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "publication-empty";
    setLocalizedContent(
      emptyMessage,
      container.dataset.emptyKr || "표시할 자료가 없습니다.",
      container.dataset.emptyEn || "No records are available."
    );
    container.replaceChildren(emptyMessage);
    return;
  }

  const output = layout.endsWith("-list")
    ? createResearchOutputRecordList(entries, layout)
    : createResearchOutputList(entries, layout);
  container.replaceChildren(output);
}

async function initializeResearchOutputs() {
  const container = document.getElementById("research-output-archive");
  if (!container) {
    return;
  }

  const sources = String(
    container.dataset.sources || container.dataset.source || ""
  ).split(",").map((source) => source.trim()).filter(Boolean);

  try {
    const datasets = await Promise.all(
      sources.map(async (source) => {
        const response = await fetch(source, { cache: "no-cache" });
        if (!response.ok) {
          throw new Error("Research output data request failed: " + response.status);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new TypeError("Research output data must be an array.");
        }
        return data;
      })
    );

    renderResearchOutputs(datasets.flat());
  } catch (error) {
    const errorMessage = document.createElement("p");
    errorMessage.className = "publication-error";
    setLocalizedContent(
      errorMessage,
      "연구업적 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "The research output list could not be loaded. Please try again later."
    );
    container.replaceChildren(errorMessage);
    console.error(error);
  }
}

function createCourseLink(course) {
  const link = document.createElement("a");
  link.className = "course-link";
  link.href = "https://ys.learnus.org/";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const koreanName = String(course.nameKr || course.name || "").trim();
  const englishName = String(course.nameEn || course.name || "").trim();
  const label = document.createElement("span");
  setLocalizedContent(label, koreanName, englishName);
  const arrow = document.createElement("span");
  arrow.className = "course-link-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  link.append(label, arrow);
  return link;
}

function renderCourses(courses) {
  document.querySelectorAll("[data-course-level]").forEach((container) => {
    const level = container.dataset.courseLevel;
    const activeCourses = courses.filter(
      (course) =>
        course &&
        course.active === true &&
        String(course.level || "").trim() === level
    );

    if (activeCourses.length === 0) {
      const empty = document.createElement("p");
      empty.className = "course-empty";
      setLocalizedContent(
        empty,
        "현재 진행 중인 강의가 없습니다.",
        "No courses are currently active."
      );
      container.replaceChildren(empty);
      return;
    }

    container.replaceChildren(...activeCourses.map(createCourseLink));
  });
}

async function initializeCourses() {
  const courseSection = document.querySelector("[data-courses-source]");
  if (!courseSection) {
    return;
  }

  try {
    const response = await fetch(courseSection.dataset.coursesSource, {
      cache: "no-cache",
    });
    if (!response.ok) {
      throw new Error("Course data request failed: " + response.status);
    }

    const courses = await response.json();
    if (!Array.isArray(courses)) {
      throw new TypeError("Course data must be an array.");
    }

    renderCourses(courses);
  } catch (error) {
    document.querySelectorAll("[data-course-level]").forEach((container) => {
      const message = document.createElement("p");
      message.className = "course-error";
      setLocalizedContent(
        message,
        "강의 목록을 불러오지 못했습니다.",
        "The course list could not be loaded."
      );
      container.replaceChildren(message);
    });
    console.error(error);
  }
}

function initializeHeroWordCloud() {
  const wordCloud = document.querySelector("[data-hero-wordcloud]");
  if (!wordCloud) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  if (reducedMotion.matches || coarsePointer.matches) {
    return;
  }

  const terms = Array.from(wordCloud.querySelectorAll("[data-cloud-depth]"))
    .filter((term) => !term.classList.contains("hero-cloud-core"));
  if (!terms.length) {
    return;
  }

  let frameId = 0;
  let pointerX = null;
  let pointerY = null;
  let termMetrics = [];
  let influenceRadius = 100;
  let maximumOffset = 14;

  function measureTerms() {
    terms.forEach((term) => {
      term.style.transform = "translate(0px, 0px)";
    });

    const cloudBounds = wordCloud.getBoundingClientRect();
    influenceRadius = Math.max(74, Math.min(110, cloudBounds.width * 0.19));
    maximumOffset = Math.max(10, Math.min(15, cloudBounds.width * 0.026));
    termMetrics = terms.map((term) => {
      const bounds = term.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        centerX: bounds.left + bounds.width / 2,
        centerY: bounds.top + bounds.height / 2,
      };
    });
  }

  function renderPointerRepulsion() {
    frameId = 0;

    terms.forEach((term, index) => {
      const metric = termMetrics[index];
      if (pointerX === null || pointerY === null || !metric) {
        term.style.transform = "translate(0px, 0px)";
        return;
      }

      const nearestX = Math.max(metric.left, Math.min(pointerX, metric.right));
      const nearestY = Math.max(metric.top, Math.min(pointerY, metric.bottom));
      const distance = Math.hypot(pointerX - nearestX, pointerY - nearestY);

      if (distance >= influenceRadius) {
        term.style.transform = "translate(0px, 0px)";
        return;
      }

      let deltaX = metric.centerX - pointerX;
      let deltaY = metric.centerY - pointerY;
      let directionLength = Math.hypot(deltaX, deltaY);
      if (directionLength < 0.5) {
        const angle = index * 2.399963;
        deltaX = Math.cos(angle);
        deltaY = Math.sin(angle);
        directionLength = 1;
      }

      const depth = Number(term.dataset.cloudDepth) || 0;
      const proximity = 1 - distance / influenceRadius;
      const force = proximity * proximity;
      const offset = maximumOffset * force * (0.86 + depth * 0.14);
      const offsetX = (deltaX / directionLength) * offset;
      const offsetY = (deltaY / directionLength) * offset;
      term.style.transform = `translate(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px)`;
    });
  }

  function requestPointerRepulsion() {
    if (!frameId) {
      frameId = window.requestAnimationFrame(renderPointerRepulsion);
    }
  }

  function handlePointerEnter(event) {
    measureTerms();
    pointerX = event.clientX;
    pointerY = event.clientY;
    requestPointerRepulsion();
  }

  function handlePointerMove(event) {
    if (!termMetrics.length) {
      measureTerms();
    }
    pointerX = event.clientX;
    pointerY = event.clientY;
    requestPointerRepulsion();
  }

  function resetPointerRepulsion() {
    pointerX = null;
    pointerY = null;
    termMetrics = [];
    requestPointerRepulsion();
  }

  wordCloud.addEventListener("pointerenter", handlePointerEnter);
  wordCloud.addEventListener("pointermove", handlePointerMove);
  wordCloud.addEventListener("pointerleave", resetPointerRepulsion);
  window.addEventListener("resize", resetPointerRepulsion);
}

function initializePage() {
  initializeNavigation();
  initializeArchiveNavigation();
  initializeLanguageSwitcher();
  initializeSectionHighlighting();
  initializeHeroWordCloud();
  initializeImageSlots();
  initializeMembers();
  initializeProjects();
  initializeNews();
  initializeLinkedDetailsPanels();
  initializePublications();
  initializePatents();
  initializeResearchOutputs();
  initializeCourses();
}

document.addEventListener("DOMContentLoaded", initializePage);
