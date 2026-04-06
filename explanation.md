# IIEST E-Gate Pass System - Presentation Guide

This document provides a comprehensive overview of the IIEST E-Gate Pass System. Use this guide to explain the architecture, technologies, and features of the application during your presentation.

## 1. Project Overview & Problem Statement
The IIEST E-Gate Pass System is a full-stack mobile application designed to digitize and secure the visitor management process on campus. Instead of using manual paper registers, the app provides a seamless and secure digital workflow to track visitors, verify approvals, and log entries and exits.

## 2. Technology Stack

### Frontend (User Interface)
* **React Native & Expo:** Used to build a cross-platform mobile app (Android and iOS) from a single JavaScript codebase. Expo accelerates development with built-in modules.
* **React Navigation:** Handles smooth transitions between different screens (Dashboards, QR Scanner, Forms).
* **Context API (`AuthContext`):** Manages the global state of the application, specifically keeping track of the logged-in user and their role across the app.
* **Axios:** A promise-based HTTP client used to seamlessly communicate with the backend APIs.
* **Expo Camera & Image Picker:** Used for capturing live photos of visitors at the gate and scanning QR codes natively.
* **SecureStore:** Safely stores JWT authentication tokens on the device so the user doesn't have to log in every time.

### Backend (Server & API)
* **Node.js & Express.js:** A fast and lightweight JavaScript framework used to build RESTful APIs that handle business logic.
* **PostgreSQL (with `pg`):** A powerful relational database used to store users, visitors, and visit requests securely. It ensures data integrity through structured tables and foreign keys.
* **JSON Web Tokens (JWT) & bcrypt:** Used for secure authentication. Passwords are encrypted (hashed) in the database using bcrypt. JWT is used for stateless session management.
* **Multer:** A middleware used to handle `multipart/form-data`, enabling the robust upload and local storage of visitor photos.
* **Node-Cron:** A task scheduler running in the background to automatically expire gate passes and pending requests after their valid timeframe.

## 3. Architecture & Core Workflow (Role-Based Access)

The application implements **Role-Based Access Control (RBAC)** to ensure users only see what they are authorized to see:

1. **Guard Role:**
   * Stationed at the gate, guards initiate a **Visit Request**.
   * They capture the visitor's live photo using the device camera (`Expo Image Picker`).
   * They select the Staff/Professor the visitor wants to meet.

2. **Staff/Professor Role:**
   * The selected staff member receives the request on their dashboard.
   * They review the visitor details (including the photo) and can securely **Approve** or **Reject** the request with an optional message and validity duration.

3. **QR Code Verification & Gate Pass:**
   * Once approved, the system generates a secure **Gate Pass** in the form of a QR code.
   * When the visitor leaves (or enters), the Guard uses the **QR Scanner** (`Expo Camera`) to scan the pass, instantly verifying its authenticity and validity in real-time.

4. **Admin Role:**
   * Admins have a broader view, allowing them to manage users, view all gate pass histories, and monitor campus security comprehensively.

## 4. Notable Engineering Features to Highlight
* **Dynamic Network Resolution:** The mobile app's API connection dynamically detects the correct local server IP address using `Expo Constants`. This means the app works seamlessly across different Wi-Fi networks (like switching from home Wi-Fi to College Wi-Fi) without needing any code changes.
* **Real-time Photo Rendering:** Uploaded visitor photos are stored securely on the backend server and served as static URLs. The frontend dynamically constructs absolute URLs to render these images smoothly across the various dashboards.
* **Auto-Expiration Engine:** A backend cron job runs every minute, automatically checking and expiring gate passes that have passed their valid duration, ensuring that outdated passes cannot be reused.
* **Secure API Endpoints:** Every sensitive API endpoint is protected by an authentication middleware that verifies the JWT token, and a role-checking middleware to prevent unprivileged access (e.g., stopping a student from approving their own gate pass).

## 5. Live Demo Script (What to say to Sir!)

Here is the exact step-by-step flow you should follow when presenting to Sir.

### Step 1: The Introduction (1-2 minutes)
* **What to do:** Have the app open on your phone or emulator, ready on the Login screen.
* **What to say:** "Good morning/afternoon Sir. Today I am presenting the IIEST E-Gate Pass System. The main problem we face currently is that visitor management is manual, paper-based, and hard to track. I built this full-stack mobile application to digitize the entire process. It ensures secure entry, live photo tracking, and real-time approvals from staff."

### Step 2: Explain the Tech Stack briefly (1 minute)
* **What to say:** "Before I show the demo, to build this I used **React Native and Expo** for the mobile frontend, meaning this app works on both Android and iOS. For the backend server, I used **Node.js with Express**, and the data is stored securely in a **PostgreSQL** database. I also implemented JWT (JSON Web Tokens) for secure logins."

### Step 3: The Guard's View - Creating a Request (2 minutes)
* **What to do:** Log into the app using a **Guard** account. Go to "Create Visit Request".
* **What to say:** "Let's assume a visitor arrives at the college gate. The Guard opens the app and enters the visitor's details. (Type in a test name and phone number). A key security feature I added is the live photo capture."
* **What to do:** Click the camera button, capture a photo (or use gallery for demo), and select a specific Staff member (e.g., Prof. Smith). Click Submit.
* **What to say:** "The guard selects which professor the visitor wants to meet and submits the request. The backend securely saves this information and the image."

### Step 4: The Staff's View - Approving the Request (2 minutes)
* **What to do:** Log out of the Guard account. Log in using the **Staff** account you just selected.
* **What to say:** "Now, let's switch to the Professor's point of view. They receive a notification that someone is at the gate. When they open their Staff Dashboard, they can see the pending request."
* **What to do:** Show the pending request on the Staff Dashboard. Point out the dynamically loaded visitor photo.
* **What to say:** "The professor can see exactly who is at the gate because of the live photo. I engineered the app to dynamically resolve IP addresses so images load perfectly on the college Wi-Fi. The professor can now Approve or Reject this request."
* **What to do:** Click **Approve** and set a validity of a few hours.

### Step 5: The Gate Pass and QR Scanning (2 minutes)
* **What to do:** Log out and log back in as the **Guard** (or Admin). Go to the approved request and generate/view the Gate Pass.
* **What to say:** "Once approved, the system generates a secure digital Gate Pass with a QR code for the visitor."
* **What to do:** Open the **QR Scanner** in the app (from the Guard's dashboard). Scan a test QR code if possible, or explain how it works.
* **What to say:** "When the visitor enters or leaves, the Guard simply scans this QR code using the app's built-in camera. The backend verifies the pass instantly. I also added a background cron job on the server that automatically expires passes if they exceed their valid time limits."

### Step 6: The Conclusion
* **What to say:** "To summarize, this app replaces paper registers with a secure, trackable, role-based digital system. Thank you, Sir, I am happy to answer any questions or show you the code for how I handled the image uploads or API requests."

## 6. Backend Codebase Structure (Quick Reference)

If your professor asks you about where specific things are happening in your backend code, here is a quick cheat sheet of what every major file does:

### Main Entry Point
* `server.js`: The heart of the backend. It starts the server, connects all the routes, sets up the auto-expiration cron job, and configures external access.
  * **Core Logic:** Uses `express.json()` to parse bodies, maps URL paths to route files (e.g. `app.use('/api/visits', visitRoutes)`), and runs a continuously looping `cron.schedule()` to `UPDATE` expired passes in the PostgreSQL DB every minute.

### 1. Controllers (`/backend/controllers/`)
Controllers hold the actual "business logic" (the heavy lifting) of your application.
* `authController.js`: Handles user login, registration, and password hashing.
  * **Core Logic:** On login, uses `bcrypt.compare()` to check the password against the database hash. If true, generates a secure token string using `jwt.sign()` containing the user's ID and role.
* `visitController.js`: Manages standard guest visits. It creates requests, assigns them to staff, and handles Staff Approval/Rejection.
  * **Core Logic:** On creation, it runs an `INSERT INTO visitors` SQL query (saving the uploaded image path). It then triggers `sendPushNotification()` to alert the assigned professor. On approval, it sets the status to `'approved'` and saves a `valid_until` timestamp.
* `generalVisitController.js`: A lighter version of visit checks, used for bulk visits like school tours or generic bank visits that don't need a specific professor's approval.
* `gatePassController.js`: The most important file for security! It generates the QR Codes and contains the logic for verifying if a pass is still valid when scanned by the Guard.
  * **Core Logic:** When generating a pass, it creates a unique string `pass_${requestId}_${Date.now()}` and saves it to the DB. When verifying, it runs a `SELECT` query searching for this exact string. If the current time is past the `valid_until` timestamp, it rejects the scan as "expired".
* `userController.js`: Used by the Admin to approve new staff/guard registrations, deactivate users, and list all users.
* `dashboardController.js`: Provides all the statistics, charts, and numbers seen on the dashboards (e.g., how many pending passes exist today).
  * **Core Logic:** Uses SQL aggregate queries like `COUNT(*)` to rapidly sum up the active passes or pending requests, grouping them by day to display clean metrics to the frontend.
* `notificationController.js`: Gets and counts the unread push notifications for users.

### 2. Routes (`/backend/routes/`)
Routes define the URL endpoints (like `/api/visits`) and connect them to the correct Controller function. They also act as the gatekeepers by enforcing the middleware.
* Each controller has a matching route file (e.g. `visitRoutes.js` points to `visitController.js`).
* **Example:** In `visitRoutes.js`, you'll see a line like `router.post('/', authenticate, roleCheck('guard'), upload.single('photo'), visitController.createVisitRequest);`. 
  * **Core Logic Pipeline:** This one line dictates that to create a visit, the backend runs 4 sequential steps: 
    1. Check JWT token (`authenticate`).
    2. Check if the user is a Guard (`roleCheck`).
    3. Save the image to disk (`upload.single`).
    4. Finally, run the database INSERT query (`visitController`).

### 3. Middleware (`/backend/middleware/`)
Middleware are functions that run *before* the request reaches the controller. Think of them as security checkpoints.
* `auth.js`: The bouncer. 
  * **Core Logic:** Extracts the `Bearer` token from the HTTP headers, uses `jwt.verify()` to securely decode it, and attaches the `req.user` payload so the controller knows who is calling the API.
* `roleCheck.js`: The VIP list.
  * **Core Logic:** Returns a 403 Forbidden HTTP error if `req.user.role` does not match the allowed roles parameter passed in the route.
* `upload.js`: The baggage check.
  * **Core Logic:** Uses `multer.diskStorage()` to define where a photo is saved. Uses `uuidv4()` to instantly generate a random filename, preventing two photos from overwriting each other.
* `errorHandler.js`: Catches any software crashes or database errors and sends a clean JSON message back to the app instead of freezing it.

### 4. Utilities (`/backend/utils/`)
* `qrGenerator.js`: Turns data into an encrypted QR code string.
* `pushNotification.js`: Communicates with Expo's servers to send the buzzing pop-up notifications to the professors' phones.
  * **Core Logic:** Performs a fast `fetch` request sending JSON payloads to `https://exp.host/--/api/v2/push/send`.
* `activityLogger.js`: Keeps a silent ledger/history of every action taken in the app for security audits.
