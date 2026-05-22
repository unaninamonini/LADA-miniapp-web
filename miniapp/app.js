const telegram = window.Telegram?.WebApp;
const tabs = document.querySelectorAll("[data-view]");
const panels = document.querySelectorAll("[data-panel]");
const runtimeMode = document.querySelector("#runtime-mode");
const telegramUser = document.querySelector("#telegram-user");
const telegramTheme = document.querySelector("#telegram-theme");
const readyButton = document.querySelector("#ready-button");
const form = document.querySelector("#booking-form");
const bookingDate = document.querySelector("#booking-date");
const sectionChoices = document.querySelector("#section-choices");
const serviceChoices = document.querySelector("#service-choices");
const detailStep = document.querySelector("#detail-step");
const genderField = document.querySelector("#gender-field");
const genderChoices = document.querySelector("#gender-choices");
const optionsField = document.querySelector("#options-field");
const optionChoices = document.querySelector("#option-choices");
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

const state = {
  catalog: null,
  section: null,
  service: null,
  genderId: "",
  option: null,
  addonIds: new Set(),
  date: "",
  startTime: "",
};

function switchView(view) {
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === view));
}

function describeTelegramRuntime() {
  if (!telegram) {
    return;
  }

  const user = telegram.initDataUnsafe?.user;

  telegram.ready();
  telegram.expand();

  runtimeMode.textContent = `Telegram ${telegram.platform || "client"}`;
  telegramUser.textContent = user
    ? [user.first_name, user.last_name, user.username && `@${user.username}`]
        .filter(Boolean)
        .join(" ")
    : "Откроется внутри Telegram";
  telegramTheme.textContent = telegram.colorScheme || "telegram";
}

function sendReadySignal() {
  sendToBot({ action: "miniapp_ready", sent_at: new Date().toISOString() });
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

function renderCatalog() {
  catalogList.innerHTML = allServices()
    .map(
      ({ section, service }) => `
        <button class="service-item" data-catalog-service="${escapeHtml(service.id)}" type="button">
          <strong>${escapeHtml(service.name)}</strong>
          <small>${escapeHtml(section.name)} | ${rubles(service.price_from)}</small>
        </button>
      `,
    )
    .join("");
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
    updateSummary();
    return;
  }

  genderField.hidden = state.service.id !== "own_hair_braids";
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

function availableSlots() {
  if (!state.date || !state.service) {
    return [];
  }

  const slots = [];
  const selectedDate = new Date(`${state.date}T00:00:00`);
  const now = new Date();

  for (let total = 10 * 60; total <= 19 * 60 + 30; total += 30) {
    const slotDate = new Date(selectedDate);
    slotDate.setHours(Math.floor(total / 60), total % 60, 0, 0);
    if (slotDate > now) {
      slots.push(`${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`);
    }
  }

  return slots;
}

function renderSlots() {
  const slots = availableSlots();
  if (!slots.length) {
    slotChoices.innerHTML = '<p class="empty">Выберите будущую дату.</p>';
    state.startTime = "";
    updateSummary();
    return;
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
    && (state.service.id !== "own_hair_braids" || state.genderId);

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

function findSection(id) {
  return state.catalog.sections.find((section) => section.id === id);
}

function findService(id) {
  return allServices().find(({ service }) => service.id === id);
}

async function loadCatalog() {
  try {
    const response = await fetch("../data/catalog.json");
    if (!response.ok) {
      throw new Error(`Catalog HTTP ${response.status}`);
    }
    state.catalog = await response.json();
    bookingDate.min = todayInputValue();
    renderCatalog();
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
  const button = event.target.closest("[data-catalog-service]");
  if (!button) {
    return;
  }
  const match = findService(button.dataset.catalogService);
  state.section = match.section;
  resetServiceDetails(match.service);
  renderSections();
  renderDetails();
  switchView("booking");
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

readyButton.addEventListener("click", sendReadySignal);
describeTelegramRuntime();
loadCatalog();
