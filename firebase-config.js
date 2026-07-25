// 1. Go to https://console.firebase.google.com -> your project -> Project settings (gear icon)
// 2. Scroll to "Your apps" -> add a Web app (</>) if you haven't already
// 3. Copy the firebaseConfig object it gives you and paste the values below.
// 4. Make sure Realtime Database + Anonymous Authentication are enabled (see setup notes).

const firebaseConfig = {
  apiKey: "AIzaSyBT8TZ9o6fgda0_3xLNmjn9i2ziEZCO3dE",
  authDomain: "fadetactoe.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "fadetactoe",
  storageBucket: "fadetactoe.firebasestorage.app",
  messagingSenderId: "300507040620",
  appId: "1:300507040620:web:46983c997b01a8db848149"
};

firebase.initializeApp(firebaseConfig);
