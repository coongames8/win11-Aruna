import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../../AuthContext";
import { PriceContext } from "../../PriceContext";
import GooglePayButton from "@google-pay/button-react";
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPeriod,
  getPlanName,
  handleUpgrade,
} from "./paymentUtils";
import Swal from "sweetalert2";
import "./Payments.scss";

export default function GooglePayments({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);
  const [processing, setProcessing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("Kenya");
  const [showCountrySelector, setShowCountrySelector] = useState(false);

  const countries = {
    Kenya: { code: "KE", currency: "KES", flag: "🇰🇪" },
    US: { code: "US", currency: "USD", flag: "🇺🇸" },
    UK: { code: "GB", currency: "GBP", flag: "🇬🇧" },
    Nigeria: { code: "NG", currency: "NGN", flag: "🇳🇬" },
  };

  // Subscription plans (shillings for local, dollars would be used for US)
  const subscriptionPlans = SUBSCRIPTION_PLANS.shillings;

  // Initialize price
  useEffect(() => {
    setPrice(subscriptionPlans[0].value);
  }, []);

  const getPriceForCountry = () => {
    // For demo purposes, we're using KES prices
    // In production, you'd convert based on country
    return price;
  };

  const getCurrencyForCountry = () => {
    const country = countries[selectedCountry];
    return country.currency;
  };

  const handleLoadPaymentData = (paymentData) => {
    console.log("Payment data:", paymentData);
    setProcessing(true);

    setTimeout(() => {
      setProcessing(false);
      handleUpgrade(currentUser, price, setUserData);
    }, 2000);
  };

  const handleCancel = (reason) => {
    console.log("Payment cancelled:", reason);
    Swal.fire({
      title: "Payment Cancelled",
      text: "You cancelled the payment process.",
      icon: "info",
      confirmButtonText: "OK",
    });
  };

  const handleError = (error) => {
    console.error("Google Pay error:", error);
    Swal.fire({
      title: "Payment Error",
      text: "Unable to process Google Pay payment. Please try again.",
      icon: "error",
      confirmButtonText: "OK",
    });
  };

  const handlePlanSelect = (planValue) => {
    setPrice(planValue);
  };

  const getPaymentRequest = () => {
    const amountToPay = getPriceForCountry();
    const currency = getCurrencyForCountry();

    return {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [
        {
          type: "CARD",
          parameters: {
            allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
            allowedCardNetworks: [
              "MASTERCARD",
              "VISA",
              "AMEX",
              "DISCOVER",
              "JCB",
            ],
          },
          tokenizationSpecification: {
            type: "PAYMENT_GATEWAY",
            parameters: {
              gateway: "example",
              gatewayMerchantId: "exampleGatewayMerchantId",
            },
          },
        },
      ],
      merchantInfo: {
        merchantId: "12345678901234567890",
        merchantName: "VIP Subscription",
      },
      transactionInfo: {
        totalPriceStatus: "FINAL",
        totalPriceLabel: "Total",
        totalPrice: amountToPay.toFixed(2),
        currencyCode: currency,
        countryCode:
          selectedCountry === "Kenya"
            ? "KE"
            : selectedCountry === "US"
            ? "US"
            : "GB",
      },
    };
  };

  return (
    <div className="google-pay-wrapper">
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
          const currency = getCurrencyForCountry();

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
                {currency} {plan.value}
              </span>
            </label>
          );
        })}
      </div>

      <div className="google-pay">
        <h3>
          GET {getPlanName(price).toUpperCase()} VIP FOR{" "}
          {getCurrencyForCountry()} {getPriceForCountry()}
        </h3>

        {!processing && (
          <GooglePayButton
            environment="TEST"
            buttonColor="black"
            buttonType="subscribe"
            buttonSizeMode="static"
            buttonRadius={8}
            paymentRequest={getPaymentRequest()}
            onLoadPaymentData={handleLoadPaymentData}
            onCancel={handleCancel}
            onError={handleError}
            className="google-pay-btn"
          />
        )}

        {processing && (
          <div className="processing-indicator">
            <i className="fas fa-spinner fa-spin"></i> PROCESSING...
          </div>
        )}
      </div>
    </div>
  );
}
