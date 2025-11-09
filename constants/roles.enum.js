// KEY : VALUE

// Admin Roles
const AdminRoles = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  CHIEF_MANAGER: "CHIEF_MANAGER",
  SHIPPER_MANAGER: "SHIPPER_MANAGER",
  STORE_MANAGER: "STORE_MANAGER",
  CUSTOMER_MANAGER: "CUSTOMER_MANAGER",
  HR_MANAGER: "HR_MANAGER",
  SYSTEM_MANAGER: "SYSTEM_MANAGER",
});

// Store Roles
const StoreRoles = Object.freeze({
  STORE_OWNER: "STORE_OWNER",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
});

module.exports = {
  AdminRoles,
  StoreRoles,
};
