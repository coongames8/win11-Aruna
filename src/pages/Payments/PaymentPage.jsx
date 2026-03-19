import { useState, useContext, useRef, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Check, CopyAll } from "@mui/icons-material";
import AppHelmet from "../../components/AppHelmet";
import NowPaymentsApi from "@nowpaymentsio/nowpayments-api-js";
import { doc, setDoc } from "firebase/firestore";
import { db, getUser } from "../../firebase";
import "./Payments.scss";
import { AuthContext } from "../../AuthContext";
import { PriceContext } from "../../PriceContext";
import Swal from "sweetalert2";

const npApi = new NowPaymentsApi({ apiKey: "D7YT1YV-PCAM4ZN-HX9W5M1-H02KFCV" });

// PayPal configuration
const paypalInitialOptions = {
  "client-id": "AXIggvGGvXozbZhdkvizPLd89nVYW8KoyNlHO0gHx7hjY_Ah_IfgXihUQGf7T2HUUVYx-D5SNncM0CtU",
  currency: "USD",
  intent: "capture",
};

// PayHero configuration
const PAYHERO_API_BASE = 'https://backend.payhero.co.ke/api/v2';
const PAYHERO_AUTH_TOKEN = 'Basic bnhvR1cxSVZqMFVoVVNHMmtTc3A6czFmcFF0NFRJa0lreFowYXZVWjdkRDRkdHJKeUtRaUxldjdoVVZVTw==';//'cmxZdTh4dGtTUG1EZVZTa1JXZDQ6UndETHdMcmd4Z3lVRmtKYXlzS09UNjNYS1Bvemh0T0xXZ09IOGgwOA==';
const CHANNEL_ID = 3123; // Your channel ID

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

  // Format phone number to handle various input formats
  const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters
    let p = phone.toString().replace(/\D/g, "");
    
    // Handle different formats
    if (p.startsWith("0")) {
      return p; // Return as 07XXXXXXXX
    }
    if (p.startsWith("7") || p.startsWith("1")) {
      return "0" + p; // Add leading 0
    }
    if (p.startsWith("254")) {
      return "0" + p.substring(3); // Convert 2547... to 07...
    }
    if (p.startsWith("2541")) {
      return "0" + p.substring(3); // Convert 2541... to 01...
    }
    return p;
  };

  // Poll transaction status
  const pollTransactionStatus = (reference) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 5 seconds = 2.5 minutes max
    let pollInterval;

    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        Swal.fire({
          title: "Payment Timeout",
          html: "⏰ Payment monitoring timeout. Please check your transaction history.",
          icon: "warning",
          confirmButtonText: "OK",
        });
        return;
      }

      attempts++;

      try {
        // Check transaction status with PayHero
        const response = await fetch(
          `${PAYHERO_API_BASE}/transaction-status?reference=${reference}`,
          {
            headers: {
              'Authorization': PAYHERO_AUTH_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.status === "SUCCESS") {
            clearInterval(pollInterval);
            Swal.fire({
              title: "Payment Successful! 🎉",
              html: `
                <div style="text-align: center;">
                  <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981;"></i>
                  <h3 style="margin: 15px 0; color: #10b981;">Payment Completed</h3>
                  <p>Your VIP subscription has been activated.</p>
                  <p style="font-size: 0.8rem; color: #888;">Reference: ${reference}</p>
                </div>
              `,
              icon: "success",
              confirmButtonText: "Continue",
            }).then(() => {
              handleUpgrade();
            });
            return;
          }
          
          if (data.status === "FAILED") {
            clearInterval(pollInterval);
            Swal.fire({
              title: "Payment Failed",
              html: "❌ The payment was not completed. Please try again.",
              icon: "error",
              confirmButtonText: "OK",
            });
            return;
          }
        }
      } catch (error) {
        console.log('Polling attempt', attempts, 'continuing...');
      }
    };

    pollInterval = setInterval(checkStatus, 5000);
    return pollInterval;
  };

  // Handle M-Pesa payment with PayHero
  const handleMpesaPayment = async () => {
    // Show phone number input modal
    const { value: phoneNumber } = await Swal.fire({
      title: "Enter M-Pesa Phone Number",
      html: `
        <div style="text-align: center; margin-bottom: 15px;">
          <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
        </div>
        <p style="margin-bottom: 15px;">Enter the M-Pesa phone number to receive the payment prompt.</p>
        <p style="font-size: 0.8rem; color: #666;">You can enter in any format:<br>07XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, 01XXXXXXXX, etc.</p>
      `,
      input: "tel",
      inputPlaceholder: "e.g., 0797814027",
      showCancelButton: true,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#006600",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
      inputValidator: (value) => {
        if (!value) {
          return "Phone number is required!";
        }
        // Basic validation - at least 9 digits
        const digits = value.replace(/\D/g, "");
        if (digits.length < 9) {
          return "Please enter a valid phone number";
        }
        return null;
      }
    });

    if (!phoneNumber) return; // User cancelled

    // Format the phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Show loading
    Swal.fire({
      title: "Initiating Payment",
      html: "Connecting to M-Pesa...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const externalReference = `VIP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Initiate STK Push with PayHero
      const response = await fetch(`${PAYHERO_API_BASE}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': PAYHERO_AUTH_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: price, // price is in KSH
          phone_number: formattedPhone,
          channel_id: CHANNEL_ID,
          provider: 'm-pesa',
          external_reference: externalReference,
          customer_name: currentUser?.email || 'Customer'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Close loading modal
        Swal.close();
        
        // Show authorization message
        Swal.fire({
          title: "Check Your Phone",
          html: `
            <div style="text-align: center;">
              <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
              <h3 style="margin: 15px 0;">Enter M-Pesa PIN</h3>
              <p>Check your phone to authorize payment of <strong>KSH ${price}</strong></p>
              <p><small>Phone: ${formattedPhone}</small></p>
              <p style="color: #666; font-size: 0.9rem; margin-top: 15px;">
                ✅ Payment request sent. Please check your phone and enter your M-Pesa PIN.
              </p>
              <p style="font-size: 0.8rem; color: #888; margin-top: 10px;">
                Reference: ${data.reference || externalReference}
              </p>
            </div>
          `,
          icon: "info",
          confirmButtonText: "OK",
        }).then(() => {
          // Start polling for status
          pollTransactionStatus(data.reference || externalReference);
        });
      } else {
        throw new Error(data.error_message || "Payment initialization failed");
      }
    } catch (error) {
      Swal.fire({
        title: "Payment Failed",
        html: `
          <p>${error.message || "Unable to process payment. Please try again."}</p>
          <p style="font-size: 0.8rem; color: #666; margin-top: 10px;">
            Ensure your phone number is correct and you have sufficient M-Pesa balance.
          </p>
        `,
        icon: "error",
        confirmButtonText: "Try Again",
      });
    }
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
              <button 
                onClick={handleMpesaPayment} 
                className="paystack-btn" // Keep the same class name for styling
              >
                Pay with M-Pesa
              </button>
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
