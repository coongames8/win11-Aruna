import { useState, useContext, useEffect, useRef } from "react";
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

export default function PesapalPayments({ setUserData }) {
  const { currentUser } = useContext(AuthContext);
  const { price, setPrice } = useContext(PriceContext);
  const [processing, setProcessing] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);

  // Subscription plans (shillings)
  const subscriptionPlans = SUBSCRIPTION_PLANS.shillings;

  // Initialize price
  useEffect(() => {
    setPrice(subscriptionPlans[0].value);
  }, []);

  const handlePlanSelect = (planValue) => {
    setPrice(planValue);
  };

  // Clear all polling
  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    setPolling(false);
  };

  // Check payment status
  const checkPaymentStatus = async (orderTrackingId) => {
    const paymentData = {
      orderTrackingId,
      consumerKey: "nbZBtDnSEt9X+l0cHNDFren+7dTQIJXl",
      consumerSecret: "3p2NhatNMO64hzQpqGUs062LTvE=",
    };

    try {
      const res = await fetch(
        `https://all-payments-api-production.up.railway.app/api/pesapal/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentData),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Payment Status:", data);

      const status = data.payment_status_description || "";
      const statusCode = data.status_code;

      // COMPLETED - Payment successful
      if (status === "COMPLETED" || statusCode === 1) {
        return { completed: true, status: "success" };
      }
      // FAILED - Payment failed
      else if (status === "FAILED" || statusCode === 2) {
        return { completed: false, status: "failed" };
      }
      // REVERSED - Payment was reversed
      else if (status === "REVERSED" || statusCode === 3) {
        return { completed: false, status: "reversed" };
      }

      return { completed: false, status: "pending" };
    } catch (err) {
      console.error("Status check error:", err);
      return { completed: false, status: "error", error: err.message };
    }
  };

  // Open payment modal with iframe
  const openPaymentModal = (paymentUrl, trackingId) => {
    let pollCount = 0;
    const MAX_POLLS = 60;
    let isModalClosed = false;

    Swal.fire({
      title: "Complete Your Payment",
      html: `
        <div style="width: 100%; height: 500px; overflow: hidden; position: relative;">
          <iframe 
            src="${paymentUrl}" 
            style="width: 100%; height: 100%; border: none;"
            title="Pesapal Payment"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-top-navigation-by-user-activation"
            allow="payment *;"
          ></iframe>
        </div>
        <div class="payment-status" style="margin-top: 10px; text-align: center; font-size: 12px; color: #666;">
          Complete payment in the window above. This will close automatically when payment is confirmed.
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      width: "900px",
      customClass: {
        popup: "payment-modal-popup",
      },
      didOpen: () => {
        // Start polling after 15 seconds
        pollingTimeoutRef.current = setTimeout(() => {
          if (isModalClosed) return;

          setPolling(true);

          pollIntervalRef.current = setInterval(async () => {
            if (isModalClosed) return;

            pollCount++;
            console.log(
              `Polling payment status (${pollCount}/${MAX_POLLS}) for:`,
              trackingId
            );

            try {
              const result = await checkPaymentStatus(trackingId);

              if (result.completed && result.status === "success") {
                isModalClosed = true;
                clearPolling();
                Swal.close();
                await handleUpgrade(currentUser, price, setUserData);
              } else if (
                result.status === "failed" ||
                result.status === "reversed"
              ) {
                isModalClosed = true;
                clearPolling();
                Swal.close();
                Swal.fire({
                  title: "Payment Failed",
                  text: "Your payment was not successful. Please try again.",
                  icon: "error",
                  confirmButtonText: "OK",
                });
              }

              if (pollCount >= MAX_POLLS && !isModalClosed) {
                isModalClosed = true;
                clearPolling();
                Swal.close();

                Swal.fire({
                  icon: "warning",
                  title: "Payment Status Timeout",
                  html: `
                    <p>We're still waiting for payment confirmation.</p>
                    <p>Please check your email for payment receipt.</p>
                    <p>Your subscription will be activated automatically once payment is confirmed.</p>
                  `,
                  confirmButtonText: "OK",
                });
              }
            } catch (err) {
              console.error("Error in polling:", err);
            }
          }, 5000);
        }, 15000);
      },
      willClose: () => {
        isModalClosed = true;
        clearPolling();
        setProcessing(false);
        setPolling(false);
      },
    });
  };

  // Handle Pesapal payment
  const handlePesapalPayment = async () => {
    if (!currentUser) {
      await Swal.fire({
        title: "Login Required",
        text: "Please login first to continue with payment",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    // Confirm payment
    const result = await Swal.fire({
      icon: "question",
      title: "Confirm Payment",
      html: `
        <div style="text-align: left; padding: 5px;">
          <p><strong>Plan:</strong> ${getPlanName(price)}</p>
          <p><strong>Amount:</strong> KSH ${price}</p>
          <p><strong>Billing:</strong> ${getSubscriptionPeriod(price)}</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: "#4CAF50",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, proceed",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const paymentData = {
      amount: price,
      email: currentUser.email,
      description: `${getPlanName(price)} Subscription (${getSubscriptionPeriod(
        price
      )})`,
      countryCode: "KE",
      currency: "KES",
      url: window.location.origin + window.location.pathname,
      callbackUrl: window.location.origin,
      consumerKey: "nbZBtDnSEt9X+l0cHNDFren+7dTQIJXl",
      consumerSecret: "3p2NhatNMO64hzQpqGUs062LTvE=",
    };

    setProcessing(true);

    try {
      const res = await fetch(
        "https://all-payments-api-production.up.railway.app/api/pesapal/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentData),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const myData = await res.json();

      await Swal.fire({
        icon: "success",
        title: "Payment Initialized!",
        text: "Redirecting you to payment gateway...",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });

      setProcessing(false);

      setTimeout(() => {
        openPaymentModal(myData.redirect_url, myData.order_tracking_id);
      }, 100);
    } catch (err) {
      setProcessing(false);
      clearPolling();
      await Swal.fire({
        icon: "error",
        title: "Payment Error",
        text: err.message,
        confirmButtonText: "OK",
      });
    }
  };

  // Handle callback from Pesapal (when user returns from payment page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingId = urlParams.get("OrderTrackingId");
    const notificationType = urlParams.get("OrderNotificationType");

    if (
      trackingId &&
      notificationType === "CALLBACKURL" &&
      !polling &&
      !processing
    ) {
      setProcessing(true);

      Swal.fire({
        title: "Verifying Payment",
        text: "Please wait while we confirm your payment...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const verifyPayment = async () => {
        const result = await checkPaymentStatus(trackingId);

        if (result.completed && result.status === "success") {
          Swal.close();
          await handleUpgrade(currentUser, price, setUserData);
        } else if (result.status === "failed") {
          Swal.close();
          await Swal.fire({
            icon: "error",
            title: "Payment Failed",
            text: "Your payment was not successful. Please try again.",
            confirmButtonText: "OK",
          });
        } else {
          Swal.close();
          await Swal.fire({
            icon: "info",
            title: "Payment Processing",
            text: "Your payment is still being processed. You will receive an email confirmation once completed.",
            confirmButtonText: "OK",
          });
        }

        setProcessing(false);
        // Remove query params from URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      };

      verifyPayment();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, []);

  return (
    <div className="pesapal-payment-wrapper">
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

      <div className="pesapal-payment">
        <h3>
          GET {getPlanName(price)} VIP FOR KSH {price}
        </h3>

        <button
          onClick={handlePesapalPayment}
          className="confirm-payment-btn"
          disabled={processing || polling}
        >
          {processing ? (
            <span>
              <i className="fas fa-spinner fa-spin"></i> PROCESSING...
            </span>
          ) : polling ? (
            <span>
              <i className="fas fa-clock"></i> CHECKING PAYMENT...
            </span>
          ) : (
            <span>
              <i className="fas fa-credit-card"></i> Pay Now
            </span>
          )}
        </button>

        <p className="pesapal-note">
          Secure payment via Pesapal. Supports M-Pesa, Airtel Money, and Card
          payments.
        </p>
      </div>
    </div>
  );
}
