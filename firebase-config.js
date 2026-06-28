window.giftRegistryFirebase = {
  config: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
};

window.giftRegistryFirebase.isConfigured = Object.values(window.giftRegistryFirebase.config).every(Boolean);
