import { useState } from "react";
import AppHelmet from "../../components/AppHelmet";
import PaypalPayments from "./PaypalPayments";
import KoraPayments from "./mobile/KoraPayments";
import CryptoPayments from "./CryptoPayments";
import GooglePayments from "./GooglePayments";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaypal,
  faBitcoin,
  faGooglePay,
} from "@fortawesome/free-brands-svg-icons";
import "./Payments.scss";

export default function PaymentPage({ setUserData }) {
  const [paymentType, setPaymentType] = useState("mpesa");

  // Payment methods
  const paymentMethods = [
    { id: "mpesa", label: "Mobile/Card 📲" },
    {
      id: "paypal",
      label: "PayPal",
      icon: <FontAwesomeIcon icon={faPaypal} />,
    },
    /*{
      id: "googlepay",
      label: "Google Pay",
      icon: <FontAwesomeIcon icon={faGooglePay} />,
    },*/
    {
      id: "crypto",
      label: "Crypto",
      icon: <FontAwesomeIcon icon={faBitcoin} />,
    },
  ];

  const handlePaymentMethodChange = (methodId) => {
    setPaymentType(methodId);
  };

  const renderPaymentComponent = () => {
    switch (paymentType) {
      case "googlepay":
        return <GooglePayments setUserData={setUserData} />;
      case "paypal":
        return <PaypalPayments setUserData={setUserData} />;
      case "crypto":
        return <CryptoPayments setUserData={setUserData} />;
      case "mpesa":
        return <KoraPayments setUserData={setUserData} />;
      default:
        return <KoraPayments setUserData={setUserData} />;
    }
  };

  return (
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
              {method.icon && (
                <span className="method-icon">{method.icon}</span>
              )}
              <span
                className={`method-label ${
                  method.id === "googlepay" ? "google-pay-label" : ""
                }`}
              >
                {method.id === "googlepay" ? "" : method.label}
              </span>
            </label>
          ))}
        </div>

        {renderPaymentComponent()}
      </div>
    </div>
  );
}
