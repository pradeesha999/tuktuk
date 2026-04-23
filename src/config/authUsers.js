const defaultUsers = [
  {
    username: "hqadmin",
    password: "hqadmin123",
    role: "HQ_ADMIN"
  },
  {
    username: "province_user",
    password: "province123",
    role: "PROVINCE_ADMIN"
  },
  {
    username: "district_user",
    password: "district123",
    role: "DISTRICT_OFFICER"
  },
  {
    username: "station_user",
    password: "station123",
    role: "STATION_OFFICER"
  },
  {
    username: "device_user",
    password: "device123",
    role: "DEVICE"
  }
];

export const getAuthUsers = () => {
  if (!process.env.AUTH_USERS) {
    return defaultUsers;
  }

  try {
    const parsed = JSON.parse(process.env.AUTH_USERS);
    return Array.isArray(parsed) ? parsed : defaultUsers;
  } catch (_error) {
    return defaultUsers;
  }
};
