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