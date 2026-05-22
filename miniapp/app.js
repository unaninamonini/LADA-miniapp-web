const telegram = window.Telegram?.WebApp;
const appShell = document.querySelector(".app-shell");
const tabs = document.querySelectorAll("[data-view]");
const panels = document.querySelectorAll("[data-panel]");
const jumps = document.querySelectorAll("[data-jump]");
const form = document.querySelector("#booking-form");
const bookingDate = document.querySelector("#booking-date");
const sectionChoices = document.querySelector("#section-choices");
const serviceChoices = document.querySelector("#service-choices");
const detailStep = document.querySelector("#detail-step");
const genderField = document.querySelector("#gender-field");
const genderChoices = document.querySelector("#gender-choices");
const optionsField = document.querySelector("#options-field");
const optionChoices = document.querySelector("#option-choices");
const hairLengthNote = document.querySelector("#hair-length-note");
const addonChoices = document.querySelector("#addon-choices");
const scheduleStep = document.querySelector("#schedule-step");
const slotChoices = document.querySelector("#slot-choices");
const contactStep = document.querySelector("#contact-step");
const clientName = document.querySelector("#client-name");
const clientContact = document.querySelector("#client-contact");
const clientComment = document.querySelector("#client-comment");
const bookingSummary = document.querySelector("#booking-summary");
const bookingStatus = document.querySelector("#booking-status");
const submitBooking = document.querySelector("#submit-booking");
const catalogList = document.querySelector("#catalog-list");
const catalogGridBack = document.querySelector("#catalog-grid-back");
const trainingPhotoGallery = document.querySelector("#training-photo-gallery");
const trainingGifGallery = document.querySelector("#training-gif-gallery");
const phoneCopy = document.querySelector("[data-phone-copy]");
const copyToast = document.querySelector("#copy-toast");
let copyToastTimeout;

const state = {
  catalog: null,
  photoManifest: {},
  trainingManifest: {},
  catalogLayout: "grid",
  catalogAnchorId: "",
  section: null,
  service: null,
  genderId: "",
  option: null,
  addonIds: new Set(),
  date: "",
  startTime: "",
};

function scrollToView(view) {
  document.querySelector(`[data-panel="${view}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function switchView(view, scroll = true) {
  appShell.dataset.view = view;
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === view));
  if (scroll) {
    requestAnimationFrame(() => scrollToView(view));
  }
}

function describeTelegramRuntime() {
  if (!telegram) {
    return;
  }

  telegram.ready();
  telegram.expand();
  telegram.disableVerticalSwipes?.();
}

function sendToBot(payload) {
  if (!telegram?.sendData) {
    setStatus("Откройте Mini App из кнопки бота, чтобы отправить заявку.", true);
    return false;
  }

  telegram.sendData(JSON.stringify(payload));
  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rubles(value) {
  return Number.isFinite(value) ? `${value} руб.` : "уточняется";
}

function priceFrom(value) {
  return Number.isFinite(value) ? `от ${rubles(value)}` : rubles(value);
}

function formatDuration(minutes) {
  if (!minutes) {
    return "уточняется";
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) {
    return `${rest} мин.`;
  }
  return rest ? `${hours} ч ${rest} мин.` : `${hours} ч`;
}

function allServices() {
  return state.catalog.sections.flatMap((section) =>
    section.services.map((service) => ({ section, service })),
  );
}

function selectedAddons() {
  return state.catalog.addons.filter((addon) => state.addonIds.has(addon.id));
}

function servicePrice() {
  const basePrice = state.option?.price ?? state.service?.price_from;
  if (!Number.isFinite(basePrice)) {
    return null;
  }
  return basePrice + selectedAddons().reduce((sum, addon) => sum + (addon.price || 0), 0);
}

function serviceDuration() {
  const baseDuration = state.option?.duration_minutes ?? state.service?.duration_min ?? 60;
  return baseDuration + selectedAddons().reduce((sum, addon) => sum + (addon.duration_minutes || 0), 0);
}

function resetServiceDetails(service) {
  state.service = service;
  state.genderId = "";
  state.option = null;
  state.addonIds = new Set();
  state.startTime = "";
  if (!service.options?.length) {
    state.option = null;
  }
}

function serviceNeedsGender() {
  return state.service?.id === "own_hair_braids" || state.section?.id === "kanekalon_styles";
}

function showMaleHairLengthNote() {
  return state.genderId === "male" && serviceNeedsGender();
}

function renderCatalog() {
  catalogList.dataset.layout = state.catalogLayout;
  catalogGridBack.hidden = state.catalogLayout === "grid";
  catalogList.innerHTML = allServices()
    .map(({ section, service }) => renderCatalogWindow(section, service))
    .join("");
}

function renderCatalogWindow(section, service) {
  const photos = state.photoManifest[service.id] || [];
  const gallery = photos.length
    ? `
      <div class="catalog-gallery" aria-label="Фото работ: свайпайте в стороны">
        ${photos
          .map(
            (photo, index) => `
              <figure class="catalog-slide">
                <img src="${escapeHtml(photo)}" alt="${escapeHtml(service.name)} ${index + 1}" loading="lazy" />
              </figure>
            `,
          )
          .join("")}
      </div>
      ${photos.length > 1 ? '<small class="catalog-swipe">Свайп фото</small>' : ""}
    `
    : '<span class="catalog-photo-empty" aria-hidden="true"></span>';

  return `
    <article class="catalog-window" data-catalog-window="${escapeHtml(service.id)}">
      <header class="window-bar">
        <strong>${escapeHtml(service.id)}.jpg</strong>
        <span aria-hidden="true">_ [] X</span>
      </header>
      <div class="catalog-card">
        ${gallery}
        <button class="service-item" data-catalog-service="${escapeHtml(service.id)}" type="button">
          <strong>${escapeHtml(service.name)}</strong>
          <small>${escapeHtml(section.name)} | ${priceFrom(service.price_from)}</small>
        </button>
      </div>
    </article>
  `;
}

function renderTrainingPhotos() {
  const photos = state.trainingManifest.photos || [];
  if (!trainingPhotoGallery || !photos.length) {
    return;
  }

  trainingPhotoGallery.innerHTML = photos
    .map(
      (photo, index) => `
        <figure class="training-slot training-photo-slot training-media-slot">
          <img src="${escapeHtml(photo)}" alt="Фото обучения ${index + 1}" loading="lazy" />
        </figure>
      `,
    )
    .join("");
}

function renderTrainingGifs() {
  const gifs = state.trainingManifest.gifs || [];
  if (!trainingGifGallery || !gifs.length) {
    return;
  }

  trainingGifGallery.innerHTML = gifs
    .map(
      (gif, index) => `
        <figure class="training-slot training-gif-slot training-media-slot">
          ${renderTrainingGif(gif, index)}
        </figure>
      `,
    )
    .join("");
}

function renderTrainingGif(gif, index) {
  const path = escapeHtml(gif);
  if (/\.(mp4|webm)$/i.test(gif)) {
    return `
      <video src="${path}" aria-label="GIF обучения ${index + 1}"
        autoplay loop muted playsinline preload="metadata"></video>
    `;
  }

  return `<img src="${path}" alt="GIF обучения ${index + 1}" loading="lazy" />`;
}

function renderTrainingMedia() {
  renderTrainingPhotos();
  renderTrainingGifs();
}

function scrollToCatalogWindow(serviceId) {
  if (!serviceId) {
    return;
  }

  requestAnimationFrame(() => {
    catalogList.querySelector(`[data-catalog-window="${CSS.escape(serviceId)}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function setCatalogLayout(layout, focusServiceId = "") {
  state.catalogLayout = layout === "grid" ? "grid" : "list";
  state.catalogAnchorId = focusServiceId || state.catalogAnchorId;
  if (state.catalog) {
    renderCatalog();
    scrollToCatalogWindow(state.catalogAnchorId);
  }
}

function renderSections() {
  sectionChoices.innerHTML = state.catalog.sections
    .map(
      (section) => `
        <button class="${state.section?.id === section.id ? "is-selected" : ""}"
          data-section="${escapeHtml(section.id)}" type="button">
          ${escapeHtml(section.name)}
        </button>
      `,
    )
    .join("");

  renderServices();
}

function renderServices() {
  if (!state.section) {
    serviceChoices.innerHTML = "";
    return;
  }

  serviceChoices.innerHTML = state.section.services
    .map(
      (service) => `
        <button class="service-item ${state.service?.id === service.id ? "is-selected" : ""}"
          data-service="${escapeHtml(service.id)}" type="button">
          <strong>${escapeHtml(service.name)}</strong>
          <small>${escapeHtml(service.description)}</small>
        </button>
      `,
    )
    .join("");
}

function renderDetails() {
  detailStep.hidden = !state.service;
  scheduleStep.hidden = !state.service;
  contactStep.hidden = !state.service;

  if (!state.service) {
    genderField.hidden = true;
    optionsField.hidden = true;
    optionChoices.innerHTML = "";
    hairLengthNote.hidden = true;
    updateSummary();
    return;
  }

  genderField.hidden = !serviceNeedsGender();
  genderChoices.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.gender === state.genderId);
  });

  optionsField.hidden = !state.service.options?.length;
  optionChoices.innerHTML = (state.service.options || [])
    .map(
      (option) => `
        <button class="${state.option?.id === option.id ? "is-selected" : ""}"
          data-option="${escapeHtml(option.id)}" type="button">
          ${escapeHtml(option.name)} | ${rubles(option.price)}
        </button>
      `,
    )
    .join("");

  hairLengthNote.hidden = !showMaleHairLengthNote();

  addonChoices.innerHTML = state.catalog.addons
    .map(
      (addon) => `
        <label class="addon-item">
          <input data-addon="${escapeHtml(addon.id)}" type="checkbox"
            ${state.addonIds.has(addon.id) ? "checked" : ""} />
          <span>
            ${escapeHtml(addon.name)} | ${rubles(addon.price)}
            <small>${escapeHtml(addon.description)}</small>
          </span>
        </label>
      `,
    )
    .join("");

  renderSlots();
  updateSummary();
}

function todayInputValue() {
  const today = new Date();
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateForBot(value) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}.${month}.${year}` : "";
}

async function fetchAvailableSlots() {
  if (!state.date || !state.service) {
    return [];
  }

  if (state.service.options?.length && !state.option) {
    return [];
  }

  const params = new URLSearchParams({
    date: dateForBot(state.date),
    duration: String(serviceDuration()),
  });
  const response = await fetch(`../api/slots?${params}`);
  if (!response.ok) {
    throw new Error(`Slots HTTP ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload.slots) ? payload.slots : [];
}

async function renderSlots() {
  const selectedDate = state.date;
  const duration = state.service ? serviceDuration() : 0;
  if (!state.date || !state.service) {
    slotChoices.innerHTML = '<p class="empty">Выберите услугу и дату.</p>';
    state.startTime = "";
    updateSummary();
    return;
  }

  if (state.service.options?.length && !state.option) {
    slotChoices.innerHTML = '<p class="empty">Сначала выберите количество брейдов.</p>';
    state.startTime = "";
    updateSummary();
    return;
  }

  slotChoices.innerHTML = '<p class="empty">Проверяю свободное время...</p>';
  let slots = [];
  try {
    slots = await fetchAvailableSlots();
  } catch (error) {
    console.error(error);
    if (selectedDate === state.date && duration === serviceDuration()) {
      slotChoices.innerHTML = '<p class="empty">Не удалось обновить слоты. Попробуйте еще раз.</p>';
      state.startTime = "";
      updateSummary();
    }
    return;
  }

  if (selectedDate !== state.date || duration !== serviceDuration()) {
    return;
  }

  if (!slots.length) {
    slotChoices.innerHTML = '<p class="empty">На эту дату свободных слотов нет.</p>';
    state.startTime = "";
    updateSummary();
    return;
  }

  if (!slots.includes(state.startTime)) {
    state.startTime = "";
  }

  slotChoices.innerHTML = slots
    .map(
      (slot) => `
        <button class="${state.startTime === slot ? "is-selected" : ""}"
          data-slot="${slot}" type="button">
          ${slot}
        </button>
      `,
    )
    .join("");
}

function canSubmit() {
  const serviceReady = state.service
    && (!state.service.options?.length || state.option)
    && (!serviceNeedsGender() || state.genderId);

  return Boolean(
    serviceReady
      && state.date
      && state.startTime
      && clientName.value.trim()
      && clientContact.value.trim(),
  );
}

function updateSummary() {
  submitBooking.disabled = !canSubmit();
  if (!state.service) {
    bookingSummary.innerHTML = "<p>Выберите услугу, чтобы собрать заявку.</p>";
    return;
  }

  const addonText = selectedAddons().map((addon) => addon.name).join(", ") || "без допов";
  const optionText = state.option?.name || "базовый";
  const dateText = dateForBot(state.date) || "дата не выбрана";
  const timeText = state.startTime || "время не выбрано";

  bookingSummary.innerHTML = `
    <p><strong>Услуга</strong>${escapeHtml(state.service.name)} | ${escapeHtml(optionText)}</p>
    <p><strong>Допы</strong>${escapeHtml(addonText)}</p>
    <p><strong>Дата</strong>${escapeHtml(dateText)} ${escapeHtml(timeText)}</p>
    <p><strong>Длительность и цена</strong>${formatDuration(serviceDuration())} | ${rubles(servicePrice())}</p>
  `;
}

function setStatus(message, isError = false) {
  bookingStatus.textContent = message;
  bookingStatus.classList.toggle("is-error", isError);
}

function showCopyToast(message, isError = false) {
  if (!copyToast) {
    return;
  }

  window.clearTimeout(copyToastTimeout);
  copyToast.textContent = message;
  copyToast.hidden = false;
  copyToast.classList.toggle("is-error", isError);
  copyToastTimeout = window.setTimeout(() => {
    copyToast.hidden = true;
  }, 2200);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = value;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.append(fallback);
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}

function findSection(id) {
  return state.catalog.sections.find((section) => section.id === id);
}

function findService(id) {
  return allServices().find(({ service }) => service.id === id);
}

async function loadCatalog() {
  try {
    const [catalogResponse, photoResponse, trainingResponse] = await Promise.all([
      fetch("../data/catalog.json"),
      fetch("./assets/catalog/manifest.json"),
      fetch("./assets/training/manifest.json"),
    ]);
    if (!catalogResponse.ok) {
      throw new Error(`Catalog HTTP ${catalogResponse.status}`);
    }
    state.catalog = await catalogResponse.json();
    state.photoManifest = photoResponse.ok ? await photoResponse.json() : {};
    state.trainingManifest = trainingResponse.ok ? await trainingResponse.json() : {};
    bookingDate.min = todayInputValue();
    renderCatalog();
    renderTrainingMedia();
    renderSections();
    updateSummary();
  } catch (error) {
    console.error(error);
    bookingSummary.innerHTML = "<p>Каталог не загрузился. Откройте Mini App через локальный сервер.</p>";
    setStatus("Нужен static server с доступом к папке data.", true);
  }
}

sectionChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (!button) {
    return;
  }
  state.section = findSection(button.dataset.section);
  state.service = null;
  renderSections();
  renderDetails();
});

serviceChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-service]");
  if (!button) {
    return;
  }
  resetServiceDetails(state.section.services.find((service) => service.id === button.dataset.service));
  renderServices();
  renderDetails();
});

catalogList.addEventListener("click", (event) => {
  const window = event.target.closest("[data-catalog-window]");
  if (state.catalogLayout === "grid" && window) {
    setCatalogLayout("list", window.dataset.catalogWindow);
    return;
  }

  const button = event.target.closest("[data-catalog-service]");
  if (!button) {
    return;
  }
  const match = findService(button.dataset.catalogService);
  state.section = match.section;
  resetServiceDetails(match.service);
  renderSections();
  renderDetails();
  switchView("booking", false);
  requestAnimationFrame(() => {
    serviceChoices.querySelector(".service-item.is-selected")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
});

genderChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-gender]");
  if (!button) {
    return;
  }
  state.genderId = button.dataset.gender;
  renderDetails();
});

optionChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-option]");
  if (!button) {
    return;
  }
  state.option = state.service.options.find((option) => option.id === button.dataset.option);
  renderDetails();
});

addonChoices.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-addon]");
  if (!checkbox) {
    return;
  }
  if (checkbox.checked) {
    state.addonIds.add(checkbox.dataset.addon);
  } else {
    state.addonIds.delete(checkbox.dataset.addon);
  }
  renderDetails();
});

bookingDate.addEventListener("change", () => {
  state.date = bookingDate.value;
  state.startTime = "";
  renderSlots();
  updateSummary();
});

slotChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-slot]");
  if (!button) {
    return;
  }
  state.startTime = button.dataset.slot;
  renderSlots();
  updateSummary();
});

[clientName, clientContact, clientComment].forEach((input) => {
  input.addEventListener("input", updateSummary);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canSubmit()) {
    setStatus("Заполните услугу, дату, время, имя и контакт.", true);
    return;
  }

  const sent = sendToBot({
    action: "create_service_booking",
    data: {
      service_id: state.service.id,
      gender_id: state.genderId,
      option_id: state.option?.id || "",
      addon_ids: [...state.addonIds],
      date: dateForBot(state.date),
      start_time: state.startTime,
      name: clientName.value.trim(),
      contact: clientContact.value.trim(),
      comment: clientComment.value.trim(),
    },
  });

  if (sent) {
    setStatus("Заявка отправляется в бот.");
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

catalogGridBack?.addEventListener("click", () => setCatalogLayout("grid"));

jumps.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.jump));
});

phoneCopy?.addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    await copyText(phoneCopy.dataset.phoneNumber);
    showCopyToast("Номер скопирован в буфер обмена");
  } catch (error) {
    console.error(error);
    showCopyToast("Не удалось скопировать номер", true);
  }
});

describeTelegramRuntime();
switchView("catalog", false);
loadCatalog();
