import React, { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    // Nav
    home: 'Home',
    orders: 'Orders',
    disputes: 'Disputes',
    profile: 'Profile',

    // Profile page
    accountInfo: 'Account Info',
    phone: 'Phone',
    name: 'Name',
    email: 'Email',
    userId: 'User ID',
    notifications: 'Notifications',
    savedAddresses: 'Saved Addresses',
    myDisputes: 'My Disputes',
    helpSupport: 'Help & Support',
    privacyPolicy: 'Privacy Policy',
    signOut: 'Sign Out',
    appearance: 'Appearance',
    language: 'Language',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    settings: 'Settings',

    // Login
    welcomeBack: 'Welcome back',
    enterMobile: 'Enter your mobile number to continue',
    mobileNumber: 'Mobile Number',
    sendOtp: 'Send OTP',
    sending: 'Sending…',
    enterOtp: 'Enter OTP',
    sentTo: 'Sent to',
    sixDigitOtp: '6-digit OTP',
    verifyLogin: 'Verify & Login',
    verifying: 'Verifying…',
    back: '← Back',
    terms: 'By continuing you agree to our Terms of Service',
    invalidPhone: 'Enter a valid 10-digit mobile number',
    enterSixDigit: 'Enter the 6-digit OTP',
    sessionExpired: 'Session expired. Please go back and request a new OTP.',

    // Home
    recentOrders: 'Recent Orders',
    activeOrders: 'Active Orders',
    noOrders: 'No orders yet',
    placeFirstOrder: 'Place your first order',
    placeOrder: 'Place Order',
    viewAll: 'View All',

    // Orders
    myOrders: 'My Orders',
    orderDetails: 'Order Details',
    tracking: 'Tracking',
    route: 'Route',
    items: 'Items',
    billing: 'Billing',
    cancelOrder: 'Cancel Order',
    confirmCancel: 'Confirm Cancel',
    cancelling: 'Cancelling…',
    reason: 'Reason',
    whyCancelling: 'Why are you cancelling?',
    riderHere: '🛵 Rider is here!',
    showPickupOtp: 'Show your pickup OTP to the rider (or enter theirs below to confirm handover).',
    confirm: 'Confirm',
    baseFare: 'Base Fare',
    discount: 'Discount',
    total: 'Total',
    pickup: 'Pickup',
    drop: 'Drop',
    orderPlaced: 'Order Placed',
    orderReceived: 'Your order has been received',
    readyPickup: 'Ready for Pickup',
    riderHeading: 'Rider is assigned and heading to you',
    outDelivery: 'Out for Delivery',
    parcelPickedUp: 'Parcel picked up, en route to receiver',
    delivered: 'Delivered',
    parcelDelivered: 'Parcel delivered successfully',
    all: 'All',
    onTheWay: 'On the Way',
    cancelled: 'Cancelled',
    draft: 'Draft',
    placed: 'Placed',
    ready: 'Ready',
    orderNotFound: 'Order not found',

    // Addresses
    savedAddressesTitle: 'Saved Addresses',
    newAddress: 'New Address',
    editAddress: 'Edit Address',
    addAddress: 'Add Address',
    noAddresses: 'No saved addresses',
    saveAddressHint: 'Save addresses for faster order placement',
    label: 'Label (Home / Work)',
    building: 'Building / Flat',
    street: 'Street *',
    area: 'Area / Locality',
    city: 'City *',
    state: 'State',
    pinCode: 'PIN Code',
    contactPerson: 'Contact Person',
    contactNumber: 'Contact Number',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    remove: 'Remove',
    edit: 'Edit',
    setPickup: 'Pickup',
    setDrop: 'Drop',
    pickLocationMap: 'Pick Location on Map',
    locationSet: 'Location set',
    streetCityRequired: '⚠ Street and city are required',

    // Misc
    version: 'Bhada Delivery v2.3.0',
    noOrdersYet: 'No orders',
  },

  hi: {
    // Nav
    home: 'होम',
    orders: 'ऑर्डर',
    disputes: 'विवाद',
    profile: 'प्रोफ़ाइल',

    // Profile page
    accountInfo: 'खाता जानकारी',
    phone: 'फ़ोन',
    name: 'नाम',
    email: 'ईमेल',
    userId: 'यूज़र ID',
    notifications: 'सूचनाएँ',
    savedAddresses: 'सहेजे पते',
    myDisputes: 'मेरे विवाद',
    helpSupport: 'सहायता',
    privacyPolicy: 'गोपनीयता नीति',
    signOut: 'साइन आउट',
    appearance: 'दिखावट',
    language: 'भाषा',
    darkMode: 'डार्क मोड',
    lightMode: 'लाइट मोड',
    settings: 'सेटिंग्स',

    // Login
    welcomeBack: 'वापस स्वागत है',
    enterMobile: 'जारी रखने के लिए मोबाइल नंबर दर्ज करें',
    mobileNumber: 'मोबाइल नंबर',
    sendOtp: 'OTP भेजें',
    sending: 'भेजा जा रहा है…',
    enterOtp: 'OTP दर्ज करें',
    sentTo: 'भेजा गया',
    sixDigitOtp: '6 अंकों का OTP',
    verifyLogin: 'सत्यापित करें & लॉगिन',
    verifying: 'सत्यापित हो रहा है…',
    back: '← वापस',
    terms: 'जारी रखकर आप हमारी सेवा शर्तों से सहमत होते हैं',
    invalidPhone: 'वैध 10 अंकों का मोबाइल नंबर दर्ज करें',
    enterSixDigit: '6 अंकों का OTP दर्ज करें',
    sessionExpired: 'सत्र समाप्त हो गया। वापस जाएं और नया OTP मांगें।',

    // Home
    recentOrders: 'हाल के ऑर्डर',
    activeOrders: 'सक्रिय ऑर्डर',
    noOrders: 'अभी तक कोई ऑर्डर नहीं',
    placeFirstOrder: 'अपना पहला ऑर्डर दें',
    placeOrder: 'ऑर्डर दें',
    viewAll: 'सभी देखें',

    // Orders
    myOrders: 'मेरे ऑर्डर',
    orderDetails: 'ऑर्डर विवरण',
    tracking: 'ट्रैकिंग',
    route: 'रूट',
    items: 'वस्तुएं',
    billing: 'बिलिंग',
    cancelOrder: 'ऑर्डर रद्द करें',
    confirmCancel: 'रद्द करने की पुष्टि करें',
    cancelling: 'रद्द हो रहा है…',
    reason: 'कारण',
    whyCancelling: 'रद्द क्यों कर रहे हैं?',
    riderHere: '🛵 राइडर आ गया है!',
    showPickupOtp: 'राइडर को पिकअप OTP दिखाएं (या हैंडओवर की पुष्टि के लिए उनका OTP दर्ज करें)।',
    confirm: 'पुष्टि करें',
    baseFare: 'आधार किराया',
    discount: 'छूट',
    total: 'कुल',
    pickup: 'पिकअप',
    drop: 'ड्रॉप',
    orderPlaced: 'ऑर्डर दिया गया',
    orderReceived: 'आपका ऑर्डर प्राप्त हो गया है',
    readyPickup: 'पिकअप के लिए तैयार',
    riderHeading: 'राइडर असाइन हो गया है और आपकी ओर आ रहा है',
    outDelivery: 'डिलीवरी पर है',
    parcelPickedUp: 'पार्सल उठा लिया, प्राप्तकर्ता की ओर जा रहा है',
    delivered: 'डिलीवर हो गया',
    parcelDelivered: 'पार्सल सफलतापूर्वक डिलीवर हो गया',
    all: 'सभी',
    onTheWay: 'रास्ते में',
    cancelled: 'रद्द',
    draft: 'ड्राफ्ट',
    placed: 'दिया गया',
    ready: 'तैयार',
    orderNotFound: 'ऑर्डर नहीं मिला',

    // Addresses
    savedAddressesTitle: 'सहेजे हुए पते',
    newAddress: 'नया पता',
    editAddress: 'पता संपादित करें',
    addAddress: 'पता जोड़ें',
    noAddresses: 'कोई सहेजा पता नहीं',
    saveAddressHint: 'तेज़ ऑर्डर के लिए पते सहेजें',
    label: 'लेबल (घर / काम)',
    building: 'भवन / फ्लैट',
    street: 'सड़क *',
    area: 'क्षेत्र / इलाका',
    city: 'शहर *',
    state: 'राज्य',
    pinCode: 'पिन कोड',
    contactPerson: 'संपर्क व्यक्ति',
    contactNumber: 'संपर्क नंबर',
    save: 'सहेजें',
    saving: 'सहेजा जा रहा है…',
    cancel: 'रद्द करें',
    remove: 'हटाएं',
    edit: 'संपादित करें',
    setPickup: 'पिकअप',
    setDrop: 'ड्रॉप',
    pickLocationMap: 'मानचित्र पर स्थान चुनें',
    locationSet: 'स्थान सेट है',
    streetCityRequired: '⚠ सड़क और शहर आवश्यक हैं',

    // Misc
    version: 'भाड़ा डिलीवरी v2.3.0',
    noOrdersYet: 'कोई ऑर्डर नहीं',
  },
};

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  const t = (key) => translations[lang]?.[key] ?? translations['en']?.[key] ?? key;

  return (
    <LangContext.Provider value={{ lang, changeLang, t, isHindi: lang === 'hi' }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be inside LangProvider');
  return ctx;
};