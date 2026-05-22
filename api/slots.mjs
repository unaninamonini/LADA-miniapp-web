const LOCAL_TIME_ZONE = "Asia/Ho_Chi_Minh";
const CLOSED_STATUSES = new Set(["rejected", "cancelled", "conflict"]);

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function datePartsInLocalTime(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LOCAL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }
  const text = String(value);
  if (!text.includes("T")) {
    return text;
  }
  const parts = datePartsInLocalTime(new Date(text));
  return `${parts.day}.${parts.month}.${parts.year}`;
}

function normalizeTime(value) {
  if (!value) {
    return "";
  }
  const text = String(value);
  if (!text.includes("T")) {
    return text.slice(0, 5);
  }
  const date = new Date(text);
  const parts = datePartsInLocalTime(date);
  return `${parts.hour}:${parts.minute}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlaps(startMinutes, endMinutes, booking) {
  const bookingStart = timeToMinutes(normalizeTime(booking.start_time));
  const bookingEnd = timeToMinutes(normalizeTime(booking.end_time));
  return Number.isFinite(bookingStart)
    && Number.isFinite(bookingEnd)
    && startMinutes < bookingEnd
    && endMinutes > bookingStart;
}

function localNow() {
  const parts = datePartsInLocalTime(new Date());
  return {
    date: `${parts.day}.${parts.month}.${parts.year}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

async function fetchBookings(date) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const apiKey = process.env.SCRIPT_API_KEY;
  if (!scriptUrl || !apiKey) {
    throw new Error("Slots API env is missing");
  }

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "get_bookings");
  url.searchParams.set("date", date);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Apps Script HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data?.ok === false) {
    throw new Error("Apps Script rejected slots request");
  }
  return Array.isArray(data.bookings) ? data.bookings : [];
}

export default async function handler(request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";
  const duration = Number(url.searchParams.get("duration"));
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
    return json({ error: "Invalid date" }, 400);
  }
  if (!Number.isInteger(duration) || duration < 30 || duration > 12 * 60) {
    return json({ error: "Invalid duration" }, 400);
  }

  try {
    const bookings = (await fetchBookings(date)).filter(
      (booking) =>
        normalizeDate(booking.booking_date) === date
        && !CLOSED_STATUSES.has(String(booking.status || "").toLowerCase()),
    );
    const now = localNow();
    const slots = [];

    for (let start = 10 * 60; start <= 19 * 60 + 30; start += 30) {
      if (date === now.date && start <= now.minutes) {
        continue;
      }
      const end = start + duration;
      if (bookings.some((booking) => overlaps(start, end, booking))) {
        continue;
      }
      slots.push(`${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`);
    }

    return json({ date, duration, slots });
  } catch (error) {
    console.error(error);
    return json({ error: "Slots unavailable" }, 503);
  }
}
