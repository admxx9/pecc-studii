
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
// import { auth as adminAuth } from 'firebase-admin'; // ** FOR FUTURE: Use Admin SDK for server-side auth verification **

// ** FOR FUTURE: Initialize Firebase Admin SDK **
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert({ // Load credentials from environment variables or file
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
//     }),
//   });
// }

export async function GET(
  request: NextRequest,
  { params }: { params: { toolId: string } }
) {
  const toolId = params.toolId;

  if (!toolId) {
    return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
  }

  // ** PLACEHOLDER FOR SERVER-SIDE AUTHENTICATION & PREMIUM CHECK **
  // In a real-world secure scenario, you would:
  // 1. Get the user's session/token from the request (e.g., cookies, Authorization header).
  // 2. Verify the token using Firebase Admin SDK (adminAuth.verifyIdToken() or verifySessionCookie()).
  // 3. Get the user's UID from the verified token.
  // 4. Fetch the user's profile from Firestore using the UID.
  // 5. Check if userProfile.isPremium is true and matches the tool's requiredPlan.
  // 6. If not authorized, return a 403 Forbidden error.

  // --- Start Placeholder ---
  const isUserAuthorized = true; // ** Replace with actual server-side check later **
  if (!isUserAuthorized) {
     console.warn(`Unauthorized download attempt for tool ${toolId} (Placeholder check)`);
     return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
   // --- End Placeholder ---


  if (!db) {
    console.error("Firestore not initialized for API route");
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const toolDocRef = doc(db, 'tools', toolId);
    const toolSnap = await getDoc(toolDocRef);

    if (!toolSnap.exists()) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    const toolData = toolSnap.data();
    const downloadUrl = toolData?.downloadUrl;

    if (!downloadUrl) {
      console.error(`Download URL missing for tool ${toolId}`);
      return NextResponse.json({ error: 'Download link unavailable for this tool' }, { status: 500 });
    }

    // Return the secure download URL
    return NextResponse.json({ downloadUrl });

  } catch (error: any) {
    console.error(`Error fetching download URL for tool ${toolId}:`, error);
    return NextResponse.json({ error: 'Failed to retrieve download link' }, { status: 500 });
  }
}
