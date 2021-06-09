import axios from 'axios';
import { DateTime } from 'luxon';
import { FORECAST_API_BASE_URL } from '../../config/endpoints';
import { FORECAST_API_KEY } from '../../config/keys';
import { DATE_FORMAT } from '../../helpers/calendar';

const forecastAxiosClient = axios.create({
  baseURL: FORECAST_API_BASE_URL,
});

const MAX_DAYS_FOR_FORECAST = 10;

function forecastEmpty() {
  return { errorMessage: null, forecast: null };
}

function forecastError(error) {
  return {
    errorMessage: `An unexpected error ocurred while trying to get forecast data: "${error}".`,
    forecast: null,
  };
}

function forecastSuccess(data) {
  return {
    errorMessage: null,
    forecast: {
      maxTemp: Number(data.maxtemp_f) || null,
      minTemp: Number(data.mintemp_f) || null,
      avgTemp: Number(data.avgtemp_f) || null,
      condition: {
        code: String(data.condition?.code) || null,
        text: String(data.condition?.text) || null,
        icon: String(data.condition?.icon) || null,
      },
    },
  };
}

function getResponseErrorMessage(response) {
  return response.data?.error?.message;
}

function handleApiError(error) {
  if (error.response) {
    return forecastError(getResponseErrorMessage(error.response));
  } else if (error.request) {
    return forecastError(error.request.statusText);
  } else {
    return forecastError(error.message);
  }
}

function handleForecastResponse(response, date) {
  const forecasts = response?.data?.forecast?.forecastday;
  if (!Array.isArray(forecasts)) return forecastEmpty();

  const forecast = forecasts.find((forecast) => forecast?.date === date);
  if (!forecast?.day) return forecastEmpty();

  return forecastSuccess(forecast.day);
}

/**
 * Returns the forecast for the city.
 * If the date is invalid, in the past, or past 10 days from now: the returned value will be `null`.
 * @param {string} city The name of the city to query the forecast for.
 * @param {string} dateString The date string to query the forecast for. Expected format: `yyyy-MM-dd`.
 */
export async function getCityForecastForDate(city, dateString) {
  const dateTime = DateTime.fromFormat(dateString, DATE_FORMAT).startOf('day');
  if (!dateTime.isValid) return forecastEmpty();

  const diff = dateTime.diff(DateTime.local().startOf('day'), 'days').days;
  if (diff > MAX_DAYS_FOR_FORECAST || diff < 0) return forecastEmpty();

  try {
    const response = await forecastAxiosClient.get('forecast.json', {
      params: {
        key: FORECAST_API_KEY,
        q: city,
        days: Math.ceil(diff) + 1,
      },
    });
    return handleForecastResponse(response, dateString);
  } catch (error) {
    return axios.isCancel(error) ? forecastEmpty() : handleApiError(error);
  }
}
