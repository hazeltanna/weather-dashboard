// ---------- DOM references ----------
// Grab every element we'll need to read from or write to, once, at the top.
// Avoids repeating document.getElementById(...) everywhere.
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const statusSection = document.getElementById("status-section");
const currentWeatherSection = document.getElementById("current-weather");
const forecastSection = document.getElementById("forecast");
const forecastGrid = document.getElementById("forecast-grid");
const forecastCardTemplate = document.getElementById("forecast-card-template");
const hourlyStrip = document.getElementById("hourly-strip");

// ---------- Weather code lookup ----------
// Open-Meteo doesn't return "Sunny" or "Rain" as text. It returns a number
// (the WMO weather code) and WE decide what that number means for display.
// This object is a lookup table: give it a code, get back a description + icon.
const WEATHER_CODES = {
  0: { description: "Clear sky", icon: "☀️" },
  1: { description: "Mainly clear", icon: "🌤️" },
  2: { description: "Partly cloudy", icon: "⛅" },
  3: { description: "Overcast", icon: "☁️" },
  45: { description: "Fog", icon: "🌫️" },
  48: { description: "Depositing rime fog", icon: "🌫️" },
  51: { description: "Light drizzle", icon: "🌦️" },
  53: { description: "Moderate drizzle", icon: "🌦️" },
  55: { description: "Dense drizzle", icon: "🌧️" },
  61: { description: "Slight rain", icon: "🌧️" },
  63: { description: "Moderate rain", icon: "🌧️" },
  65: { description: "Heavy rain", icon: "🌧️" },
  71: { description: "Slight snow", icon: "🌨️" },
  73: { description: "Moderate snow", icon: "🌨️" },
  75: { description: "Heavy snow", icon: "❄️" },
  80: { description: "Rain showers", icon: "🌦️" },
  81: { description: "Moderate rain showers", icon: "🌧️" },
  82: { description: "Violent rain showers", icon: "⛈️" },
  95: { description: "Thunderstorm", icon: "⛈️" },
};

// Fallback used if we ever get a code not in the table above —
// prevents the app from crashing or showing "undefined" to the user.
function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { description: "Unknown", icon: "❓" };
}

// ---------- Condition category + SVG icons ----------
// One shared function decides "clear / cloudy / rain / storm / snow" from
// a weather code. Both the background effect AND the icons use this same
// categorization, so they always agree with each other.
function getConditionCategory(code) {
  if ([2, 3, 45, 48].includes(code)) return "cloudy";
  if ([51, 53, 55, 61, 63, 65, 80, 81].includes(code)) return "rain";
  if ([82, 95].includes(code)) return "storm";
  if ([71, 73, 75].includes(code)) return "snow";
  return "clear";
}

const ICONS = {
  clear: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="5" fill="#C7872E"/>
    <g stroke="#C7872E" stroke-width="2" stroke-linecap="round">
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
    </g>
  </svg>`,
  cloudy: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.8A3.5 3.5 0 0117 18H7z" fill="#DCD2C0" stroke="#6B6255" stroke-width="1"/>
  </svg>`,
  rain: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 14a4 4 0 010-8 5.5 5.5 0 0110.6 1.8A3.5 3.5 0 0117 14H7z" fill="#B9C9CB"/>
    <g stroke="#2F5D62" stroke-width="2" stroke-linecap="round">
      <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>
    </g>
  </svg>`,
  storm: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 12a4 4 0 010-8 5.5 5.5 0 0110.6 1.8A3.5 3.5 0 0117 12H7z" fill="#9FB0B2"/>
    <path d="M13 13l-3 5h3l-2 4 5-6h-3l2-3z" fill="#C7872E"/>
  </svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 13a4 4 0 010-8 5.5 5.5 0 0110.6 1.8A3.5 3.5 0 0117 13H7z" fill="#E7ECEF"/>
    <g fill="#6B6255">
      <circle cx="8" cy="19" r="1.3"/><circle cx="12" cy="20.5" r="1.3"/><circle cx="16" cy="19" r="1.3"/>
    </g>
  </svg>`,
};

// ---------- API service functions ----------

// Step 1: turn a city name into latitude/longitude.
// Open-Meteo's forecast API needs coordinates, not a city name — so this
// is a required first step before we can ask for weather at all.
async function geocodeCity(cityName) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Geocoding service failed. Please try again.");
  }

  const data = await response.json();

  // If the city doesn't exist, Open-Meteo returns an empty/missing results array
  // instead of an error status — so WE have to check for that ourselves.
  if (!data.results || data.results.length === 0) {
    throw new Error(`Couldn't find a place called "${cityName}". Check the spelling.`);
  }

  const place = data.results[0];
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    name: place.name,
    country: place.country,
  };
}

// Step 2: given coordinates, get the actual current + 5-day forecast data.
async function getForecast(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=6`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Forecast service failed. Please try again.");
  }

  return await response.json();
}

// ---------- UI state helpers ----------

function showLoading() {
  statusSection.textContent = "Loading weather data...";
  statusSection.classList.remove("error");
  currentWeatherSection.hidden = true;
  forecastSection.hidden = true;
}

function showError(message) {
  statusSection.textContent = message;
  statusSection.classList.add("error");
  currentWeatherSection.hidden = true;
  forecastSection.hidden = true;
}

function clearStatus() {
  statusSection.textContent = "";
  statusSection.classList.remove("error");
}

// ---------- Render functions ----------

function renderCurrentWeather(place, data) {
  const current = data.current;
  const weather = getWeatherInfo(current.weather_code);

  setWeatherBackground(current.weather_code);

  const dateLabel = new Date(current.time).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const unit = currentUnit;
  const countryLabel = place.country ? `, ${place.country}` : "";

  const iconCategory = getConditionCategory(current.weather_code);

  currentWeatherSection.innerHTML = `
    <div class="cw-main">
      <span class="cw-icon">${ICONS[iconCategory]}</span>
      <div>
        <p class="cw-city">${place.name}${countryLabel}</p>
        <p class="cw-date">${dateLabel} · ${weather.description}</p>
        <p class="cw-temp">${toCelsiusOrFahrenheit(current.temperature_2m, unit)}°${unit}</p>
      </div>
    </div>
    <div class="cw-metrics">
      <div>
        <p class="cw-metric-label">Feels like</p>
        <p class="cw-metric-value">${toCelsiusOrFahrenheit(current.apparent_temperature, unit)}°${unit}</p>
      </div>
      <div>
        <p class="cw-metric-label">Humidity</p>
        <p class="cw-metric-value">${current.relative_humidity_2m}%</p>
      </div>
      <div>
        <p class="cw-metric-label">Wind</p>
        <p class="cw-metric-value">${speedLabel(current.wind_speed_10m, unit)}</p>
      </div>
    </div>
  `;
}

function renderForecast(data) {
  // Clear out any cards from a previous search before adding new ones —
  // otherwise a second search would just keep appending more cards forever.
  forecastGrid.innerHTML = "";

  const days = data.daily.time;
  const codes = data.daily.weather_code;
  const maxTemps = data.daily.temperature_2m_max;
  const minTemps = data.daily.temperature_2m_min;

  // Start at index 1, not 0 — index 0 is today, and the brief asks for the
  // UPCOMING 5 days. We requested 6 days total from the API specifically
  // so we'd have 5 left over after skipping today.
  for (let i = 1; i < days.length; i++) {
    // Clone the <template> we defined in the HTML. "true" means deep clone —
    // copy the template's inner elements too, not just the empty wrapper.
    const card = forecastCardTemplate.content.cloneNode(true);

    const dayName = new Date(days[i]).toLocaleDateString("en-US", { weekday: "short" });
    const category = getConditionCategory(codes[i]);

    // querySelector finds an element inside this cloned fragment by its class,
    // same idea as getElementById but matching a CSS selector instead.
    card.querySelector(".forecast-day").textContent = dayName;
    card.querySelector(".forecast-icon").innerHTML = ICONS[category];
    card.querySelector(".forecast-temp").textContent =
      `${toCelsiusOrFahrenheit(maxTemps[i], currentUnit)}° / ${toCelsiusOrFahrenheit(minTemps[i], currentUnit)}°`;

    forecastGrid.appendChild(card);
  }
}

// ---------- Main orchestration ----------

async function handleSearch(cityName) {
  showLoading();

  try {
    const place = await geocodeCity(cityName);
    const forecastData = await getForecast(place.latitude, place.longitude);

    clearStatus();
    lastPlace = place;
    lastForecastData = forecastData;
    saveRecentSearch(place.name);
    renderCurrentWeather(place, forecastData);
    renderForecast(forecastData);

    currentWeatherSection.hidden = false;
    forecastSection.hidden = false;
  } catch (error) {
    showError(error.message);
  }
}

// ---------- Event listeners ----------

searchForm.addEventListener("submit", function (event) {
  event.preventDefault(); // stops the browser's default "reload the page" form behavior

  const cityName = cityInput.value.trim();

  if (cityName === "") {
    showError("Please enter a city name.");
    return;
  }

  handleSearch(cityName);
});

// ---------- Bonus: animated weather background ----------

function setWeatherBackground(code) {
  document.body.className = document.body.className
    .split(" ")
    .filter((c) => !c.startsWith("weather-"))
    .join(" ");

  let condition = "clear";
  if ([2, 3, 45, 48].includes(code)) condition = "cloudy";
  else if ([51, 53, 55, 61, 63, 65, 80, 81].includes(code)) condition = "rain";
  else if ([82, 95].includes(code)) condition = "storm";
  else if ([71, 73, 75].includes(code)) condition = "snow";

  document.body.classList.add(`weather-${condition}`);
}

// ---------- Bonus: unit toggle (C/F) ----------

let currentUnit = "C";
let lastPlace = null;
let lastForecastData = null;

const unitToggleButton = document.getElementById("unit-toggle");

function toCelsiusOrFahrenheit(celsius, unit) {
  return unit === "F" ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius);
}

function speedLabel(kmh, unit) {
  return unit === "F"
    ? `${Math.round(kmh * 0.621371)} mph`
    : `${Math.round(kmh)} km/h`;
}

unitToggleButton.addEventListener("click", () => {
  currentUnit = currentUnit === "C" ? "F" : "C";
  unitToggleButton.textContent = currentUnit === "C" ? "Switch to °F" : "Switch to °C";

  if (lastPlace && lastForecastData) {
    renderCurrentWeather(lastPlace, lastForecastData);
    renderForecast(lastForecastData);
  }
});

// ---------- Bonus: recent searches (localStorage) ----------

const RECENT_KEY = "weatherDashboard.recentCities";
const recentSearchesContainer = document.getElementById("recent-searches");

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecentSearch(cityName) {
  let recent = getRecentSearches().filter(
    (c) => c.toLowerCase() !== cityName.toLowerCase()
  );
  recent.unshift(cityName);
  recent = recent.slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  renderRecentSearches();
}

function removeRecentSearch(cityName) {
  const recent = getRecentSearches().filter(
    (c) => c.toLowerCase() !== cityName.toLowerCase()
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  renderRecentSearches();
}

function clearAllRecentSearches() {
  localStorage.removeItem(RECENT_KEY);
  renderRecentSearches();
}

function renderRecentSearches() {
  const recent = getRecentSearches();
  recentSearchesContainer.innerHTML = "";

  if (recent.length === 0) return; // nothing to show yet, leave the area empty

  const label = document.createElement("span");
  label.className = "recent-label";
  label.textContent = "Recent searches:";
  recentSearchesContainer.appendChild(label);

  recent.forEach((city) => {
    const chip = document.createElement("span");
    chip.className = "recent-chip";

    const chipText = document.createElement("button");
    chipText.type = "button";
    chipText.className = "recent-chip-text";
    chipText.textContent = city;
    chipText.addEventListener("click", () => handleSearch(city));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "recent-chip-remove";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${city} from recent searches`);
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation(); // prevents this click from also triggering a search
      removeRecentSearch(city);
    });

    chip.appendChild(chipText);
    chip.appendChild(removeBtn);
    recentSearchesContainer.appendChild(chip);
  });

  const clearAllBtn = document.createElement("button");
  clearAllBtn.type = "button";
  clearAllBtn.className = "recent-clear-all";
  clearAllBtn.textContent = "Clear all";
  clearAllBtn.addEventListener("click", clearAllRecentSearches);
  recentSearchesContainer.appendChild(clearAllBtn);
}

renderRecentSearches();

// ---------- Bonus: geolocation ----------

const geoButton = document.getElementById("geo-button");

geoButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showError("Geolocation isn't supported by your browser.");
    return;
  }

  showLoading();

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const forecastData = await getForecast(latitude, longitude);
        const place = { name: "Your Location", country: "" };

        lastPlace = place;
        lastForecastData = forecastData;

        clearStatus();
        renderCurrentWeather(place, forecastData);
        renderForecast(forecastData);
        currentWeatherSection.hidden = false;
        forecastSection.hidden = false;
      } catch (error) {
        showError(error.message);
      }
    },
    () => {
      showError("Couldn't access your location. Please allow location access or search manually.");
    }
  );
});