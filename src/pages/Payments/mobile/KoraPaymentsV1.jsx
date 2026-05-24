import { useContext, useState, useEffect } from "react";
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

export default function KoraPaymentsV1({ setUserData }) {
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
  const [showCountrySelector, setShowCountrySelector] = useState(false);

  const countries = {
    Nigeria: { code: "NG", currency: "NGN", flag: "🇳🇬", rate: 10.63 },
    Kenya: { code: "KE", currency: "KES", flag: "🇰🇪", rate: 1 },
  };

  const priceOptions = {
    Daily: 250,
    Weekly: 850,
    Monthly: 3000,
    Yearly: 8500,
  };

  // Subscription plans
  const subscriptionPlans = [
    { id: "daily", value: 250, label: "Daily VIP", period: "Daily" },
    { id: "weekly", value: 850, label: "7 Days VIP", period: "Weekly" },
    { id: "monthly", value: 3000, label: "30 Days VIP", period: "Monthly" },
    { id: "yearly", value: 8500, label: "1 Year VIP", period: "Yearly" },
  ];

  // Convert prices for Nigeria only
  const convertToNaira = () => {
    setIsLoadingRate(true);
    try {
      const rate = countries.Nigeria.rate;

      setConvertedPrices({
        daily: Math.round(priceOptions.Daily * rate),
        weekly: Math.round(priceOptions.Weekly * rate),
        monthly: Math.round(priceOptions.Monthly * rate),
        yearly: Math.round(priceOptions.Yearly * rate),
      });
    } catch (error) {
      console.error("Error converting to Naira:", error);
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get("reference");

    if (reference && !processing) {
      verifyTransaction(reference);
    }
  }, []);

  const verifyTransaction = async (reference) => {
    setProcessing(true);

    Swal.fire({
      title: "Verifying Payment",
      text: "Please wait...",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      Swal.close();
      await handleUpgrade(currentUser, price, setUserData);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      Swal.close();
      Swal.fire({
        title: "Verification Error",
        text: "Please contact support",
        icon: "error",
        confirmButtonText: "OK",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!currentUser) {
      Swal.fire({
        title: "Login Required",
        text: "Please login first",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    setProcessing(true);

    Swal.fire({
      title: "Initializing Payment",
      text: "Please wait...",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const countryConfig = countries[selectedCountry];
      const amountToPay = Math.round(getCurrentConvertedPrice());
      const reference = `ref-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const currentUrl = window.location.href.split("?")[0];

      const paymentData = {
        amount: amountToPay,
        redirect_url: `${currentUrl}?reference=`,
        currency: countryConfig.currency,
        reference: reference,
        narration: `${getPlanName(price)} VIP Subscription`,
        customer: {
          name: currentUser.email?.split("@")[0] || "Customer",
          email: currentUser.email,
        },
        metadata: {
          plan: getPlanName(price),
          user_id: currentUser.email,
        },
      };

      const response = await fetch(
        "https://api.korapay.com/merchant/api/v1/charges/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer sk_live_yQSLfFWUknmw4TdEKfaBhdqJhTUAN8DTY1p5nozm`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentData),
        }
      );

      const result = await response.json();
      Swal.close();

      if (result.status && result.data?.checkout_url) {
        window.location.href = result.data.checkout_url;
      } else {
        throw new Error(result.message || "Failed to initialize payment");
      }
    } catch (error) {
      setProcessing(false);
      Swal.fire({
        title: "Payment Error",
        text: error.message,
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
          disabled={processing || isLoadingRate}
        >
          {processing ? "PROCESSING..." : "Pay Now"}
        </button>
      </div>
    </div>
  );
}
