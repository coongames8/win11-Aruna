import React, { useContext, useState } from "react";
import "./Pricing.scss";
import { PriceContext } from "../../PriceContext";
import { useNavigate } from "react-router-dom";
import { Star } from "@mui/icons-material";

export default function Pricing() {
  const navigate = useNavigate();
  const { setPrice } = useContext(PriceContext);

  const [billing, setBilling] = useState("Silver");

  const handleClick = (price) => {
    setPrice(price);
    navigate("/pay");
  };
  const plans = [
    {
      id: 1,
      title: "Silver",
      price: 250,
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
      price: 850,
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
      price: 3000,
      duration: "/Month",
      features: [
        "Plan ahead with our monthly predictions",
        "Get unlimited VIP access for a month",
        "Your winning streak starts here!",
      ],
    },
  ];

  const Item = ({ data }) => {
    return (
      <div
        className={`pricing-card ${data.title === "Gold" ? "featured" : ""}`}
        key={data.duration}
      >
        {data.title === "Gold" && (
          <div className="featured-badge">
            <Star className="star-icon" />
            <span>Popular</span>
          </div>
        )}

        <div className="card-header">
          <h3 className="title">{data.title}</h3>
          <div className="price">
            <span className="currency">KSH</span>
            <span className="amount">{data.price}</span>
            <span className="duration">{data.duration}</span>
          </div>
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

        <button className="glass-btn" onClick={() => handleClick(data.price)}>
          Get Started Now
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
