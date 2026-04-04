import { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../../../AuthContext";
import { PriceContext } from "../../../PriceContext";
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPeriod,
  getPlanName,
  handleUpgrade,
  formatPhoneNumber,
  isValidPhoneNumber,
} from "./paymentUtils";
import Swal from "sweetalert2";
import "./Payments.scss";

// HashBack API Configuration
const HASHBACK_API_URL =
  "https://hash-back-server-samo-production.up.railway.app";

export default function HashbackPayments({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);
  const [processing, setProcessing] = useState(false);
  const wsRef = useRef(null);
  const currentCheckoutIdRef = useRef(null);
  const statusCheckIntervalRef = useRef(null);

  // Subscription plans (shillings)
  const subscriptionPlans = SUBSCRIPTION_PLANS.shillings;

  // Initialize price
  useEffect(() => {
    setPrice(subscriptionPlans[0].value);
  }, []);

  // WebSocket setup for real-time payment confirmation
  useEffect(() => {
    setupWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []);

  const setupWebSocket = () => {
    try {
      wsRef.current = new WebSocket(
        "wss://hash-back-server-production.up.railway.app"
      );

      wsRef.current.onopen = () => {
        console.log("WebSocket connected for payment");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message:", message);

          if (message.type === "payment_completed") {
            handlePaymentSuccess(message.data);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected");
        setTimeout(setupWebSocket, 5000);
      };
    } catch (error) {
      console.log("WebSocket not supported, using polling fallback");
    }
  };

  const handlePaymentSuccess = (data) => {
    setProcessing(false);

    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
    }

    Swal.fire({
      title: "Payment Successful! 🎉",
      html: `
        <div style="text-align: center;">
          <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981;"></i>
          <h3 style="margin: 15px 0;">KSh ${data.amount || price} Paid</h3>
          <p>Your VIP subscription payment was successful!</p>
        </div>
      `,
      icon: "success",
      confirmButtonText: "Activate Subscription",
      confirmButtonColor: "#059669",
    }).then(() => {
      handleUpgrade(currentUser, price, setUserData);
    });
  };

  const checkPaymentStatus = async (checkoutId) => {
    try {
      const response = await fetch(
        `${HASHBACK_API_URL}/api/check-payment-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutId }),
        }
      );

      const data = await response.json();
      console.log("Status check:", data);

      if (data.status === "completed") {
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
        }
        handlePaymentSuccess(data);
      } else if (data.status === "failed") {
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
        }
        Swal.close();
        Swal.fire({
          title: "Payment Failed",
          text: "The payment was not successful. Please try again.",
          icon: "error",
        });
        setProcessing(false);
      }
    } catch (error) {
      console.error("Status check error:", error);
    }
  };

  const handleMpesaPayment = async () => {
    if (processing) return;

    if (!currentUser) {
      Swal.fire({
        title: "Login Required",
        text: "Please login first to continue with payment",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    const { value: phoneNumber } = await Swal.fire({
      title: "Enter M-Pesa Phone Number",
      html: `
        <div style="text-align: center; margin-bottom: 15px;">
          <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
        </div>
        <p style="margin-bottom: 15px;">Enter the M-Pesa phone number to receive the payment prompt.</p>
        <p style="font-size: 0.8rem; color: #666;">Accepted formats: 07XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX</p>
      `,
      input: "tel",
      inputPlaceholder: "e.g., 0712345678",
      showCancelButton: true,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
      inputValidator: (value) => {
        if (!value) {
          return "Phone number is required!";
        }
        if (!isValidPhoneNumber(value)) {
          return "Please enter a valid Kenyan phone number";
        }
        return null;
      },
    });

    if (!phoneNumber) return;

    const formattedPhone = formatPhoneNumber(phoneNumber);

    Swal.fire({
      title: "Initiating Payment",
      text: "Connecting to M-Pesa...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    setProcessing(true);

    try {
      const reference = `VIP-${getPlanName(price)}-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;

      const response = await fetch(`${HASHBACK_API_URL}/api/initiate-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: price,
          phone: formattedPhone,
          reference: reference,
          userId: currentUser?.email || "anonymous",
          metadata: {
            type: "vip_subscription",
            period: getPlanName(price),
            payment_method: "mpesa",
          },
        }),
      });

      const data = await response.json();
      console.log("Initiation response:", data);

      if (data.success && data.checkoutId) {
        currentCheckoutIdRef.current = data.checkoutId;

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "register",
              checkoutId: data.checkoutId,
            })
          );
        }

        Swal.close();

        Swal.fire({
          title: "Check Your Phone",
          html: `
            <div style="text-align: center;">
              <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
              <h3 style="margin: 15px 0;">Enter M-Pesa PIN</h3>
              <p>Check your phone to authorize payment of <strong>KSH ${price}</strong></p>
              <p style="margin-top: 10px;"><small>Phone: ${formattedPhone}</small></p>
              <div style="background: #f8f9ff; padding: 12px; border-radius: 8px; margin-top: 15px;">
                <p style="font-size: 0.8rem; margin: 0; color: #666;">
                  Reference: ${reference}
                </p>
              </div>
              <p style="font-size: 0.8rem; color: #059669; margin-top: 10px;">
                <i class="fas fa-clock"></i> You have 2 minutes to complete the payment
              </p>
            </div>
          `,
          icon: "info",
          confirmButtonText: "I've Completed Payment",
          showCancelButton: true,
          cancelButtonText: "Cancel",
        }).then((result) => {
          if (result.isConfirmed) {
            Swal.fire({
              title: "Waiting for Confirmation",
              html: `
                <div style="text-align: center;">
                  <div class="spinner-border text-success" role="status" style="width: 48px; height: 48px;">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                  <p style="margin-top: 15px;">Please wait while we confirm your payment...</p>
                </div>
              `,
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading();
              },
            });

            statusCheckIntervalRef.current = setInterval(() => {
              if (currentCheckoutIdRef.current) {
                checkPaymentStatus(currentCheckoutIdRef.current);
              }
            }, 5000);

            setTimeout(() => {
              if (statusCheckIntervalRef.current) {
                clearInterval(statusCheckIntervalRef.current);
                Swal.close();
                Swal.fire({
                  title: "Payment Not Confirmed",
                  text: "Payment confirmation timed out. Please check your M-Pesa statement or contact support.",
                  icon: "warning",
                  confirmButtonColor: "#059669",
                });
                setProcessing(false);
              }
            }, 120000);
          } else {
            setProcessing(false);
            Swal.fire({
              title: "Payment Cancelled",
              text: "You can complete the payment from your M-Pesa app or try again.",
              icon: "info",
            });
          }
        });
      } else {
        throw new Error(data.error || data.message || "Initiation failed");
      }
    } catch (error) {
      console.error("Payment error:", error);
      Swal.fire({
        title: "Payment Failed",
        text: error.message || "Unable to initiate payment. Please try again.",
        icon: "error",
      });
      setProcessing(false);
    }
  };

  const handlePlanSelect = (planValue) => {
    setPrice(planValue);
  };

  return (
    <div className="hashback-payment-wrapper">
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

      <div className="hashback-payment">
        <h3>
          GET {getPlanName(price).toUpperCase()} VIP FOR KSH {price}
        </h3>

        <button
          onClick={handleMpesaPayment}
          className="confirm-payment-btn"
          disabled={processing}
        >
          {processing ? (
            <span>
              <i className="fas fa-spinner fa-spin"></i> PROCESSING...
            </span>
          ) : (
            <span>
              <i className="fas fa-mobile-alt"></i> Pay Now
            </span>
          )}
        </button>

        <p className="hashback-note">
          Secure payment via HashBack. You will receive an STK push on your
          M-Pesa phone.
        </p>
      </div>
    </div>
  );
}
