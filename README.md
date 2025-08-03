# STUDIO PECC

STUDIO PECC is an online platform designed to teach game modding. Built with Next.js and Firebase, it provides a structured learning environment with interactive lessons, essential tools, and progress tracking.

## Features

**For Learners:**

*   **User Authentication:** Secure login and registration using Firebase Authentication (Email/Password).
*   **Structured Lessons:** Access a curated list of modding lessons, complete with video tutorials, detailed descriptions, and supplementary materials.
*   **Progress Tracking:** Monitor your learning journey with a visual progress bar and track completed lessons.
*   **Modding Tools:** Browse and download essential modding tools, categorized for easy access (Mapas, Texturas, Scripts, Modelos 3D, Geral).
*   **User Profiles:** View and update your profile, including display name and avatar URL. Track your modding rank as you progress through the lessons.
*   **Notifications:** Stay informed with global announcements or user-specific messages delivered through the in-app notification system. Clickable notifications can take you directly to newly added lessons.

**For Administrators:**

*   **Admin Panel:** A dedicated section for managing the platform's content and users.
*   **Lesson Management:** Easily add, edit, or delete lessons, including titles, descriptions, video URLs, image thumbnails, and support materials.
*   **Tool Management:** Add, edit, or delete modding tools, specifying names, descriptions, download URLs, versions, sizes, and categories.
*   **User Management:** View a list of all registered users, their ranks, progress percentage, and admin status. Admins can also delete user data from Firestore.
*   **Notification System:** Send targeted notifications to all users (global) or specific users via their email address. Notifications can be categorized by urgency (Info, Success, Warning, Urgent) and include links to relevant content like new lessons.

## Technology Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **Backend/Database:** Firebase (Authentication, Firestore)
*   **UI:** ShadCN/UI, Tailwind CSS
*   **Icons:** Lucide React
*   **State Management:** React Hooks (useState, useEffect, useContext)
*   **Forms:** React Hook Form, Zod (for validation)

## Getting Started

*(Instructions for local setup would go here if applicable)*

1.  Ensure you have Node.js and npm/yarn installed.
2.  Set up a Firebase project and obtain your configuration keys.
3.  Create a `.env.local` file in the root directory and add your Firebase credentials:
    ```dotenv
    NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
    MERCADOPAGO_ACCESS_TOKEN=YOUR_MERCADOPAGO_ACCESS_TOKEN # Add Mercado Pago token
    NEXT_PUBLIC_APP_URL=http://localhost:9002 # Example URL for development
    ```
4.  Install dependencies: `npm install` or `yarn install`
5.  Run the development server: `npm run dev` or `yarn dev`
6.  Open [http://localhost:9002](http://localhost:9002) (or your specified port) in your browser.

**To become an Admin:**

1.  Sign up for an account in the application.
2.  Go to your Firebase Console -> Firestore Database.
3.  Create a `users` collection if it doesn't exist.
4.  Create a document within the `users` collection. The Document ID should be the **Firebase Authentication UID** of the user you want to make an admin.
5.  Add the following fields to the user's document:
    *   `displayName` (string): The user's display name
    *   `email` (string): The user's email
    *   `rank` (string): Set to `iniciante` initially
    *   `isAdmin` (boolean): Set this field to `true`
    *   `photoURL` (string): Can be null or a URL to an avatar image
    *   `createdAt` (timestamp): Add a timestamp field
6.  Log out and log back into the application for the changes to take effect.

This is a test for the AI
//This change is a test for the push