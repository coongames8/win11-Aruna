import { useState, useContext, useRef, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Check, CopyAll } from "@mui/icons-material";
import AppHelmet from "../../components/AppHelmet";
import NowPaymentsApi from "@nowpaymentsio/nowpayments-api-js";
import { PaystackButton } from "react-paystack";
import { doc, setDoc } from "firebase/firestore";
import { db, getUser } from "../../firebase";
import "./Payments.scss";
import { AuthContext } from "../../AuthContext";
import { PriceContext } from "../../PriceContext";

const npApi = new NowPaymentsApi({ apiKey: "D7YT1YV-PCAM4ZN-HX9W5M1-H02KFCV" });

// PayPal configuration
const paypalInitialOptions = {
  "client-id": "AXIggvGGvXozbZhdkvizPLd89nVYW8KoyNlHO0gHx7hjY_Ah_IfgXihUQGf7T2HUUVYx-D5SNncM0CtU",
  currency: "USD",
  intent: "capture",
};

// Fixed exchange rate (approximate KSH to USD)
const EXCHANGE_RATE = 150; // 1 USD = 150 KSH

export default function PaymentPage({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext); // price is always in KSH
  const { currentUser } = useContext(AuthContext);
  const [paymentType, setPaymentType] = useState("mpesa");
  const [currenciesArr, setCurrenciesArr] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState("TUSD");
  const addressRef = useRef();
  const [copied, setCopied] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("");
  const [paypalKey, setPaypalKey] = useState(0);

  // Payment methods - Added PayPal
  const paymentMethods = [
    { id: "mpesa", label: "Mobile/Card 📲" },
    { id: "crypto", label: "Crypto ₿" },
    { id: "paypal", label: "PayPal 💳" },
  ];

  // All prices stored in KSH for PriceContext
  const subscriptionPlans = {
    mpesa: [
      { id: "daily", value: 200, label: "Daily VIP", price: "KSH 200" },
      { id: "weekly", value: 700, label: "7 Days VIP", price: "KSH 700" },
      { id: "monthly", value: 2000, label: "30 Days VIP", price: "KSH 2000" },
      { id: "yearly", value: 7500, label: "1 Year VIP", price: "KSH 7500" },
    ],
    crypto: [
      { id: "10", value: 1500, label: "Weekly", price: "$10" }, // 10 USD = 1500 KSH
      { id: "15", value: 2400, label: "Monthly", price: "$16" }, // 16 USD = 2400 KSH
      { id: "50", value: 7500, label: "Yearly", price: "$50" }, // 50 USD = 7500 KSH
    ],
    paypal: [
      { id: "2", value: 300, label: "Daily", price: "$2" },    // 2 USD = 300 KSH
      { id: "10", value: 1500, label: "Weekly", price: "$10" }, // 10 USD = 1500 KSH
      { id: "15", value: 2400, label: "Monthly", price: "$16" }, // 16 USD = 2400 KSH
      { id: "50", value: 7500, label: "Yearly", price: "$50" }, // 50 USD = 7500 KSH
    ],
  };

  // Currency conversion helpers
  const kshToUsd = (ksh) => (ksh / EXCHANGE_RATE).toFixed(2);
  const usdToKsh = (usd) => Math.round(usd * EXCHANGE_RATE);

  // Get current price in USD for PayPal/Crypto
  const getCurrentPriceInUsd = () => {
    return kshToUsd(price);
  };

  // Initialize price based on payment type
  useEffect(() => {
    const defaultPlan = subscriptionPlans[paymentType][0];
    setPrice(defaultPlan.value); // Always set KSH value in context
  }, [paymentType]);

  const getSubscriptionPeriod = () => {
    // Check based on KSH values since that's what's stored in context
    if (price === 200 || price === 300) return "Daily";
    if (price === 700 || price === 1500) return "Weekly";
    if (price === 2000 || price === 2400) return "Monthly";
    return "Yearly";
  };

  const handleUpgrade = async () => {
    try {
      const userDocRef = doc(db, "users", currentUser.email);
      await setDoc(
        userDocRef,
        {
          email: currentUser.email,
          username: currentUser.email,
          isPremium: true,
          subscription: getSubscriptionPeriod(),
          subDate: new Date().toISOString(),
        },
        { merge: true }
      );
      await getUser(currentUser.email, setUserData);
      alert(`You Have Upgraded To ${getSubscriptionPeriod()} VIP`);
      window.location.pathname = "/";
    } catch (error) {
      alert(error.message);
    }
  };

  // Handle payment method change
  const handlePaymentMethodChange = (methodId) => {
    setPaymentType(methodId);
  };

  // PayPal order creation - use USD price
  const createPayPalOrder = (data, actions) => {
    const usdPrice = getCurrentPriceInUsd();
    return actions.order.create({
      purchase_units: [
        {
          amount: {
            value: usdPrice,
            currency_code: "USD",
          },
          description: `${getSubscriptionPeriod()} VIP Subscription`,
        },
      ],
    });
  };

  // PayPal approval handler
  const onPayPalApprove = (data, actions) => {
    return actions.order.capture().then(function (details) {
      console.log("PayPal payment completed:", details);
      handleUpgrade();
    });
  };

  // PayPal error handler
  const onPayPalError = (err) => {
    console.error("PayPal error:", err);
    alert("Payment failed. Please try again.");
  };

  // Paystack config - use KSH price (already in KSH)
  const paystackConfig = {
    reference: new Date().getTime().toString(),
    email: currentUser.email,
    amount: price * 100, // price is already in KSH
    publicKey: "pk_live_523d109eeedcc4dc064b26d444999239146b2981",
    currency: "KES",
    metadata: { name: currentUser.email },
    text: "Pay Now",
    onSuccess: handleUpgrade,
    onClose: () => console.log("Payment closed"),
  };

  // Crypto payment - use USD price
  const getCryptoAddress = async () => {
    const usdPrice = getCurrentPriceInUsd();
    const params = {
      price_amount: parseFloat(usdPrice), // Convert to USD for crypto API
      price_currency: "usd",
      pay_currency: selectedCurrency.toLowerCase(),
    };
    const response = await npApi.createPayment(params);
    setPayAmount(response.pay_amount);
    setPayCurrency(response.pay_currency);
    setAddress(response.pay_address);
    setNetwork(response.network);
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
      const response = await fetch(
        "https://api.nowpayments.io/v1/merchant/coins",
        {
          headers: { "x-api-key": "K80YG02-W464QP0-QR7E9EZ-QFY3ZGQ" },
        }
      );
      const data = await response.json();
      setCurrenciesArr(data.selectedCurrencies);
    };

    fetchCurrencies();
    if (paymentType === "crypto") getCryptoAddress();
  }, [selectedCurrency, price, paymentType]);

  // Force PayPal buttons to re-render when price changes
  useEffect(() => {
    if (paymentType === "paypal") {
      setPaypalKey(prev => prev + 1);
    }
  }, [price, paymentType]);

  // Helper to display price based on payment type
  const getDisplayPrice = () => {
    if (paymentType === "mpesa") {
      return `KSH ${price}`;
    } else {
      return `$${getCurrentPriceInUsd()}`;
    }
  };

  return (
    <PayPalScriptProvider options={paypalInitialOptions}>
      <div className="payment-container">
        <AppHelmet title="Payment" location="/pay" />

        <div className="payment-glass">
          <h2 className="payment-title">Select Payment Method</h2>

          <div className="method-selector">
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className={`method-option ${
                  paymentType === method.id ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={method.id}
                  checked={paymentType === method.id}
                  onChange={() => handlePaymentMethodChange(method.id)}
                />
                {method.label}
              </label>
            ))}
          </div>

          <div className="plan-selector">
            {subscriptionPlans[paymentType].map((plan) => (
              <label
                key={plan.id}
                className={`plan-option ${price === plan.value ? "active" : ""}`}
              >
                <input
                  type="radio"
                  name="subscription-plan"
                  value={plan.value}
                  checked={price === plan.value}
                  onChange={() => setPrice(plan.value)}
                />
                <span className="plan-label">{plan.label}</span>
                <span className="plan-price">{plan.price}</span>
              </label>
            ))}
          </div>

          {paymentType === "crypto" ? (
            <div className="crypto-details">
              <h3>CRYPTO PAYMENT DETAILS</h3>

              <div className="form-group">
                <label>Select Currency:</label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="glass-select"
                >
                  {currenciesArr?.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>

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
            </div>
          ) : paymentType === "mpesa" ? (
            <div className="mpesa-payment">
              <h3>
                GET {getSubscriptionPeriod().toUpperCase()} VIP FOR {getDisplayPrice()}
              </h3>
              <PaystackButton {...paystackConfig} className="paystack-btn" />
            </div>
          ) : (
            <div className="paypal-payment">
              <h3>
                GET {getSubscriptionPeriod().toUpperCase()} VIP FOR {getDisplayPrice()}
              </h3>
              <div className="paypal-buttons-container">
                <PayPalButtons
                  key={paypalKey}
                  style={{
                    layout: "horizontal",
                    color: "gold",
                    shape: "pill",
                    label: "pay"
                  }}
                  createOrder={createPayPalOrder}
                  onApprove={onPayPalApprove}
                  onError={onPayPalError}
                  forceReRender={[price]}
                />
              </div>
              <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '14px', opacity: 0.8 }}>
                Paying: {getDisplayPrice()} for {getSubscriptionPeriod()} VIP
              </p>
            </div>
          )}
        </div>
      </div>
    </PayPalScriptProvider>
  );
}
