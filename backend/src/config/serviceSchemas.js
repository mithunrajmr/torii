// backend/src/config/serviceSchemas.js
// Centralized, configuration-driven registry of all branch services supported by TORII.
// Adding a new service in the future requires adding a schema entry here—no code rewrites needed.

export const SERVICE_REGISTRY = {
  FULL_KYC: {
    serviceType: "FULL_KYC",
    title: "Full CKYC / Re-KYC Application",
    description: "Complete identity, address, & signature re-verification",
    documentSlots: [
      { id: "pan_card", label: "PAN Card", required: true, type: "PAN" },
      { id: "aadhaar_front", label: "Aadhaar Front", required: true, type: "Aadhaar" },
      { id: "aadhaar_back", label: "Aadhaar Back", required: true, type: "Aadhaar" },
      { id: "address_proof", label: "Address Proof (Passport/Utility Bill)", required: true, type: "Utility" },
      { id: "selfie", label: "Live Customer Photo", required: true, type: "Selfie" },
    ],
    requiresSignature: true,
    formFields: [
      { id: "full_name", label: "Full Name (as per ID)", type: "text", required: true },
      { id: "dob", label: "Date of Birth", type: "date", required: true },
      { id: "occupation", label: "Occupation", type: "select", options: ["Salaried", "Self-Employed", "Business", "Student", "Retired", "Other"], required: true },
      { id: "annual_income", label: "Annual Income Range", type: "select", options: ["< ₹2.5 Lakhs", "₹2.5L - ₹5L", "₹5L - ₹10L", "₹10L - ₹25L", "> ₹25 Lakhs"], required: true },
      { id: "father_name", label: "Father's / Spouse's Name", type: "text", required: true },
    ],
  },

  ADDRESS_CHANGE: {
    serviceType: "ADDRESS_CHANGE",
    title: "Residential Address Change Request",
    description: "Update official communication address with proof verification",
    documentSlots: [
      { id: "address_proof", label: "Address Proof (Passport/Voter ID/Utility Bill)", required: true, type: "Utility" },
    ],
    requiresSignature: true,
    formFields: [
      { id: "address_line1", label: "Flat / House No., Building Name", type: "text", required: true },
      { id: "address_line2", label: "Street, Area, Landmark", type: "text", required: true },
      { id: "city", label: "City", type: "text", required: true },
      { id: "state", label: "State", type: "text", required: true },
      { id: "pincode", label: "PIN Code (6 digits)", type: "text", pattern: "^[0-9]{6}$", required: true },
    ],
  },

  NOMINEE_UPDATE: {
    serviceType: "NOMINEE_UPDATE",
    title: "Nominee Addition & Modification",
    description: "Register account beneficiary & minor guardian details",
    documentSlots: [
      { id: "nominee_id", label: "Nominee ID Proof (Optional)", required: false, type: "ID" },
    ],
    requiresSignature: true,
    formFields: [
      { id: "nominee_name", label: "Nominee Full Name", type: "text", required: true },
      { id: "relationship", label: "Relationship with Account Holder", type: "select", options: ["Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister", "Other"], required: true },
      { id: "nominee_dob", label: "Nominee Date of Birth", type: "date", required: true },
      { id: "is_minor", label: "Is Nominee a Minor (< 18 years)?", type: "boolean", required: true },
      { id: "guardian_name", label: "Guardian Name (Required if Minor)", type: "text", requiredIf: "is_minor" },
      { id: "guardian_relationship", label: "Guardian Relationship", type: "text", requiredIf: "is_minor" },
    ],
  },

  AADHAAR_LINK: {
    serviceType: "AADHAAR_LINK",
    title: "Aadhaar Linking & NPCI Seeding",
    description: "Link 12-digit Aadhaar for Direct Benefit Transfer (DBT)",
    documentSlots: [
      { id: "aadhaar_front", label: "Aadhaar Card Front", required: true, type: "Aadhaar" },
      { id: "aadhaar_back", label: "Aadhaar Card Back", required: true, type: "Aadhaar" },
    ],
    requiresSignature: true,
    formFields: [
      { id: "aadhaar_number", label: "12-Digit Aadhaar Number", type: "text", pattern: "^[0-9]{12}$", required: true },
      { id: "npci_consent", label: "Consent for NPCI Direct Benefit Transfer Seeding", type: "checkbox", required: true },
    ],
  },

  PAN_LINK: {
    serviceType: "PAN_LINK",
    title: "PAN Linking & Tax Compliance",
    description: "Link 10-char PAN or submit Form 60 declaration",
    documentSlots: [
      { id: "pan_card", label: "PAN Card Image", required: true, type: "PAN" },
    ],
    requiresSignature: false,
    formFields: [
      { id: "pan_number", label: "10-Character PAN Number", type: "text", pattern: "^[A-Z]{5}[0-9]{4}[A-Z]$", required: true },
    ],
  },

  ACCOUNT_UPGRADE: {
    serviceType: "ACCOUNT_UPGRADE",
    title: "Account Upgrade & Service Requests",
    description: "Upgrade account tier, request Debit Card & Chequebook delivery",
    documentSlots: [
      { id: "income_proof", label: "Salary Slip / Income Proof (Optional)", required: false, type: "Income" },
    ],
    requiresSignature: true,
    formFields: [
      { id: "target_tier", label: "Upgrade Tier", type: "select", options: ["Savings Premier", "Salary Priority", "Current Business"], required: true },
      { id: "request_debit_card", label: "Re-issue International Contactless Debit Card", type: "checkbox", required: false },
      { id: "request_chequebook", label: "Deliver 25-Leaf Personalised Chequebook", type: "checkbox", required: false },
    ],
  },

  HIGH_VALUE_CLEARANCE: {
    serviceType: "HIGH_VALUE_CLEARANCE",
    title: "High-Value Transaction Pre-Clearance",
    description: "Pre-clear transactions over ₹50,000 with source of funds documentation",
    documentSlots: [
      { id: "fund_proof", label: "Invoice / Agreement / Sale Deed / Proof of Funds", required: true, type: "Invoice" },
    ],
    requiresSignature: true,
    formFields: [
      { id: "transaction_amount", label: "Expected Transaction Amount (₹)", type: "number", required: true },
      { id: "source_of_funds", label: "Source of Funds Declaration", type: "select", options: ["Salary / Savings", "Property Sale", "Business Revenue", "Investment Redemption", "Inheritance / Gift", "Other"], required: true },
      { id: "beneficiary_name", label: "Recipient / Beneficiary Name", type: "text", required: true },
    ],
  },
};

export default SERVICE_REGISTRY;
