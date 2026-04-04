import { useState, useContext, useEffect } from "react";
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

// PayHero configuration
const PAYHERO_API_BASE = "https://backend.payhero.co.ke/api/v2";
const PAYHERO_AUTH_TOKEN =
  "Basic bnhvR1cxSVZqMFVoVVNHMmtTc3A6czFmcFF0NFRJa0lreFowYXZVWjdkRDRkdHJKeUtRaUxldjdoVVZVTw==";
const CHANNEL_ID = 3123;

export default function PayHeroPayments({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);

  // Subscription plans (shillings)
  const subscriptionPlans = SUBSCRIPTION_PLANS.shillings;

  // Initialize price
  useEffect(() => {
    setPrice(subscriptionPlans[0].value);
  }, []);

  // Poll transaction status
  const pollTransactionStatus = (reference) => {
    let attempts = 0;
    const maxAttempts = 30;
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
        const response = await fetch(
          `${PAYHERO_API_BASE}/transaction-status?reference=${reference}`,
          {
            headers: {
              Authorization: PAYHERO_AUTH_TOKEN,
              "Content-Type": "application/json",
            },
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
                </div>
              `,
              icon: "success",
              confirmButtonText: "Continue",
            }).then(() => {
              handleUpgrade(currentUser, price, setUserData);
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
        console.log("Polling attempt", attempts, "continuing...");
      }
    };

    pollInterval = setInterval(checkStatus, 5000);
    return pollInterval;
  };

  const handleMpesaPayment = async () => {
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
        <p style="font-size: 0.8rem; color: #666;">Accepted formats:<br>07XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX, 01XXXXXXXX</p>
      `,
      input: "tel",
      inputPlaceholder: "e.g., 0712345678",
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
      html: "Connecting to M-Pesa...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const externalReference = `VIP-${getPlanName(
        price
      )}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const response = await fetch(`${PAYHERO_API_BASE}/payments`, {
        method: "POST",
        headers: {
          Authorization: PAYHERO_AUTH_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: price,
          phone_number: formattedPhone,
          channel_id: CHANNEL_ID,
          provider: "m-pesa",
          external_reference: externalReference,
          customer_name: currentUser?.email || "Customer",
        }),
      });

      const data = await response.json();

      if (data.success) {
        Swal.close();

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
            </div>
          `,
          icon: "info",
          confirmButtonText: "OK",
        }).then(() => {
          pollTransactionStatus(data.reference || externalReference);
        });
      } else {
        throw new Error(data.error_message || "Payment initialization failed");
      }
    } catch (error) {
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
    }
  };

  const handlePlanSelect = (planValue) => {
    setPrice(planValue);
  };

  return (
    <div className="payhero-payment-wrapper">
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

      <div className="payhero-payment">
        <h3>
          GET {getPlanName(price).toUpperCase()} VIP FOR KSH {price}
        </h3>
        <button onClick={handleMpesaPayment} className="confirm-payment-btn">
          Pay Now
        </button>
        <p className="payhero-note">
          Secure payment via PayHero. You will receive an STK push on your
          M-Pesa phone.
        </p>
      </div>
    </div>
  );
}
