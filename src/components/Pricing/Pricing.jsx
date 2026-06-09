import React, { useContext, useState } from "react";
import "./Pricing.scss";
import { PriceContext } from "../../PriceContext";
import { useNavigate } from "react-router-dom";
import { Star } from "@mui/icons-material";
import { useCurrency, convertCurrency } from "../../hooks/useCurrency";

export default function Pricing() {
  const navigate = useNavigate();
  const { setPrice } = useContext(PriceContext);
  const [billing, setBilling] = useState("Gold");
  
  // Use the custom hook
  const { currency, loading, formatAmount } = useCurrency();

  const plans = [
    {
      id: 1,
      title: "Silver",
      priceKES: 250,
      duration: "/Day",
      features: [
        "Every day is game day! Check out our daily tips and win big!",
        "Access 24 hours VIP predictions",
        "Expert Football Predictions",
      ],
    },
    {
      id: 2,
      title: "Gold",
      priceKES: 850,
      duration: "/Week",
      features: [
        "Get the scoop on this week's matches",
        "Enjoy a full week of VIP predictions",
        "Weekly unbeatable football predictions!",
      ],
    },
    {
      id: 3,
      title: "Platinum",
      priceKES: 3000,
      duration: "/Month",
      features: [
        "Plan ahead with our monthly predictions",
        "Get unlimited VIP access for a month",
        "Your winning streak starts here!",
      ],
    },
  ];

  const handleClick = (priceKES) => {
    const convertedAmount = currency 
      ? convertCurrency(priceKES, currency.currency) 
      : priceKES;
    
    setPrice({
      amountKES: priceKES,
      amountUserCurrency: convertedAmount,
      currency: currency?.currency || "KES",
      currencySymbol: currency?.currency_symbol || "KSh",
      plan: billing
    });
    navigate("/pay");
  };

  const Item = ({ data }) => {
    return (
      <div
        className={`pricing-card ${data.title === "Gold" ? "featured" : ""}`}
        key={data.id}
      >
        {data.title === "Gold" && (
          <div className="featured-badge">
            <Star className="star-icon" />
            <span>Popular</span>
          </div>
        )}

        <div className="card-header">
          <h3 className="title">
            {data.title} {!loading && currency?.flag && <span>{currency.flag}</span>}
          </h3>
          <div className="price">
            <span className="currency">
              {loading ? "KSH" : (currency?.currency || "KSH")}
            </span>
            <span className="amount">
              {loading ? data.priceKES : formatAmount(data.priceKES)}
            </span>
            <span className="duration">{data.duration}</span>
          </div>
          {!loading && currency?.currency !== "KES" && (
            <div style={{ fontSize: "12px", marginTop: "5px", opacity: 0.7 }}>
              ≈ KSH {data.priceKES.toLocaleString()}
            </div>
          )}
        </div>

        <div className="card-features">
          <ul>
            {data.features.map((item, index) => (
              <li key={index}>
                <span className="checkmark">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <button 
          className="glass-btn" 
          onClick={() => handleClick(data.priceKES)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Get Started Now"}
        </button>
      </div>
    );
  };

  return (
    <div className="pricing-container" id="pricing">
      <div className="pricing-header">
        <div className="plans-switch-container">
          <div className="plans-options">
            <label>
              <input
                type="radio"
                name="billing"
                value="Silver"
                checked={billing === "Silver"}
                onChange={() => setBilling("Silver")}
              />
              Daily
            </label>
            <label>
              <input
                type="radio"
                name="billing"
                value="Gold"
                checked={billing === "Gold"}
                onChange={() => setBilling("Gold")}
              />
              Weekly
            </label>
            <label>
              <input
                type="radio"
                name="billing"
                value="Platinum"
                checked={billing === "Platinum"}
                onChange={() => setBilling("Platinum")}
              />
              Monthly
            </label>
          </div>
        </div>
      </div>
      <div className="pricing-grid wrapper">
        {plans
          .filter((item) => item.title === billing)
          .map((item) => {
            return <Item data={item} key={item.id} />;
          })}
      </div>
    </div>
  );
}