/* eslint-env jest */

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-config', () => ({
  FIREBASE_API_KEY: 'test',
  FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'test',
  FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: 'test',
  FIREBASE_APP_ID: 'test',
  GOOGLE_WEB_CLIENT_ID: 'test.apps.googleusercontent.com',
}));

jest.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: () => ({}),
}));

jest.mock('firebase/auth', () => {
  const mockFunction = jest.fn();
  return new Proxy(
    {
      __esModule: true,
      initializeAuth: () => ({ currentUser: null }),
      getAuth: () => ({ currentUser: null }),
      onAuthStateChanged: (_auth, callback) => {
        callback(null);
        return jest.fn();
      },
    },
    {
      get: (target, property) =>
        property in target ? target[property] : mockFunction,
    }
  );
});

jest.mock('firebase/firestore', () => {
  const mockFunction = jest.fn();
  return new Proxy(
    {
      __esModule: true,
      getFirestore: () => ({}),
      Timestamp: {
        now: () => ({ toMillis: () => Date.now() }),
        fromDate: (date) => ({ toDate: () => date, toMillis: () => date.getTime() }),
      },
    },
    {
      get: (target, property) =>
        property in target ? target[property] : mockFunction,
    }
  );
});

jest.mock('firebase/storage', () => {
  const mockFunction = jest.fn();
  return new Proxy(
    { __esModule: true, getStorage: () => ({}) },
    {
      get: (target, property) =>
        property in target ? target[property] : mockFunction,
    }
  );
});

jest.mock('@firebase/auth/dist/rn/index.js', () => ({
  getReactNativePersistence: () => ({}),
}), { virtual: true });

jest.mock('react-native-geolocation-service', () => ({
  requestAuthorization: jest.fn().mockResolvedValue('denied'),
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    getTokens: jest.fn(),
  },
}));

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: null,
  onAuthStateChanged: jest.fn((callback) => {
    callback(null);
    return jest.fn();
  }),
}));

jest.mock('@react-native-firebase/messaging', () => {
  const mockMessaging = () => ({
    requestPermission: jest.fn(),
    registerDeviceForRemoteMessages: jest.fn(),
    getToken: jest.fn(),
    deleteToken: jest.fn(),
    onTokenRefresh: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn().mockResolvedValue(null),
  });
  mockMessaging.AuthorizationStatus = {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  return mockMessaging;
});

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {},
}));
