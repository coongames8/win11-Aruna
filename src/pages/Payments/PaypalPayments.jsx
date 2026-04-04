import { useState, useContext, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
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

// PayPal configuration
const paypalInitialOptions = {
  "client-id":
    "AXIggvGGvXozbZhdkvizPLd89nVYW8KoyNlHO0gHx7hjY_Ah_IfgXihUQGf7T2HUUVYx-D5SNncM0CtU",
  currency: "USD",
  intent: "capture",
};

export default function PaypalPayments({ setUserData }) {
  const { price, setPrice } = useContext(PriceContext);
  const { currentUser } = useContext(AuthContext);
  const [paypalKey, setPaypalKey] = useState(0);

  // PayPal subscription plans (dollars)
  const subscriptionPlans = SUBSCRIPTION_PLANS.dollars;

  // Initialize price
  useEffect(() => {
    setPrice(subscriptionPlans[0].value);
  }, []);

  // Force PayPal buttons to re-render when price changes
  useEffect(() => {
    setPaypalKey((prev) => prev + 1);
  }, [price]);

  const createPayPalOrder = (data, actions) => {
    return actions.order.create({
      purchase_units: [
        {
          amount: {
            value: price.toFixed(2),
            currency_code: "USD",
          },
          description: `${getPlanName(price)} VIP Subscription`,
        },
      ],
    });
  };

  const onPayPalApprove = (data, actions) => {
    return actions.order.capture().then(function (details) {
      console.log("PayPal payment completed:", details);
      handleUpgrade(currentUser, price, setUserData);
    });
  };

  const onPayPalError = (err) => {
    console.error("PayPal error:", err);
    Swal.fire({
      title: "Payment Failed",
      text: "Please try again.",
      icon: "error",
    });
  };

  const handlePlanSelect = (planValue) => {
    setPrice(planValue);
  };

  return (
    <PayPalScriptProvider options={paypalInitialOptions}>
      <div className="paypal-payment-wrapper">
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

        <div className="paypal-payment">
          <h3>
            GET {getPlanName(price).toUpperCase()} VIP FOR ${price}
          </h3>
          <div className="paypal-buttons-container">
            <PayPalButtons
              key={paypalKey}
              style={{
                layout: "horizontal",
                color: "gold",
                shape: "pill",
                label: "pay",
              }}
              createOrder={createPayPalOrder}
              onApprove={onPayPalApprove}
              onError={onPayPalError}
              forceReRender={[price]}
            />
          </div>
          <p
            style={{
              textAlign: "center",
              marginTop: "10px",
              fontSize: "14px",
              opacity: 0.8,
            }}
          >
            Paying: ${price} for {getPlanName(price)} VIP
          </p>
        </div>
      </div>
    </PayPalScriptProvider>
  );
}
