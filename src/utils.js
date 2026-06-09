/**
 * Detects user's country from IP address and returns currency information
 * @returns {Promise<Object>} Country and currency details
 */
export async function detectUserCountry() {
    try {
      // Multiple fallback APIs for reliability
      const apis = [
        'https://ipapi.co/json/',
        'https://ipwho.is/',
        'https://api.ipify.org?format=json',
      ];
  
      let countryData = null;
  
      // Try primary API first
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          countryData = {
            country: data.country_name,
            country_code: data.country_code,
            currency: data.currency,
            currency_name: data.currency_name,
            phone: data.country_calling_code,
          };
        }
      } catch (e) {
        console.log('ipapi.co failed, trying fallback...');
      }
  
      // Fallback to secondary API if primary fails
      if (!countryData) {
        try {
          const response = await fetch('https://ipwho.is/');
          if (response.ok) {
            const data = await response.json();
            countryData = {
              country: data.country,
              country_code: data.country_code,
              currency: data.currency,
              currency_name: data.currency_code,
              phone: `+${data.calling_code}`,
            };
          }
        } catch (e) {
          console.log('ipwho.is failed');
        }
      }
  
      // Default to Kenya if detection fails
      if (!countryData || !countryData.country_code) {
        return {
          country: 'Kenya',
          country_code: 'KE',
          currency: 'KES',
          currency_symbol: 'KSh',
          currency_name: 'Kenyan Shilling',
          phone_prefix: '+254',
          flag: '🇰🇪',
          exchange_rate: 1,
        };
      }
  
      // Country to currency mapping with symbols and exchange rates
      const currencyMap = {
        // Africa
        KE: {
          code: 'KES',
          symbol: 'KSh',
          name: 'Kenyan Shilling',
          flag: '🇰🇪',
          rate: 1,
          phone: '+254',
        },
        NG: {
          code: 'NGN',
          symbol: '₦',
          name: 'Nigerian Naira',
          flag: '🇳🇬',
          rate: 10.63,
          phone: '+234',
        },
        ZA: {
          code: 'ZAR',
          symbol: 'R',
          name: 'South African Rand',
          flag: '🇿🇦',
          rate: 0.22,
          phone: '+27',
        },
        GH: {
          code: 'GHS',
          symbol: '₵',
          name: 'Ghanaian Cedi',
          flag: '🇬🇭',
          rate: 0.06,
          phone: '+233',
        },
        UG: {
          code: 'UGX',
          symbol: 'USh',
          name: 'Ugandan Shilling',
          flag: '🇺🇬',
          rate: 1.5,
          phone: '+256',
        },
        TZ: {
          code: 'TZS',
          symbol: 'TSh',
          name: 'Tanzanian Shilling',
          flag: '🇹🇿',
          rate: 1.15,
          phone: '+255',
        },
        EG: {
          code: 'EGP',
          symbol: 'E£',
          name: 'Egyptian Pound',
          flag: '🇪🇬',
          rate: 0.12,
          phone: '+20',
        },
        MA: {
          code: 'MAD',
          symbol: 'DH',
          name: 'Moroccan Dirham',
          flag: '🇲🇦',
          rate: 0.08,
          phone: '+212',
        },
  
        // Americas
        US: {
          code: 'USD',
          symbol: '$',
          name: 'US Dollar',
          flag: '🇺🇸',
          rate: 0.0077,
          phone: '+1',
        },
        CA: {
          code: 'CAD',
          symbol: 'C$',
          name: 'Canadian Dollar',
          flag: '🇨🇦',
          rate: 0.0105,
          phone: '+1',
        },
        BR: {
          code: 'BRL',
          symbol: 'R$',
          name: 'Brazilian Real',
          flag: '🇧🇷',
          rate: 0.042,
          phone: '+55',
        },
        MX: {
          code: 'MXN',
          symbol: '$',
          name: 'Mexican Peso',
          flag: '🇲🇽',
          rate: 0.14,
          phone: '+52',
        },
  
        // Europe
        GB: {
          code: 'GBP',
          symbol: '£',
          name: 'British Pound',
          flag: '🇬🇧',
          rate: 0.006,
          phone: '+44',
        },
        FR: {
          code: 'EUR',
          symbol: '€',
          name: 'Euro',
          flag: '🇪🇺',
          rate: 0.0071,
          phone: '+33',
        },
        DE: {
          code: 'EUR',
          symbol: '€',
          name: 'Euro',
          flag: '🇪🇺',
          rate: 0.0071,
          phone: '+49',
        },
        IT: {
          code: 'EUR',
          symbol: '€',
          name: 'Euro',
          flag: '🇪🇺',
          rate: 0.0071,
          phone: '+39',
        },
        ES: {
          code: 'EUR',
          symbol: '€',
          name: 'Euro',
          flag: '🇪🇺',
          rate: 0.0071,
          phone: '+34',
        },
  
        // Asia
        IN: {
          code: 'INR',
          symbol: '₹',
          name: 'Indian Rupee',
          flag: '🇮🇳',
          rate: 0.65,
          phone: '+91',
        },
        CN: {
          code: 'CNY',
          symbol: '¥',
          name: 'Chinese Yuan',
          flag: '🇨🇳',
          rate: 0.056,
          phone: '+86',
        },
        JP: {
          code: 'JPY',
          symbol: '¥',
          name: 'Japanese Yen',
          flag: '🇯🇵',
          rate: 1.18,
          phone: '+81',
        },
        AE: {
          code: 'AED',
          symbol: 'د.إ',
          name: 'UAE Dirham',
          flag: '🇦🇪',
          rate: 0.028,
          phone: '+971',
        },
        SA: {
          code: 'SAR',
          symbol: '﷼',
          name: 'Saudi Riyal',
          flag: '🇸🇦',
          rate: 0.029,
          phone: '+966',
        },
  
        // Oceania
        AU: {
          code: 'AUD',
          symbol: 'A$',
          name: 'Australian Dollar',
          flag: '🇦🇺',
          rate: 0.012,
          phone: '+61',
        },
        NZ: {
          code: 'NZD',
          symbol: 'NZ$',
          name: 'New Zealand Dollar',
          flag: '🇳🇿',
          rate: 0.013,
          phone: '+64',
        },
      };
  
      const countryCode = countryData.country_code;
      const currencyInfo = currencyMap[countryCode] || currencyMap['KE']; // Default to Kenya
  
      return {
        country: countryData.country,
        country_code: countryCode,
        currency: currencyInfo.code,
        currency_symbol: currencyInfo.symbol,
        currency_name: currencyInfo.name,
        phone_prefix: currencyInfo.phone,
        flag: currencyInfo.flag,
        exchange_rate: currencyInfo.rate,
      };
    } catch (error) {
      console.error('Country detection error:', error);
      // Return default Kenya info
      return {
        country: 'Kenya',
        country_code: 'KE',
        currency: 'KES',
        currency_symbol: 'KSh',
        currency_name: 'Kenyan Shilling',
        phone_prefix: '+254',
        flag: '🇰🇪',
        exchange_rate: 1,
      };
    }
  }
  
  /**
   * Format amount based on detected currency
   * @param {number} amount - Amount to format
   * @param {string} currencyCode - Currency code (KES, NGN, USD, etc.)
   * @param {string} symbol - Currency symbol
   * @returns {string} Formatted amount with currency
   */
  function formatCurrency(amount, currencyCode, symbol) {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  
    if (currencyCode === 'KES') {
      return `${symbol} ${formatter.format(amount)}`;
    } else if (currencyCode === 'NGN') {
      return `${symbol}${formatter.format(amount)}`;
    }
    return `${symbol}${formatter.format(amount)}`;
  }
  
  /**
   * Convert amount between currencies based on exchange rates
   * @param {number} amount - Amount in base currency (KES)
   * @param {string} targetCurrency - Target currency code
   * @returns {number} Converted amount
   */
  function convertCurrency(amount, targetCurrency) {
    const rates = {
      KES: 1,
      NGN: 10.63,
      ZAR: 0.22,
      GHS: 0.06,
      UGX: 1.5,
      TZS: 1.15,
      USD: 0.0077,
      GBP: 0.006,
      EUR: 0.0071,
      INR: 0.65,
      CAD: 0.0105,
      AUD: 0.012,
    };
  
    const rate = rates[targetCurrency] || rates.KES;
    return Math.round(amount * rate);
  }
  
  // Example usage:
  async function initCurrency() {
    const userCurrency = await detectUserCountry();
    console.log('User Country:', userCurrency.country);
    console.log('Currency:', userCurrency.currency);
    console.log('Symbol:', userCurrency.currency_symbol);
    console.log('Code:', userCurrency.currency);
    console.log('Exchange Rate:', userCurrency.exchange_rate);
  
    // Format a loan amount
    const loanAmount = 5000; // KES
    const convertedAmount = convertCurrency(loanAmount, userCurrency.currency);
    const formattedAmount = formatCurrency(
      convertedAmount,
      userCurrency.currency,
      userCurrency.currency_symbol
    );
  
    console.log(`Loan in ${userCurrency.currency}: ${formattedAmount}`);
  
    return userCurrency;
  }
  
  // At the end of script.js, attach to window object
  window.detectUserCountry = detectUserCountry;
  window.formatCurrency = formatCurrency;
  window.convertCurrency = convertCurrency;
  window.initCurrency = initCurrency;
  
  // Auto-execute on load
  (async function () {
    window.userCurrency = await detectUserCountry();
    console.log('Currency detected:', window.userCurrency);
  })();
  