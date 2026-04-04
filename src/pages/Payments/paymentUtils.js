import { doc, setDoc } from "firebase/firestore";
import { db, getUser } from "../../firebase";
import Swal from "sweetalert2";

// Subscription plans mapping for different payment methods
export const SUBSCRIPTION_PLANS = {
  shillings: [
    {
      id: "daily",
      value: 250,
      label: "Daily VIP",
      price: "KSH 250",
      period: "Daily",
    },
    {
      id: "weekly",
      value: 850,
      label: "7 Days VIP",
      price: "KSH 850",
      period: "Weekly",
    },
    {
      id: "monthly",
      value: 3000,
      label: "30 Days VIP",
      price: "KSH 3000",
      period: "Monthly",
    },
    {
      id: "yearly",
      value: 8500,
      label: "1 Year VIP",
      price: "KSH 8500",
      period: "Yearly",
    },
  ],
  dollars: [
    { id: "2", value: 2, label: "Daily", price: "$2", period: "Daily" },
    { id: "7", value: 7, label: "Weekly", price: "$7", period: "Weekly" },
    {
      id: "23",
      value: 23,
      label: "Monthly",
      price: "$23",
      period: "Monthly",
    },
    { id: "65", value: 65, label: "Yearly", price: "$65", period: "Yearly" },
  ],
};

// Get subscription period based on price
export const getSubscriptionPeriod = (price) => {
  if (price === 250 || price === 2) return "Daily";
  if (price === 850 || price === 7) return "Weekly";
  if (price === 3000 || price === 23) return "Monthly";
  if (price === 8500 || price === 65) return "Yearly";
  return "Weekly";
};

// Get plan name based on price
export const getPlanName = (price) => {
  if (price === 250 || price === 2) return "Daily";
  if (price === 850 || price === 7) return "Weekly";
  if (price === 3000 || price === 23) return "Monthly";
  if (price === 8500 || price === 65) return "Yearly";
  return "Weekly";
};

// Handle user upgrade after successful payment
export const handleUpgrade = async (currentUser, price, setUserData) => {
  try {
    const userDocRef = doc(db, "users", currentUser.email);
    await setDoc(
      userDocRef,
      {
        email: currentUser.email,
        username: currentUser.email,
        isPremium: true,
        subscription: getSubscriptionPeriod(price),
        subDate: new Date().toISOString(),
      },
      { merge: true }
    );
    await getUser(currentUser.email, setUserData);

    Swal.fire({
      title: "Upgrade Successful! 🎉",
      html: `You have upgraded to ${getSubscriptionPeriod(price)} VIP`,
      icon: "success",
      confirmButtonText: "Continue",
    }).then(() => {
      window.location.pathname = "/";
    });
  } catch (error) {
    Swal.fire({
      title: "Error",
      text: error.message,
      icon: "error",
    });
  }
};

// Format phone number for M-Pesa
export const formatPhoneNumber = (phone) => {
  let p = phone.toString().replace(/\D/g, "");

  if (p.startsWith("0")) {
    return "254" + p.substring(1);
  }
  if (p.startsWith("7") || p.startsWith("1")) {
    return "254" + p;
  }
  if (p.startsWith("254")) {
    return p;
  }
  if (phone.toString().startsWith("+")) {
    return p;
  }
  return p;
};

// Validate Kenyan phone number
export const isValidPhoneNumber = (phone) => {
  let p = phone.toString().replace(/\D/g, "");

  const isValidKenyan =
    (p.length === 10 && (p.startsWith("07") || p.startsWith("01"))) ||
    (p.length === 12 && p.startsWith("254")) ||
    (p.length === 9 && (p.startsWith("7") || p.startsWith("1")));

  return isValidKenyan;
};

// Generate random email (fallback)
export const generateRandomEmail = () => {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const domains = ["gmail.com", "yahoo.com", "outlook.com"];

  let username = "";
  const usernameLength = Math.floor(Math.random() * 5) + 8;

  for (let i = 0; i < usernameLength; i++) {
    if (i < 6) {
      username += letters.charAt(Math.floor(Math.random() * letters.length));
    } else {
      if (Math.random() < 0.6) {
        username += letters.charAt(Math.floor(Math.random() * letters.length));
      } else {
        username += numbers.charAt(Math.floor(Math.random() * numbers.length));
      }
    }
  }

  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username}@${domain}`;
};

// Get default plan for payment type
export const getDefaultPlan = (paymentType) => {
  if (paymentType === "crypto" || paymentType === "paypal") {
    return SUBSCRIPTION_PLANS.dollars[0];
  }
  return SUBSCRIPTION_PLANS.shillings[0];
};
