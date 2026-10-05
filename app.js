// ---------- DOM references ----------
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const statusSection = document.getElementById("status-section");
const currentWeatherSection = document.getElementById("current-weather");
const detailsSheet = document.getElementById("details-sheet");
const statsGrid = document.getElementById("stats-grid");
const hourlyStrip = document.getElementById("hourly-strip");
const forecastList = document.getElementById("forecast-list");
const forecastRowTemplate = document.getElementById("forecast-row-template");

// ---------- Weather code lookup ----------
const WEATHER_CODES = {
  0: { description: "Clear sky" }, 1: { description: "Mainly clear" },
  2: { description: "Partly cloudy" }, 3: { description: "Overcast" },
  45: { description: "Fog" }, 48: { description: "Depositing rime fog" },
  51: { description: "Light drizzle" }, 53: { description: "Moderate drizzle" },
  55: { description: "Dense drizzle" }, 61: { description: "Slight rain" },
  63: { description: "Moderate rain" }, 65: { description: "Heavy rain" },
  71: { description: "Slight snow" }, 73: { description: "Moderate snow" },
  75: { description: "Heavy snow" }, 80: { description: "Rain showers" },
  81: { description: "Moderate rain showers" }, 82: { description: "Violent rain showers" },
  95: { description: "Thunderstorm" },
};
function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { description: "Unknown" };
}

// ---------- Condition category + SVG icons (recolored for dark glass) ----------
function getConditionCategory(code) {
  if ([45, 48].includes(code)) return "fog";
  if ([2, 3].includes(code)) return "cloudy";
  if ([51, 53, 55, 61, 63, 65, 80, 81].includes(code)) return "rain";
  if ([82, 95].includes(code)) return "storm";
  if ([71, 73, 75].includes(code)) return "snow";
  return "clear";
}

const ICONS = {
  clear: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="#ffd27a"/><g stroke="#ffd27a" stroke-width="2" stroke-linecap="round"><path d="M16 3v3M16 26v3M3 16h3M26 16h3M7 7l2 2M23 23l2 2M7 25l2-2M23 9l2-2"/></g></svg>`,
  cloudy: `<svg viewBox="0 0 32 32"><circle cx="12" cy="12" r="5" fill="#ffd27a"/><path d="M11 25a5 5 0 010-10 7 7 0 0113.5 1.5A4.2 4.2 0 0124 25z" fill="#fff" opacity=".9"/></svg>`,
  fog: `<svg viewBox="0 0 32 32"><path d="M9 19a5 5 0 010-10 7 7 0 0113.5 1.5A4.2 4.2 0 0122 19z" fill="#fff" opacity=".7"/><g stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".6"><path d="M7 23h18M9 27h14"/></g></svg>`,
  rain: `<svg viewBox="0 0 32 32"><path d="M9 19a5 5 0 010-10 7 7 0 0113.5 1.5A4.2 4.2 0 0122 19z" fill="#e6eef7"/><g stroke="#8fd0ff" stroke-width="2" stroke-linecap="round"><path d="M11 23l-1.5 4M17 23l-1.5 4M23 23l-1.5 4"/></g></svg>`,
  storm: `<svg viewBox="0 0 32 32"><path d="M9 17a5 5 0 010-10 7 7 0 0113.5 1.5A4.2 4.2 0 0122 17z" fill="#cdd6db"/><path d="M17 16l-4 7h4l-3 6 7-8h-4l3-5z" fill="#ffd27a"/></svg>`,
  snow: `<svg viewBox="0 0 32 32"><path d="M9 17a5 5 0 010-10 7 7 0 0113.5 1.5A4.2 4.2 0 0122 17z" fill="#fff" opacity=".9"/><g fill="#fff"><circle cx="11" cy="24" r="1.6"/><circle cx="16" cy="26" r="1.6"/><circle cx="21" cy="24" r="1.6"/></g></svg>`,
};

// ---------- Living weather background (canvas, dark-glass palette) ----------
const weatherSky = document.getElementById("weather-sky");
const weatherCanvas = document.getElementById("weather-canvas");
const weatherFlash = document.getElementById("weather-flash");
const skyCtx = weatherCanvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let canvasW, canvasH;
function resizeWeatherCanvas() {
  canvasW = weatherCanvas.width = window.innerWidth;
  canvasH = weatherCanvas.height = window.innerHeight;
}
resizeWeatherCanvas();
window.addEventListener("resize", resizeWeatherCanvas);

const SKIES = {
  clear: "linear-gradient(180deg,#0d2a4a 0%,#2f6f9a 42%,#e9a35f 82%,#f6d29a 100%)",
  cloudy: "linear-gradient(180deg,#1a2733 0%,#46565f 100%)",
  fog: "linear-gradient(180deg,#2c3338 0%,#596066 100%)",
  rain: "linear-gradient(180deg,#14202b 0%,#2e4350 100%)",
  storm: "linear-gradient(180deg,#0b1218 0%,#202d35 100%)",
  snow: "linear-gradient(180deg,#2b3a4a 0%,#7f93a0 100%)",
};

let weatherCondition = "clear";
let animTime = 0;
let nextFlashIn = 220;

function newRainDrop(){return{x:Math.random()*canvasW,y:Math.random()*canvasH,len:12+Math.random()*14,speed:8+Math.random()*6};}
function newSnowFlake(){return{x:Math.random()*canvasW,y:Math.random()*canvasH,r:1.5+Math.random()*2.2,speed:0.5+Math.random()*1,sway:Math.random()*2};}
function newCloudShape(i){return{x:Math.random()*canvasW,y:40+i*55+Math.random()*30,w:200+Math.random()*220,speed:0.1+Math.random()*0.08};}
function newFogBand(i){return{x:Math.random()*canvasW*2-canvasW,y:canvasH*0.3+i*60,w:450+Math.random()*280,speed:0.12+Math.random()*0.08};}

const rainDrops = Array.from({ length: 180 }, newRainDrop);
const snowFlakes = Array.from({ length: 110 }, newSnowFlake);
const cloudShapes = Array.from({ length: 5 }, (_, i) => newCloudShape(i));
const fogBands = Array.from({ length: 5 }, (_, i) => newFogBand(i));

function drawSun() {
  const cx = canvasW * 0.8, cy = canvasH * 0.18;
  const pulse = 1 + Math.sin(animTime * 0.02) * 0.04;
  const glow = skyCtx.createRadialGradient(cx, cy, 10, cx, cy, 170 * pulse);
  glow.addColorStop(0, "rgba(255,227,163,0.55)");
  glow.addColorStop(1, "rgba(255,227,163,0)");
  skyCtx.fillStyle = glow;
  skyCtx.beginPath(); skyCtx.arc(cx, cy, 170 * pulse, 0, Math.PI * 2); skyCtx.fill();

  skyCtx.save();
  skyCtx.translate(cx, cy);
  skyCtx.rotate(animTime * 0.0012);
  skyCtx.strokeStyle = "rgba(255,227,163,0.3)";
  skyCtx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    skyCtx.save(); skyCtx.rotate((Math.PI * 2 / 16) * i);
    skyCtx.beginPath(); skyCtx.moveTo(60, 0); skyCtx.lineTo(95, 0); skyCtx.stroke();
    skyCtx.restore();
  }
  skyCtx.restore();
  // Note: no solid sun disc drawn here on purpose — the hero icon is the
  // one explicit "sun," this background layer is ambient light only.
}

function drawCloudShape(c) {
  skyCtx.save(); skyCtx.filter = "blur(18px)";
  skyCtx.fillStyle = "rgba(255,255,255,0.16)";
  skyCtx.beginPath();
  skyCtx.ellipse(c.x, c.y, c.w * 0.5, c.w * 0.22, 0, 0, Math.PI * 2);
  skyCtx.ellipse(c.x + c.w * 0.25, c.y - 10, c.w * 0.3, c.w * 0.18, 0, 0, Math.PI * 2);
  skyCtx.fill(); skyCtx.restore();
  c.x += c.speed;
  if (c.x - c.w > canvasW) c.x = -c.w;
}

function drawRainDrops() {
  skyCtx.strokeStyle = "rgba(143,208,255,0.45)";
  skyCtx.lineWidth = 1.4;
  rainDrops.forEach((d) => {
    skyCtx.beginPath(); skyCtx.moveTo(d.x, d.y); skyCtx.lineTo(d.x - 2, d.y + d.len); skyCtx.stroke();
    d.y += d.speed; d.x -= 0.6;
    if (d.y > canvasH) { d.y = -20; d.x = Math.random() * canvasW; }
  });
}

function drawSnowFlakes() {
  skyCtx.fillStyle = "rgba(255,255,255,0.9)";
  snowFlakes.forEach((f) => {
    skyCtx.beginPath(); skyCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2); skyCtx.fill();
    f.y += f.speed; f.x += Math.sin((animTime + f.y) * 0.01) * f.sway * 0.1;
    if (f.y > canvasH) { f.y = -10; f.x = Math.random() * canvasW; }
  });
}

function drawFogBands() {
  fogBands.forEach((f) => {
    skyCtx.save(); skyCtx.filter = "blur(30px)";
    skyCtx.fillStyle = "rgba(255,255,255,0.14)";
    skyCtx.beginPath(); skyCtx.ellipse(f.x, f.y, f.w, 70, 0, 0, Math.PI * 2); skyCtx.fill();
    skyCtx.restore();
    f.x += f.speed;
    if (f.x - f.w > canvasW) f.x = -f.w;
  });
}

function weatherLoop() {
  animTime++;
  skyCtx.clearRect(0, 0, canvasW, canvasH);

  if (weatherCondition === "clear") drawSun();
  if (weatherCondition === "cloudy") cloudShapes.forEach(drawCloudShape);
  if (weatherCondition === "rain") { cloudShapes.forEach(drawCloudShape); drawRainDrops(); }
  if (weatherCondition === "storm") {
    cloudShapes.forEach(drawCloudShape); drawRainDrops();
    nextFlashIn--;
    if (nextFlashIn <= 0) {
      weatherFlash.style.transition = "none"; weatherFlash.style.opacity = "0.35";
      requestAnimationFrame(() => {
        weatherFlash.style.transition = "opacity 0.4s ease"; weatherFlash.style.opacity = "0";
      });
      nextFlashIn = 200 + Math.random() * 260;
    }
  }
  if (weatherCondition === "snow") { cloudShapes.forEach(drawCloudShape); drawSnowFlakes(); }
  if (weatherCondition === "fog") drawFogBands();

  if (!reduceMotion) requestAnimationFrame(weatherLoop);
}

function setWeatherEffect(category) {
  weatherCondition = category;
  weatherSky.style.background = SKIES[category] || SKIES.clear;
}

setWeatherEffect("clear");
weatherLoop();

// ---------- API service functions ----------
async function geocodeCity(cityName) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Geocoding service failed. Please try again.");
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`Couldn't find a place called "${cityName}". Check the spelling.`);
  }
  const place = data.results[0];
  return { latitude: place.latitude, longitude: place.longitude, name: place.name, country: place.country };
}

async function getForecast(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
    `&timezone=auto&forecast_days=6`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Forecast service failed. Please try again.");
  return await response.json();
}

// ---------- UI state helpers ----------
function showLoading() {
  statusSection.textContent = "Loading weather data...";
  statusSection.classList.remove("error");
  currentWeatherSection.hidden = true;
  detailsSheet.hidden = true;
}
function showError(message) {
  statusSection.textContent = message;
  statusSection.classList.add("error");
  currentWeatherSection.hidden = true;
  detailsSheet.hidden = true;
}
function clearStatus() {
  statusSection.textContent = "";
  statusSection.classList.remove("error");
}

// ---------- Count-up number animation ----------
function animateNumber(el, to) {
  const from = parseFloat(el.textContent) || 0;
  const start = performance.now();
  const duration = 800;
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  if (reduceMotion) { el.textContent = to; } else { requestAnimationFrame(step); }
}

// ---------- Render functions ----------
function renderCurrentWeather(place, data) {
  const current = data.current;
  const weather = getWeatherInfo(current.weather_code);
  const category = getConditionCategory(current.weather_code);
  setWeatherEffect(category);

  const dateLabel = new Date(current.time).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const timeLabel = new Date(current.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const unit = currentUnit;
  const countryLabel = place.country ? `, ${place.country}` : "";
  const tempValue = toCelsiusOrFahrenheit(current.temperature_2m, unit);

  currentWeatherSection.innerHTML = `
    <div class="cw-now" id="cw-now">
      <p class="cw-city">${place.name}${countryLabel}</p>
      <p class="cw-date">${dateLabel} · ${timeLabel}</p>
      <div class="cw-temp-row"><span id="cw-temp-number">0</span><sup>°${unit}</sup></div>
      <div class="cw-cond">${weather.description}</div>
    </div>
    <div class="cw-orb" id="cw-orb">
      <div class="cw-orb-glow"></div>
      ${ICONS[category]}
    </div>
  `;

  animateNumber(document.getElementById("cw-temp-number"), tempValue);
  setupHeroTilt();
}

function renderStats(data) {
  const current = data.current;
  const today = 0;
  const unit = currentUnit;

  const sunrise = new Date(data.daily.sunrise[today]);
  const sunset = new Date(data.daily.sunset[today]);
  const now = new Date(current.time);
  let dayProgress = ((now - sunrise) / (sunset - sunrise)) * 100;
  dayProgress = Math.max(0, Math.min(100, dayProgress));

  statsGrid.innerHTML = `
    <div class="stat">
      <small>Feels like</small>
      <b>${toCelsiusOrFahrenheit(current.apparent_temperature, unit)}°${unit}</b>
      <em>${current.apparent_temperature > current.temperature_2m ? "Feels warmer" : "Feels cooler"}</em>
    </div>
    <div class="stat">
      <small>Humidity</small>
      <b>${current.relative_humidity_2m}%</b>
      <div class="bar"><span data-w="${current.relative_humidity_2m}"></span></div>
    </div>
    <div class="stat">
      <small>Wind</small>
      <b>${speedLabel(current.wind_speed_10m, unit)}</b>
      <em>Live wind speed</em>
    </div>
    <div class="stat">
      <small>Sunset</small>
      <b>${sunset.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</b>
      <div class="bar"><span data-w="${dayProgress}"></span></div>
    </div>
  `;

  requestAnimationFrame(() => {
    setTimeout(() => {
      statsGrid.querySelectorAll(".bar span").forEach((s) => { s.style.width = s.dataset.w + "%"; });
    }, 80);
  });
}

function renderHourly(data) {
  const times = data.hourly.time;
  const temps = data.hourly.temperature_2m;
  const codes = data.hourly.weather_code;
  const currentTime = data.current.time;

  let startIndex = times.findIndex((t) => new Date(t) >= new Date(currentTime));
  if (startIndex === -1) startIndex = 0;
  const hours = times.slice(startIndex, startIndex + 8);

  hourlyStrip.innerHTML = hours.map((time, i) => {
    const actualIndex = startIndex + i;
    const label = i === 0 ? "Now" : new Date(time).toLocaleTimeString("en-US", { hour: "numeric" });
    const category = getConditionCategory(codes[actualIndex]);
    const temp = toCelsiusOrFahrenheit(temps[actualIndex], currentUnit);
    return `<div class="h ${i === 0 ? "on" : ""}">${label}${ICONS[category]}<b>${temp}°</b></div>`;
  }).join("");
}

function renderForecast(data) {
  forecastList.innerHTML = "";

  const days = data.daily.time;
  const codes = data.daily.weather_code;
  const maxTemps = data.daily.temperature_2m_max;
  const minTemps = data.daily.temperature_2m_min;

  // Scale range bars against the actual min/max across the upcoming days,
  // so the bars always reflect real relative spread, never guessed values.
  const upcomingMax = maxTemps.slice(1);
  const upcomingMin = minTemps.slice(1);
  const overallMin = Math.min(...upcomingMin);
  const overallMax = Math.max(...upcomingMax);
  const span = overallMax - overallMin || 1;

  for (let i = 1; i < days.length; i++) {
    const row = forecastRowTemplate.content.cloneNode(true);
    const dayName = new Date(days[i]).toLocaleDateString("en-US", { weekday: "short" });
    const category = getConditionCategory(codes[i]);
    const lo = toCelsiusOrFahrenheit(minTemps[i], currentUnit);
    const hi = toCelsiusOrFahrenheit(maxTemps[i], currentUnit);

    const leftPct = ((minTemps[i] - overallMin) / span) * 100;
    const widthPct = ((maxTemps[i] - minTemps[i]) / span) * 100;

    row.querySelector(".d-day").textContent = dayName;
    row.querySelector(".d-icon").innerHTML = ICONS[category];
    row.querySelector(".lo").textContent = `${lo}°`;
    row.querySelector(".hi").textContent = `${hi}°`;
    const bar = row.querySelector(".range i");
    bar.style.left = `${leftPct}%`;
    bar.style.width = `${Math.max(widthPct, 6)}%`;

    forecastList.appendChild(row);
  }
}

// ---------- 3D hero tilt (pointer-driven, skipped under reduced motion) ----------
function setupHeroTilt() {
  if (reduceMotion) return;
  const hero = currentWeatherSection;
  const now = document.getElementById("cw-now");
  const orb = document.getElementById("cw-orb");
  if (!now || !orb) return;

  hero.onpointermove = (e) => {
    const b = hero.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5;
    const y = (e.clientY - b.top) / b.height - 0.5;
    now.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 6}deg)`;
    orb.style.transform = `translate(${x * -18}px, ${y * -14}px)`;
  };
  hero.onpointerleave = () => {
    now.style.transform = "";
    orb.style.transform = "";
  };
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
    renderStats(forecastData);
    renderHourly(forecastData);
    renderForecast(forecastData);

    currentWeatherSection.hidden = false;
    detailsSheet.hidden = false;
  } catch (error) {
    showError(error.message);
  }
}

// ---------- Event listeners ----------
searchForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const cityName = cityInput.value.trim();
  if (cityName === "") { showError("Please enter a city name."); return; }
  handleSearch(cityName);
});

// ---------- Unit toggle (segmented control) ----------
let currentUnit = "C";
let lastPlace = null;
let lastForecastData = null;

const unitCButton = document.getElementById("unit-c");
const unitFButton = document.getElementById("unit-f");

function toCelsiusOrFahrenheit(celsius, unit) {
  return unit === "F" ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius);
}
function speedLabel(kmh, unit) {
  return unit === "F" ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`;
}

function setUnit(unit) {
  currentUnit = unit;
  unitCButton.setAttribute("aria-pressed", unit === "C");
  unitFButton.setAttribute("aria-pressed", unit === "F");
  if (lastPlace && lastForecastData) {
    renderCurrentWeather(lastPlace, lastForecastData);
    renderStats(lastForecastData);
    renderHourly(lastForecastData);
    renderForecast(lastForecastData);
  }
}
unitCButton.addEventListener("click", () => setUnit("C"));
unitFButton.addEventListener("click", () => setUnit("F"));

// ---------- Recent searches (localStorage) ----------
const RECENT_KEY = "weatherDashboard.recentCities";
const recentSearchesContainer = document.getElementById("recent-searches");

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function saveRecentSearch(cityName) {
  let recent = getRecentSearches().filter((c) => c.toLowerCase() !== cityName.toLowerCase());
  recent.unshift(cityName);
  recent = recent.slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  renderRecentSearches();
}
function removeRecentSearch(cityName) {
  const recent = getRecentSearches().filter((c) => c.toLowerCase() !== cityName.toLowerCase());
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
  if (recent.length === 0) return;

  const label = document.createElement("span");
  label.className = "recent-label";
  label.textContent = "Recent:";
  recentSearchesContainer.appendChild(label);

  recent.forEach((city) => {
    const chip = document.createElement("span");
    chip.className = "recent-chip";
    const chipText = document.createElement("button");
    chipText.type = "button"; chipText.className = "recent-chip-text"; chipText.textContent = city;
    chipText.addEventListener("click", () => handleSearch(city));
    const removeBtn = document.createElement("button");
    removeBtn.type = "button"; removeBtn.className = "recent-chip-remove"; removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Remove ${city}`);
    removeBtn.addEventListener("click", (e) => { e.stopPropagation(); removeRecentSearch(city); });
    chip.appendChild(chipText); chip.appendChild(removeBtn);
    recentSearchesContainer.appendChild(chip);
  });

  const clearAllBtn = document.createElement("button");
  clearAllBtn.type = "button"; clearAllBtn.className = "recent-clear-all"; clearAllBtn.textContent = "Clear all";
  clearAllBtn.addEventListener("click", clearAllRecentSearches);
  recentSearchesContainer.appendChild(clearAllBtn);
}
renderRecentSearches();

// ---------- Geolocation ----------
const geoButton = document.getElementById("geo-button");
geoButton.addEventListener("click", () => {
  if (!navigator.geolocation) { showError("Geolocation isn't supported by your browser."); return; }
  showLoading();
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const forecastData = await getForecast(latitude, longitude);
        const place = { name: "Your Location", country: "" };
        lastPlace = place; lastForecastData = forecastData;
        clearStatus();
        renderCurrentWeather(place, forecastData);
        renderStats(forecastData);
        renderHourly(forecastData);
        renderForecast(forecastData);
        currentWeatherSection.hidden = false;
        detailsSheet.hidden = false;
      } catch (error) { showError(error.message); }
    },
    () => showError("Couldn't access your location. Please allow location access or search manually.")
  );
});