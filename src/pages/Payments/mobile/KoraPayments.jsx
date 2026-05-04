import { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../../../AuthContext";
import { PriceContext } from "../../../PriceContext";
import {
  SUBSCRIPTION_PLANS, 
  getSubscriptionPeriod,
  getPlanName,
  handleUpgrade,
} from "../paymentUtils";
import Swal from "sweetalert2";
import "../Payments.scss";

export default function KoraPayments({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);
  const [processing, setProcessing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("Kenya");
  const [convertedPrices, setConvertedPrices] = useState({
    daily: 250,
    weekly: 850,
    monthly: 3000,
    yearly: 8500,
  });
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [userCountry, setUserCountry] = useState(null);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [koraLoaded, setKoraLoaded] = useState(false);
  const scriptLoadedRef = useRef(false);

  // Country configurations
  const countries = {
    Nigeria: { code: "NG", currency: "NGN", flag: "🇳🇬", rate: 10.63 },
    Kenya: { code: "KE", currency: "KES", flag: "🇰🇪", rate: 1 },
  };

  // Price options in KES (base currency)
  const priceOptions = {
    Daily: 250,
    Weekly: 850,
    Monthly: 3000,
    Yearly: 8500,
  };

  // Subscription plans
  const subscriptionPlans = [
    {
      id: "daily",
      value: 250,
      label: "Daily VIP",
      price: "KSH 250",
      period: "Daily",
    },
    {
      id: "weekly",
      value: 850,
      label: "7 Days VIP",
      price: "KSH 850",
      period: "Weekly",
    },
    {
      id: "monthly",
      value: 3000,
      label: "30 Days VIP",
      price: "KSH 3000",
      period: "Monthly",
    },
    {
      id: "yearly",
      value: 8500,
      label: "1 Year VIP",
      price: "KSH 8500",
      period: "Yearly",
    },
  ];

  // Load Kora script
  useEffect(() => {
    if (scriptLoadedRef.current) return;

    const script = document.createElement("script");
    script.src =
      "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
    script.async = true;

    script.onload = () => {
      console.log("Kora script loaded");
      scriptLoadedRef.current = true;
      setTimeout(() => {
        if (window.Korapay) {
          setKoraLoaded(true);
          console.log("Korapay initialized");
        }
      }, 500);
    };

    script.onerror = (err) => {
      console.error("Failed to load Kora script:", err);
    };

    document.head.appendChild(script);
  }, []);

  // Detect user's country using IP geolocation
  const detectUserCountry = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      if (response.ok) {
        const data = await response.json();
        const countryCode = data.country_code;

        const matchedCountry = Object.entries(countries).find(
          ([_, config]) => config.code === countryCode
        );

        if (matchedCountry) {
          setSelectedCountry(matchedCountry[0]);
          setUserCountry(matchedCountry[0]);
          return;
        }
      }

      setSelectedCountry("Kenya");
      setUserCountry("Kenya");
    } catch (error) {
      console.error("Error detecting country:", error);
      setSelectedCountry("Kenya");
      setUserCountry("Kenya");
    }
  };

  // Convert prices for Nigeria only
  const convertToNaira = async () => {
    setIsLoadingRate(true);
    try {
      // Fixed conversion rate for NGN (10.63 NGN = 1 KES)
      const rate = countries.Nigeria.rate;

      setConvertedPrices({
        daily: Math.round(priceOptions.Daily * rate),
        weekly: Math.round(priceOptions.Weekly * rate),
        monthly: Math.round(priceOptions.Monthly * rate),
        yearly: Math.round(priceOptions.Yearly * rate),
      });
    } catch (error) {
      console.error("Error converting to Naira:", error);
      // Fallback conversion
      const fallbackRate = 10.63;
      setConvertedPrices({
        daily: Math.round(priceOptions.Daily * fallbackRate),
        weekly: Math.round(priceOptions.Weekly * fallbackRate),
        monthly: Math.round(priceOptions.Monthly * fallbackRate),
        yearly: Math.round(priceOptions.Yearly * fallbackRate),
      });
    } finally {
      setIsLoadingRate(false);
    }
  };

  // Reset to KES prices
  const resetToKesPrices = () => {
    setConvertedPrices({
      daily: priceOptions.Daily,
      weekly: priceOptions.Weekly,
      monthly: priceOptions.Monthly,
      yearly: priceOptions.Yearly,
    });
  };

  // Update prices when country changes
  useEffect(() => {
    if (selectedCountry === "Nigeria") {
      convertToNaira();
    } else {
      resetToKesPrices();
    }
  }, [selectedCountry]);

  // Detect user country on component mount
  useEffect(() => {
    detectUserCountry();
  }, []);

  const getCurrentConvertedPrice = () => {
    const period = getSubscriptionPeriod(price).toLowerCase();
    return convertedPrices[period] || price;
  };

  const getCurrencySymbol = () => {
    if (selectedCountry === "Nigeria") {
      return "₦";
    }
    return "KSH";
  };

  const handlePayment = () => {
    if (!currentUser) {
      Swal.fire({
        title: "Login Required",
        text: "Please login first to continue with payment",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    if (!koraLoaded || !window.Korapay) {
      Swal.fire({
        title: "Loading Payment Gateway",
        text: "Please wait, payment gateway is initializing...",
        icon: "info",
        confirmButtonText: "OK",
      });
      return;
    }

    setProcessing(true);

    const countryConfig = countries[selectedCountry];
    const amountToPay = Math.round(getCurrentConvertedPrice());
    const reference = `ref-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const paymentOptions = {
      key: "pk_live_KxNb5jDg18CQtJWzJt1RdgyMNsRo4D9NanrmE7nP",
      reference: reference,
      amount: amountToPay,
      currency: countryConfig.currency,
      customer: {
        name: currentUser.email?.split("@")[0] || "Customer",
        email: currentUser.email,
      },
      narration: `${getPlanName(price)} VIP Subscription`,
      onClose: () => {
        console.log("Payment modal closed");
        setProcessing(false);
      },
      onSuccess: (data) => {
        console.log("Payment successful:", data);
        setProcessing(false);
        handleUpgrade(currentUser, price, setUserData);
      },
      onFailed: (data) => {
        console.error("Payment failed:", data);
        setProcessing(false);
        Swal.fire({
          title: "Payment Failed",
          text: data?.message || "Please try again.",
          icon: "error",
          confirmButtonText: "OK",
        });
      },
    };

    try {
      window.Korapay.initialize(paymentOptions);
    } catch (error) {
      console.error("Kora payment error:", error);
      setProcessing(false);
      Swal.fire({
        title: "Payment Error",
        text:
          error.message || "Unable to initialize payment. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  const handlePlanSelect = (planValue) => {
    setPrice(planValue);
  };

  return (
    <div className="kora-payment-wrapper">
      {/* Country Selection Section */}
      <div className="country-selector">
        <div
          className="selected-country"
          onClick={() => setShowCountrySelector(!showCountrySelector)}
        >
          <span className="flag">{countries[selectedCountry].flag}</span>
          <span className="country-name">{selectedCountry}</span>
          <span className="dropdown-arrow">
            {showCountrySelector ? "▲" : "▼"}
          </span>
        </div>

        {showCountrySelector && (
          <div className="country-dropdown">
            {Object.entries(countries).map(([country, config]) => (
              <div
                key={country}
                className={`country-option ${
                  selectedCountry === country ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedCountry(country);
                  setShowCountrySelector(false);
                }}
              >
                <span className="flag">{config.flag}</span>
                <span className="country-name">{country}</span>
                <span className="currency">{config.currency}</span>
              </div>
            ))}
          </div>
        )}

        {userCountry && userCountry !== selectedCountry && (
          <div className="detected-country">
            🔍 Detected: {userCountry}
            <button onClick={() => setSelectedCountry(userCountry)}>
              Use detected
            </button>
          </div>
        )}
      </div>

      <div className="plan-selector">
        {subscriptionPlans.map((plan) => {
          const convertedPrice = convertedPrices[plan.id] || plan.value;
          const currency = getCurrencySymbol();

          return (
            <label
              key={plan.id}
              className={`plan-option ${price === plan.value ? "active" : ""}`}
            >
              <input
                type="radio"
                name="subscription-plan"
                value={plan.value}
                checked={price === plan.value}
                onChange={() => handlePlanSelect(plan.value)}
              />
              <span className="plan-label">{plan.label}</span>
              <span className="plan-price">
                {isLoadingRate
                  ? "Loading..."
                  : `${currency} ${Math.round(convertedPrice)}`}
              </span>
            </label>
          );
        })}
      </div>

      <div className="kora-payment">
        <h3>
          GET {getPlanName(price).toUpperCase()} VIP FOR{" "}
          {isLoadingRate
            ? "Loading..."
            : `${getCurrencySymbol()} ${Math.round(
                getCurrentConvertedPrice()
              )}`}
        </h3>

        <button
          onClick={handlePayment}
          className="confirm-payment-btn"
          disabled={processing || isLoadingRate || !koraLoaded}
        >
          {processing ? (
            <span>
              <i className="fas fa-spinner fa-spin"></i> PROCESSING...
            </span>
          ) : !koraLoaded ? (
            <span>
              <i className="fas fa-spinner fa-spin"></i> LOADING GATEWAY...
            </span>
          ) : (
            <span>
              <i className="fas fa-credit-card"></i> Pay Now
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
