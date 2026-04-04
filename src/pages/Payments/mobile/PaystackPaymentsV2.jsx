import { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../../../AuthContext";
import { PriceContext } from "../../../PriceContext";
import Swal from "sweetalert2";
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPeriod,
  getPlanName,
  handleUpgrade,
  formatPhoneNumber,
  isValidPhoneNumber,
} from "../paymentUtils";
import "../Payments.scss";

// API Configuration
const API_BASE_URL = "https://crbchecker-api-production.up.railway.app";

export default function PaystackPaymentsV2({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);
  const [processing, setProcessing] = useState(false);
  const statusCheckIntervalRef = useRef(null);

  // Subscription plans (shillings)
  const subscriptionPlans = SUBSCRIPTION_PLANS.shillings;

  // Initialize price
  useEffect(() => {
    setPrice(subscriptionPlans[0].value);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []);

  const startPaymentPolling = (reference) => {
    let attempts = 0;
    const maxAttempts = 30;

    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
        }
        Swal.fire({
          title: "Payment Timeout",
          html: "⏰ Payment monitoring timeout. Please check your transaction history.",
          icon: "warning",
          confirmButtonText: "OK",
        });
        setProcessing(false);
        return;
      }

      attempts++;

      try {
        const response = await fetch(`${API_BASE_URL}/api/status/${reference}`);
        const data = await response.json();

        if (data.success) {
          if (data.paid) {
            if (statusCheckIntervalRef.current) {
              clearInterval(statusCheckIntervalRef.current);
            }

            Swal.fire({
              title: "Payment Successful! 🎉",
              html: `
                <div style="text-align: center;">
                  <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981;"></i>
                  <h3 style="margin: 15px 0;">KSh ${price} Paid</h3>
                  <p>Your VIP subscription payment was successful!</p>
                  <p style="font-size: 0.85rem; color: #666; margin-top: 10px;">
                    Reference: ${reference}
                  </p>
                </div>
              `,
              icon: "success",
              confirmButtonText: "Activate Subscription",
            }).then(() => {
              handleUpgrade(currentUser, price, setUserData);
            });
            return;
          }

          if (data.can_retry) {
            if (statusCheckIntervalRef.current) {
              clearInterval(statusCheckIntervalRef.current);
            }
            Swal.fire({
              title: "Payment Not Completed",
              html: "⚠️ Payment not completed. You can try again.",
              icon: "warning",
              confirmButtonText: "OK",
            });
            setProcessing(false);
            return;
          }
        }
      } catch (error) {
        console.log("Polling attempt", attempts, "continuing...");
      }
    };

    statusCheckIntervalRef.current = setInterval(checkStatus, 5000);
  };

  const submitOTP = async (reference, otp) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/submit-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim(), reference: reference }),
      });

      const data = await response.json();

      if (data.success) {
        return true;
      } else {
        Swal.showValidationMessage(
          data.message || "Invalid OTP. Please try again."
        );
        return false;
      }
    } catch (error) {
      Swal.showValidationMessage("OTP verification failed. Please try again.");
      return false;
    }
  };

  const initiatePayment = async (phone) => {
    setProcessing(true);

    Swal.fire({
      title: "Initiating Payment",
      html: "Connecting to M-Pesa...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const formattedPhone = formatPhoneNumber(phone);
      const email = currentUser?.email;

      if (!email) {
        throw new Error("User email not found. Please login again.");
      }

      const response = await fetch(`${API_BASE_URL}/api/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          amount: price,
          phone: formattedPhone,
          userId: currentUser?.email || "anonymous",
          activation_type: "vip_subscription",
        }),
      });

      const data = await response.json();

      if (data.success) {
        Swal.close();

        if (data.status === "success") {
          Swal.fire({
            title: "Payment Successful! 🎉",
            html: `
              <div style="text-align: center;">
                <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981;"></i>
                <h3 style="margin: 15px 0;">KSh ${price} Paid</h3>
                <p>Your VIP subscription payment was successful!</p>
              </div>
            `,
            icon: "success",
            confirmButtonText: "Activate Subscription",
          }).then(() => {
            handleUpgrade(currentUser, price, setUserData);
          });
        } else if (data.requires_authorization) {
          Swal.fire({
            title: "Check Your Phone",
            html: `
              <div style="text-align: center;">
                <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
                <h3 style="margin: 15px 0;">Enter M-Pesa PIN</h3>
                <p>Check your phone to authorize payment of <strong>KSh ${price}</strong></p>
                <p><small>Phone: ${formattedPhone}</small></p>
              </div>
            `,
            icon: "info",
            confirmButtonText: "OK",
          }).then(() => {
            startPaymentPolling(data.reference);
          });
        } else if (data.requires_otp) {
          Swal.fire({
            title: "OTP Required",
            html: "📱 OTP sent! Please check your phone for the authorization code.",
            input: "text",
            inputPlaceholder: "Enter OTP",
            showCancelButton: true,
            confirmButtonText: "Submit OTP",
            cancelButtonText: "Cancel",
            showLoaderOnConfirm: true,
            preConfirm: async (otp) => {
              if (!otp) {
                Swal.showValidationMessage("Please enter the OTP");
                return false;
              }
              return await submitOTP(data.reference, otp);
            },
          }).then((result) => {
            if (result.isConfirmed && result.value) {
              startPaymentPolling(data.reference);
            } else {
              setProcessing(false);
            }
          });
        } else {
          Swal.fire({
            title: "Payment Initiated",
            html: `📱 ${data.message || "Payment processing..."}`,
            icon: "info",
            confirmButtonText: "OK",
          }).then(() => {
            startPaymentPolling(data.reference);
          });
        }
      } else {
        throw new Error(data.message || "Payment initialization failed");
      }
    } catch (error) {
      Swal.close();
      Swal.fire({
        title: "Payment Failed",
        html: `
          <p>${
            error.message || "Unable to process payment. Please try again."
          }</p>
          <p style="font-size: 0.8rem; color: #666; margin-top: 10px;">
            Ensure your phone number is correct and you have sufficient M-Pesa balance.
          </p>
        `,
        icon: "error",
        confirmButtonText: "Try Again",
      });
      setProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!currentUser) {
      Swal.fire({
        title: "Login Required",
        text: "Please login first to continue with payment",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    const { value: phone } = await Swal.fire({
      title: "Enter M-Pesa Phone Number",
      html: `
        <div style="text-align: center; margin-bottom: 15px;">
          <i class="fas fa-mobile-alt" style="font-size: 48px; color: #065f46;"></i>
        </div>
        <p>Accepted formats: 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX, 7XXXXXXXX</p>
      `,
      input: "tel",
      inputPlaceholder: "e.g., 0712345678",
      showCancelButton: true,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#059669",
      inputValidator: (value) => {
        if (!value) return "Phone number is required!";
        if (!isValidPhoneNumber(value)) {
          return "Please enter a valid Kenyan phone number";
        }
        return null;
      },
    });

    if (!phone) return;
    await initiatePayment(phone);
  };

  const handlePlanSelect = (planValue) => {
    setPrice(planValue);
  };

  return (
    <div className="paystack-payment-wrapper">
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

      <div className="paystack-payment">
        <h3>
          GET {getPlanName(price).toUpperCase()} VIP FOR KSH {price}
        </h3>

        <button
          onClick={handlePayment}
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

        <p className="paystack-note">
          Secure payment via Paystack. You will receive an STK push on your
          M-Pesa phone.
        </p>
      </div>
    </div>
  );
}
