import { useState, useContext, useRef, useEffect } from "react";
import { Check, CopyAll } from "@mui/icons-material";
import NowPaymentsApi from "@nowpaymentsio/nowpayments-api-js";
import { AuthContext } from "../../AuthContext";
import { PriceContext } from "../../PriceContext";
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPeriod,
  getPlanName,
  handleUpgrade,
} from "./paymentUtils";
import Swal from "sweetalert2";
import "./Payments.scss";

const npApi = new NowPaymentsApi({ apiKey: "D7YT1YV-PCAM4ZN-HX9W5M1-H02KFCV" });

export default function CryptoPayments({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);
  const [currenciesArr, setCurrenciesArr] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState("TUSD");
  const addressRef = useRef();
  const [copied, setCopied] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("");
  const [paymentId, setPaymentId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef(null);

  // Crypto subscription plans (dollars)
  const subscriptionPlans = SUBSCRIPTION_PLANS.dollars;

  // Initialize price
  useEffect(() => {
    setPrice(subscriptionPlans[0].value);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const getCryptoAddress = async () => {
    setIsGenerating(true);

    try {
      const params = {
        price_amount: parseFloat(price),
        price_currency: "usd",
        pay_currency: selectedCurrency.toLowerCase(),
        order_id: `VIP-${getPlanName(price)}-${Date.now()}`,
        order_description: `${getPlanName(price)} VIP Subscription`,
      };

      const response = await npApi.createPayment(params);

      setPayAmount(response.pay_amount);
      setPayCurrency(response.pay_currency);
      setAddress(response.pay_address);
      setNetwork(response.network);
      setPaymentId(response.payment_id);

      Swal.fire({
        title: "Address Generated!",
        text: "Crypto payment address has been generated. Please send the exact amount to the address shown.",
        icon: "success",
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error generating address:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to generate payment address. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentId) return;

    try {
      const response = await fetch(
        `https://api.nowpayments.io/v1/payment/${paymentId}`,
        {
          headers: {
            "x-api-key": "D7YT1YV-PCAM4ZN-HX9W5M1-H02KFCV",
          },
        }
      );

      const data = await response.json();
      console.log("Payment status:", data);

      const status = data.payment_status;

      if (
        status === "finished" ||
        status === "confirmed" ||
        status === "sending"
      ) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPolling(false);

        Swal.fire({
          title: "Payment Successful! 🎉",
          html: `
            <div style="text-align: center;">
              <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981;"></i>
              <h3 style="margin: 15px 0;">$${price} Paid</h3>
              <p>Your VIP subscription payment was successful!</p>
            </div>
          `,
          icon: "success",
          confirmButtonText: "Activate Subscription",
        }).then(() => {
          handleUpgrade(currentUser, price, setUserData);
        });
        return true;
      } else if (
        status === "failed" ||
        status === "refunded" ||
        status === "expired"
      ) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPolling(false);

        Swal.fire({
          title: "Payment Failed",
          text: "Your payment was not successful. Please try again.",
          icon: "error",
          confirmButtonText: "Generate New Address",
        }).then(() => {
          setAddress("");
          setPaymentId(null);
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error("Error checking payment status:", error);
      return false;
    }
  };

  const startPolling = () => {
    if (!paymentId) {
      Swal.fire({
        title: "No Active Payment",
        text: "Please generate a payment address first.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    setIsPolling(true);

    Swal.fire({
      title: "Monitoring Payment",
      html: `
        <div style="text-align: center;">
          <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #667eea;"></i>
          <h3 style="margin: 15px 0;">Waiting for Payment</h3>
          <p>We are monitoring the blockchain for your payment.</p>
          <p style="font-size: 0.85rem; color: #666;">This will automatically update when payment is detected.</p>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "Stop Monitoring",
      didOpen: () => {
        pollingIntervalRef.current = setInterval(async () => {
          const completed = await checkPaymentStatus();
          if (completed) {
            Swal.close();
          }
        }, 10000);

        setTimeout(() => {
          checkPaymentStatus();
        }, 2000);
      },
      willClose: () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPolling(false);
      },
    });
  };

  const handleCopy = (e) => {
    e.preventDefault();
    addressRef.current.select();
    document.execCommand("copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const response = await fetch(
          "https://api.nowpayments.io/v1/merchant/coins",
          {
            headers: { "x-api-key": "K80YG02-W464QP0-QR7E9EZ-QFY3ZGQ" },
          }
        );
        const data = await response.json();
        setCurrenciesArr(data.selectedCurrencies);
      } catch (error) {
        console.error("Error fetching currencies:", error);
      }
    };

    fetchCurrencies();
  }, []);

  const handlePlanSelect = (planValue) => {
    setPrice(planValue);
    setAddress("");
    setPaymentId(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  const handleCurrencyChange = (currency) => {
    setSelectedCurrency(currency);
    setAddress("");
    setPaymentId(null);
  };

  return (
    <div className="crypto-payment-wrapper">
      <div className="plan-selector">
        {subscriptionPlans.map((plan) => (
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
            <span className="plan-price">{plan.price}</span>
          </label>
        ))}
      </div>

      <div className="crypto-details">
        <h3>CRYPTO PAYMENT DETAILS</h3>

        <div className="form-group">
          <label>Select Currency:</label>
          <select
            value={selectedCurrency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="glass-select"
          >
            {currenciesArr?.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        {address ? (
          <>
            <div className="payment-info">
              <p>
                Amount:{" "}
                <span>
                  {payAmount} {payCurrency?.toUpperCase()}
                </span>
              </p>
              <p>
                Network: <span>{network?.toUpperCase()}</span>
              </p>
              <p>
                Address: <span>{address}</span>
              </p>
            </div>

            <div className="address-copy">
              <input
                type="text"
                value={address || ""}
                readOnly
                ref={addressRef}
                className="glass-input"
              />
              <button onClick={handleCopy} className="copy-btn">
                {copied ? (
                  <Check className="icon" />
                ) : (
                  <CopyAll className="icon" />
                )}
              </button>
            </div>

            <div className="crypto-actions">
              <button
                className="generate-address-btn"
                onClick={getCryptoAddress}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate New Address"}
              </button>

              {!isPolling && (
                <button className="check-status-btn" onClick={startPolling}>
                  Check Payment Status
                </button>
              )}
            </div>

            {isPolling && (
              <div className="polling-indicator">
                <i className="fas fa-spinner fa-spin"></i> Monitoring payment
                status...
              </div>
            )}
          </>
        ) : (
          <button
            className="generate-address-btn full-width"
            onClick={getCryptoAddress}
            disabled={isGenerating}
          >
            {isGenerating
              ? "Generating Address..."
              : "Generate Payment Address"}
          </button>
        )}
      </div>
    </div>
  );
}
