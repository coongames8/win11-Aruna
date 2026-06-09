// hooks/useCurrency.js
import { useState, useEffect } from 'react';

// Currency mapping with symbols and exchange rates
const currencyMap = {
  KE: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', flag: '🇰🇪', rate: 1, phone: '+254' },
  NG: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬', rate: 10.63, phone: '+234' },
  ZA: { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: '🇿🇦', rate: 0.22, phone: '+27' },
  GH: { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', flag: '🇬🇭', rate: 0.06, phone: '+233' },
  UG: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', flag: '🇺🇬', rate: 1.5, phone: '+256' },
  TZ: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', flag: '🇹🇿', rate: 1.15, phone: '+255' },
  US: { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', rate: 0.0077, phone: '+1' },
  GB: { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', rate: 0.006, phone: '+44' },
  EU: { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', rate: 0.0071, phone: '+33' },
};

const DEFAULT_COUNTRY = {
  country: 'Kenya',
  country_code: 'KE',
  currency: 'KES',
  currency_symbol: 'KSh',
  currency_name: 'Kenyan Shilling',
  phone_prefix: '+254',
  flag: '🇰🇪',
  exchange_rate: 1,
};

export async function detectUserCountry() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      const countryCode = data.country_code;
      const currencyInfo = currencyMap[countryCode] || currencyMap['KE'];
      
      return {
        country: data.country_name,
        country_code: countryCode,
        currency: currencyInfo.code,
        currency_symbol: currencyInfo.symbol,
        currency_name: currencyInfo.name,
        phone_prefix: currencyInfo.phone,
        flag: currencyInfo.flag,
        exchange_rate: currencyInfo.rate,
      };
    }
    return DEFAULT_COUNTRY;
  } catch (error) {
    console.error('Country detection error:', error);
    return DEFAULT_COUNTRY;
  }
}

export function formatCurrency(amount, currencyCode, symbol) {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatter.format(amount)}`;
}

export function convertCurrency(amount, targetCurrency) {
  const rates = {
    KES: 1, NGN: 10.63, ZAR: 0.22, GHS: 0.06,
    UGX: 1.5, TZS: 1.15, USD: 0.0077, GBP: 0.006, EUR: 0.0071,
  };
  const rate = rates[targetCurrency] || rates.KES;
  return Math.round(amount * rate);
}

// React Hook
export function useCurrency() {
  const [currency, setCurrency] = useState(DEFAULT_COUNTRY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadCurrency() {
      try {
        setLoading(true);
        const userCurrency = await detectUserCountry();
        setCurrency(userCurrency);
      } catch (err) {
        setError(err.message);
        setCurrency(DEFAULT_COUNTRY);
      } finally {
        setLoading(false);
      }
    }
    loadCurrency();
  }, []);

  const formatAmount = (amountInKES) => {
    const converted = convertCurrency(amountInKES, currency.currency);
    return formatCurrency(converted, currency.currency, currency.currency_symbol);
  };

  return { currency, loading, error, formatAmount };
}