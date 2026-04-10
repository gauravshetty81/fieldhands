import type { Weather } from '../api'

// WMO weather code → description + emoji
function describeWeather(code: number | null): { label: string; emoji: string } {
  if (code === null) return { label: 'Unknown', emoji: '🌡' }
  if (code === 0)              return { label: 'Clear sky', emoji: '☀️' }
  if (code <= 2)               return { label: 'Partly cloudy', emoji: '⛅' }
  if (code === 3)              return { label: 'Overcast', emoji: '☁️' }
  if (code <= 49)              return { label: 'Fog / Mist', emoji: '🌫️' }
  if (code <= 59)              return { label: 'Drizzle', emoji: '🌦️' }
  if (code <= 69)              return { label: 'Rain', emoji: '🌧️' }
  if (code <= 79)              return { label: 'Snow', emoji: '❄️' }
  if (code <= 82)              return { label: 'Rain showers', emoji: '🌧️' }
  if (code <= 99)              return { label: 'Thunderstorm', emoji: '⛈️' }
  return { label: 'Weather', emoji: '🌡' }
}

export default function WeatherWidget({ weather }: { weather: Weather | null }) {
  if (!weather) {
    return (
      <div className="bg-green-800 text-white rounded-xl p-4 text-sm text-green-300">
        Weather unavailable
      </div>
    )
  }

  const { label, emoji } = describeWeather(weather.weather_code)

  return (
    <div className="bg-gradient-to-br from-green-700 to-green-900 text-white rounded-xl p-4">
      <p className="text-xs text-green-300 mb-1">Udupi, Karnataka</p>
      <div className="flex items-center gap-3">
        <span className="text-4xl">{emoji}</span>
        <div>
          <p className="text-2xl font-bold">
            {weather.temperature_c !== null ? `${Math.round(weather.temperature_c)}°C` : '—'}
          </p>
          <p className="text-sm text-green-200">{label}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-green-200">
        <div>
          <p className="text-green-400">Humidity</p>
          <p>{weather.humidity_pct !== null ? `${weather.humidity_pct}%` : '—'}</p>
        </div>
        <div>
          <p className="text-green-400">Rain</p>
          <p>{weather.precipitation_mm !== null ? `${weather.precipitation_mm} mm` : '—'}</p>
        </div>
        <div>
          <p className="text-green-400">Wind</p>
          <p>{weather.wind_speed_kmh !== null ? `${Math.round(weather.wind_speed_kmh)} km/h` : '—'}</p>
        </div>
      </div>
    </div>
  )
}
