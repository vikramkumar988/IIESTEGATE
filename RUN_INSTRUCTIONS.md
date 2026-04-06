# IIEST E-Gate Pass - Demo Instructions

Follow these exact steps to run your application tomorrow for the professor without any errors! Have a great demo! 🚀

### Step 1: Start the Backend Server
1. Open a terminal in VS Code.
2. Navigate to the backend folder:
   ```bash
   cd backend
   ```
3. Start the server:
   ```bash
   npm start
   ```
   *You should see a message saying "🚀 IIEST E-Gate Pass Server running on port 3000". Leave this terminal open and running.*

### Step 2: Start the Mobile App
1. Open a **second** terminal in VS Code (click the `+` icon or split the terminal).
2. Navigate to the mobile folder:
   ```bash
   cd mobile
   ```
3. Start the Expo bundler:
   ```bash
   npx expo start -c
   ```
   *Note: I added `-c` to clear the cache, which ensures there are absolutely no weird glitches from the previous day.*

### Step 3: Connect Your Phone
1. Make sure your phone and your laptop are connected to the **SAME Wi-Fi network** (e.g., your mobile hotspot or the college Wi-Fi).
2. Open the **Expo Go** app on your phone.
3. Scan the QR code that appeared in your second VS Code terminal.
   * If on Android: Use the Expo Go app's built-in scanner.
   * If on iPhone: Use the standard Camera app to scan the QR code.

### 💡 What I Fixed So It Works Tomorrow:
Previously, the mobile app was hardcoded to connect to your current home IP address (`http://10.224.241.11:3000`). When you go to college tomorrow, your laptop will get a completely different IP address on the college Wi-Fi, which would cause the "login failed" error you mentioned! 

**I have rewritten `mobile/src/services/api.js` to automatically detect your laptop's IP address from Expo.**

Now, you don't need to change any IP addresses tomorrow. Just connect your laptop and phone to the same Wi-Fi, run the two commands above, and it will work perfectly!

### Troubleshooting
* **App doesn't load after scanning QR?** Ensure your laptop firewall isn't blocking Expo (you can temporarily turn it off for the demo) and double-check you are on the same Wi-Fi.
* **Database error?** Make sure PostgreSQL is running on your laptop in the background (usually it runs automatically on startup).
