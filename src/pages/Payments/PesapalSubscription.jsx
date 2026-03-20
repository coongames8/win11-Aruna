import { useLocation } from 'react-router-dom';
import './Pay.scss';
import { useEffect, useState, useRef } from 'react';
import AppHelmet from '../AppHelmet';
import ScrollToTop from '../ScrollToTop';
import Loader from '../../components/Loader/Loader';
import { useNavigate } from 'react-router-dom';
import { pricings } from '../../data';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { notificationState, subscriptionState, userState } from '../../recoil/atoms';
import { getUser, updateUser } from '../../firebase';
import Swal from 'sweetalert2';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import NowPaymentsApi from "@nowpaymentsio/nowpayments-api-js";

// Twitter Events Utility Functions
const trackTwitterEvent = (eventId, parameters = {}) => {
  if (typeof window !== 'undefined' && window.twq) {
    window.twq('event', eventId, parameters);
  } else {
    console.warn('X Twitter pixel not loaded yet');
    if (typeof window !== 'undefined') {
      window.twitterEventQueue = window.twitterEventQueue || [];
      window.twitterEventQueue.push({ eventId, parameters });
    }
  }
};

const trackPurchase = (value, currency = 'KES', contents = []) => {
  trackTwitterEvent('tw-ql57w-ql57x', {
    value: value,
    currency: currency,
    contents: contents,
    conversion_id: 'goal-kings-subscription'
  });
};

// Twitter Pixel Queue Hook
const useTwitterPixelQueue = () => {
  useEffect(() => {
    const processQueue = () => {
      if (window.twitterEventQueue && window.twitterEventQueue.length > 0) {
        window.twitterEventQueue.forEach(({ eventId, parameters }) => {
          if (window.twq) {
            window.twq('event', eventId, parameters);
          }
        });
        window.twitterEventQueue = [];
      }
    };

    const interval = setInterval(() => {
      if (window.twq) {
        processQueue();
        clearInterval(interval);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => clearInterval(interval);
  }, []);
};

// Payment configurations
const npApi = new NowPaymentsApi({ apiKey: "D7YT1YV-PCAM4ZN-HX9W5M1-H02KFCV" });

const paypalInitialOptions = {
  "client-id": "AXIggvGGvXozbZhdkvizPLd89nVYW8KoyNlHO0gHx7hjY_Ah_IfgXihUQGf7T2HUUVYx-D5SNncM0CtU",
  currency: "USD",
  intent: "capture",
};

const PAYHERO_API_BASE = 'https://backend.payhero.co.ke/api/v2';
const PAYHERO_AUTH_TOKEN = 'Basic bnhvR1cxSVZqMFVoVVNHMmtTc3A6czFmcFF0NFRJa0lreFowYXZVWjdkRDRkdHJKeUtRaUxldjdoVVZVTw==';
const CHANNEL_ID = 3123;

const EXCHANGE_RATE = 150; // 1 USD = 150 KSH

export default function Subscription() {
  const [user, setUser] = useRecoilState(userState);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState("mpesa");
  const location = useLocation();
  const [data, setData] = useState(null);
  const setNotification = useSetRecoilState(notificationState);
  const [subscription, setSubscription] = useRecoilState(subscriptionState);
  const navigate = useNavigate();
  
  // Crypto states
  const [currenciesArr, setCurrenciesArr] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState("TUSD");
  const addressRef = useRef();
  const [copied, setCopied] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("");
  const [paypalKey, setPaypalKey] = useState(0);
  
  // Polling refs
  const pollIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);
  const [polling, setPolling] = useState(false);

  // Initialize Twitter pixel queue
  useTwitterPixelQueue();

  useEffect(() => {
    if (location.state) {
      setData(location.state.subscription);
      setSubscription(location.state.subscription);
    } else {
      setData(pricings[0]);
      setSubscription(pricings[0]);
    }
  }, [location]);

  // Get price in USD for crypto/PayPal
  const kshToUsd = (ksh) => (ksh / EXCHANGE_RATE).toFixed(2);
  
  const getCurrentPriceInUsd = () => {
    return kshToUsd(data?.price || subscription.price);
  };

  const getDisplayPrice = () => {
    if (paymentType === "mpesa") {
      return `KSH ${data?.price || subscription.price}`;
    } else {
      return `$${getCurrentPriceInUsd()}`;
    }
  };

  const handleUpgrade = async () => {
    const currentDate = new Date().toISOString();
    await updateUser(user.email, true, {
      subDate: currentDate,
      billing: subscription.billing,
      plan: subscription.plan,
    }, setNotification).then(() => {
      return getUser(user.email, setUser);
    }).then(() => {
      // Track successful purchase conversion
      trackPurchase(
        data?.price || subscription.price,
        'KES',
        [
          {
            id: subscription.plan,
            quantity: 1,
            item_price: data?.price || subscription.price
          }
        ]
      );

      // Show success message
      Swal.fire({
        icon: 'success',
        title: '🎉 Welcome to VIP!',
        html: `
          <div style="text-align: center;">
            <h3 style="color: #4CAF50; margin-bottom: 15px;">Payment Successful!</h3>
            <p style="font-size: 16px; margin: 8px 0;">You are now a <strong>${subscription.plan}</strong> VIP member</p>
            <p style="font-size: 14px; color: #666; margin-top: 10px;">Enjoy exclusive tips and premium content</p>
          </div>
        `,
        showConfirmButton: true,
        confirmButtonColor: '#4CAF50',
        confirmButtonText: 'Start Exploring!',
        timer: 5000,
        timerProgressBar: true,
        customClass: {
          popup: 'swal-custom-popup',
          title: 'swal-custom-title',
          htmlContainer: 'swal-custom-html',
          confirmButton: 'swal-custom-confirm-success'
        }
      }).then(() => {
        navigate("/", { replace: true });
      });
    }).catch((error) => {
      Swal.fire({
        icon: 'error',
        title: 'Upgrade Failed',
        text: error.message,
        confirmButtonColor: '#d33',
        customClass: {
          popup: 'swal-custom-popup',
          title: 'swal-custom-title',
          htmlContainer: 'swal-custom-html',
          confirmButton: 'swal-custom-confirm'
        }
      });
    });
  };

  // Format phone number for M-Pesa
  const formatPhoneNumber = (phone) => {
    let p = phone.toString().replace(/\D/g, "");
    if (p.startsWith("0")) {
      return p;
    }
    if (p.startsWith("7") || p.startsWith("1")) {
      return "0" + p;
    }
    if (p.startsWith("254")) {
      return "0" + p.substring(3);
    }
    if (p.startsWith("2541")) {
      return "0" + p.substring(3);
    }
    return p;
  };

  // Poll transaction status for M-Pesa
  const pollTransactionStatus = (reference) => {
    let attempts = 0;
    const maxAttempts = 30;
    let pollInterval;

    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        setProcessing(false);
        Swal.fire({
          title: "Payment Timeout",
          html: "Payment monitoring timeout. Please check your transaction history.",
          icon: "warning",
          confirmButtonText: "OK",
        });
        return;
      }

      attempts++;

      try {
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
            setProcessing(false);
            await handleUpgrade();
            return;
          }
          
          if (data.status === "FAILED") {
            clearInterval(pollInterval);
            setProcessing(false);
            Swal.fire({
              title: "Payment Failed",
              html: "The payment was not completed. Please try again.",
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

  // Handle M-Pesa payment
  const handleMpesaPayment = async () => {
    if (!user) {
      await Swal.fire({
        icon: 'warning',
        title: 'Login Required',
        text: 'Please login first to continue with payment',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Login Now',
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) navigate('/login');
      });
      return;
    }

    const { value: phoneNumber } = await Swal.fire({
      title: "Enter M-Pesa Phone Number",
      html: `
        <div style="text-align: center; margin-bottom: 15px;">
          <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
        </div>
        <p>Enter the M-Pesa phone number to receive the payment prompt.</p>
        <p style="font-size: 0.8rem; color: #666;">Format: 07XXXXXXXX or 7XXXXXXXX</p>
      `,
      input: "tel",
      inputPlaceholder: "e.g., 0797814027",
      showCancelButton: true,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#006600",
      inputValidator: (value) => {
        if (!value) return "Phone number is required!";
        const digits = value.replace(/\D/g, "");
        if (digits.length < 9) return "Please enter a valid phone number";
        return null;
      }
    });

    if (!phoneNumber) return;

    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    Swal.fire({
      title: "Initiating Payment",
      html: "Connecting to M-Pesa...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const externalReference = `VIP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const response = await fetch(`${PAYHERO_API_BASE}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': PAYHERO_AUTH_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: data?.price || subscription.price,
          phone_number: formattedPhone,
          channel_id: CHANNEL_ID,
          provider: 'm-pesa',
          external_reference: externalReference,
          customer_name: user?.email || 'Customer'
        })
      });

      const responseData = await response.json();

      if (responseData.success) {
        Swal.close();
        setProcessing(true);
        
        Swal.fire({
          title: "Check Your Phone",
          html: `
            <div style="text-align: center;">
              <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
              <h3>Enter M-Pesa PIN</h3>
              <p>Amount: <strong>KSH ${data?.price || subscription.price}</strong></p>
              <p>Phone: ${formattedPhone}</p>
              <p>Please check your phone and enter your M-Pesa PIN.</p>
            </div>
          `,
          icon: "info",
          confirmButtonText: "OK",
        }).then(() => {
          pollTransactionStatus(responseData.reference || externalReference);
        });
      } else {
        throw new Error(responseData.error_message || "Payment initialization failed");
      }
    } catch (error) {
      Swal.close();
      setProcessing(false);
      Swal.fire({
        title: "Payment Failed",
        text: error.message || "Unable to process payment. Please try again.",
        icon: "error",
        confirmButtonText: "Try Again",
      });
    }
  };

  // Crypto payment
  const getCryptoAddress = async () => {
    const usdPrice = getCurrentPriceInUsd();
    const params = {
      price_amount: parseFloat(usdPrice),
      price_currency: "usd",
      pay_currency: selectedCurrency.toLowerCase(),
    };
    try {
      const response = await npApi.createPayment(params);
      setPayAmount(response.pay_amount);
      setPayCurrency(response.pay_currency);
      setAddress(response.pay_address);
      setNetwork(response.network);
    } catch (error) {
      console.error("Crypto payment error:", error);
    }
  };

  const handleCopy = (e) => {
    e.preventDefault();
    addressRef.current.select();
    document.execCommand("copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  // Fetch currencies for crypto
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

  useEffect(() => {
    if (paymentType === "crypto" && data) {
      getCryptoAddress();
    }
  }, [selectedCurrency, data?.price, paymentType]);

  // Force PayPal re-render
  useEffect(() => {
    if (paymentType === "paypal") {
      setPaypalKey(prev => prev + 1);
    }
  }, [data?.price, paymentType]);

  // PayPal handlers
  const createPayPalOrder = (data, actions) => {
    const usdPrice = getCurrentPriceInUsd();
    return actions.order.create({
      purchase_units: [
        {
          amount: {
            value: usdPrice,
            currency_code: "USD",
          },
          description: `${subscription.plan} VIP Subscription`,
        },
      ],
    });
  };

  const onPayPalApprove = (data, actions) => {
    return actions.order.capture().then(function (details) {
      console.log("PayPal payment completed:", details);
      setProcessing(true);
      handleUpgrade().finally(() => setProcessing(false));
    });
  };

  const onPayPalError = (err) => {
    console.error("PayPal error:", err);
    setProcessing(false);
    Swal.fire({
      icon: 'error',
      title: 'Payment Failed',
      text: 'Please try again or use another payment method.',
      confirmButtonColor: '#d33',
    });
  };

  // Track page view
  useEffect(() => {
    if (data) {
      trackTwitterEvent('tw-ql57w-ql57x', {
        value: data.price,
        currency: 'KES',
        contents: [
          {
            id: data.plan,
            quantity: 1,
            item_price: data.price
          }
        ],
        event_type: 'subscription_page_view'
      });
    }
  }, [data]);

  return (
    <PayPalScriptProvider options={paypalInitialOptions}>
      <div className='pay'>
        <AppHelmet title={"Subscription Payment"} />
        <ScrollToTop />
        {(loading || processing) && <Loader />}

        <div className="subscription-details">
          {data && <h4>Payment Of KSH {data.price}</h4>}
          {data && <h4>You Are About To Claim {data.plan} Plan.</h4>}
          {data && <p className="billing-info">Billing: {subscription.billing}</p>}
        </div>

        {/* Payment Method Selector */}
        <div className="payment-methods">
          <button 
            className={`method-btn ${paymentType === 'mpesa' ? 'active' : ''}`}
            onClick={() => setPaymentType('mpesa')}
          >
            M-Pesa / Card 📲
          </button>
          <button 
            className={`method-btn ${paymentType === 'crypto' ? 'active' : ''}`}
            onClick={() => setPaymentType('crypto')}
          >
            Crypto ₿
          </button>
          <button 
            className={`method-btn ${paymentType === 'paypal' ? 'active' : ''}`}
            onClick={() => setPaymentType('paypal')}
          >
            PayPal 💳
          </button>
        </div>

        {paymentType === "mpesa" ? (
          <div className="mpesa-payment">
            <h3>GET {subscription.plan} FOR {getDisplayPrice()}</h3>
            <button 
              onClick={handleMpesaPayment} 
              className='btn'
              disabled={processing}
            >
              {processing ? (
                <span><i className="fas fa-spinner fa-spin"></i> PROCESSING...</span>
              ) : (
                <span><i className="fas fa-mobile-alt"></i> Pay with M-Pesa</span>
              )}
            </button>
          </div>
        ) : paymentType === "crypto" ? (
          <div className="crypto-details">
            <h3>GET {subscription.plan} FOR {getDisplayPrice()}</h3>
            
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

            {address && (
              <div className="payment-info">
                <p>Amount: <strong>{payAmount} {payCurrency?.toUpperCase()}</strong></p>
                <p>Network: <strong>{network?.toUpperCase()}</strong></p>
                <p>Address: <strong>{address}</strong></p>
              </div>
            )}

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
                  <span><i className="fas fa-check"></i> Copied!</span>
                ) : (
                  <span><i className="fas fa-copy"></i> Copy</span>
                )}
              </button>
            </div>

            <p className="crypto-note">
              Send exactly {payAmount} {payCurrency?.toUpperCase()} to the address above.<br/>
              Payment will be confirmed within 5-10 minutes.
            </p>
          </div>
        ) : (
          <div className="paypal-payment">
            <h3>GET {subscription.plan} FOR {getDisplayPrice()}</h3>
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
                disabled={processing}
              />
            </div>
          </div>
        )}
      </div>
    </PayPalScriptProvider>
  );
}

// Add necessary styles
const additionalStyles = `
/* Payment Methods */
.payment-methods {
  display: flex;
  gap: 10px;
  margin: 20px 0;
  justify-content: center;
  flex-wrap: wrap;
}

.method-btn {
  padding: 10px 20px;
  border: 2px solid #667eea;
  background: transparent;
  color: #667eea;
  border-radius: 25px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.method-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.method-btn:hover:not(.active) {
  background: rgba(102, 126, 234, 0.1);
}

/* Crypto Payment */
.crypto-details {
  margin-top: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
}

.form-group {
  margin: 15px 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.glass-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.payment-info {
  margin: 20px 0;
  padding: 15px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 10px;
}

.payment-info p {
  margin: 8px 0;
  word-break: break-all;
}

.address-copy {
  display: flex;
  gap: 10px;
  margin: 15px 0;
}

.glass-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 12px;
}

.copy-btn {
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.copy-btn:hover {
  background: #5a67d8;
}

.crypto-note {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-top: 15px;
}

/* PayPal */
.paypal-payment {
  margin-top: 20px;
}

.paypal-buttons-container {
  max-width: 500px;
  margin: 20px auto;
}

/* M-Pesa */
.mpesa-payment {
  text-align: center;
  margin-top: 20px;
}

/* Common */
.btn {
  padding: 14px 28px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  margin-top: 20px;
  width: 100%;
  max-width: 300px;
}

.btn i {
  margin-right: 8px;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background: linear-gradient(135deg, #a0a0a0 0%, #808080 100%);
  transform: none !important;
  box-shadow: none;
}

.btn:not(:disabled):hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.fa-spinner {
  animation: spin 1s linear infinite;
}

.billing-info {
  text-align: center;
  color: #666;
  font-size: 14px;
  margin-top: -10px;
}

.subscription-details {
  margin-bottom: 30px;
  text-align: center;
}

.subscription-details h4 {
  margin: 10px 0;
}

/* Responsive */
@media (max-width: 768px) {
  .payment-methods {
    gap: 8px;
  }
  
  .method-btn {
    padding: 8px 16px;
    font-size: 14px;
  }
  
  .btn {
    max-width: 100%;
  }
}

/* SweetAlert custom styles */
.swal-custom-popup {
  border-radius: 15px !important;
  padding: 20px !important;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important;
}

.swal-custom-title {
  font-size: 22px !important;
  font-weight: 600 !important;
  color: #333 !important;
  margin-top: 5px !important;
}

.swal-custom-html {
  font-size: 15px !important;
  color: #555 !important;
  margin: 10px 0 !important;
}

.swal-custom-confirm-success {
  background-color: #4CAF50 !important;
  border-radius: 8px !important;
  padding: 10px 25px !important;
  font-weight: 600 !important;
  font-size: 14px !important;
}
`;

// Add styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = additionalStyles;
  document.head.appendChild(style);
}
