import { ZoomAccount } from '../entities';

const crypto = require('crypto');

/**
 * Generate a Zoom Web SDK JWT signature.
 * Docs: https://developers.zoom.us/docs/meeting-sdk/auth/
 *
 * @param sdkKey - Zoom SDK Key (from SDK app)
 * @param sdkSecret - Zoom SDK Secret
 * @param meetingNumber - The Zoom meeting ID
 * @param role - 0 for attendee, 1 for host
 * @param expSeconds - Token expiry in seconds (default 1 hour)
 */
export function generateZoomSignature(
  sdkKey: string,
  sdkSecret: string,
  meetingNumber: string,
  role: 0 | 1,
  expSeconds = 3600
): string {
  const iat = Math.round(Date.now() / 1000) - 30;
  const exp = iat + expSeconds;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sdkKey,
    appKey: sdkKey,
    mn: meetingNumber,
    role,
    iat,
    exp,
    tokenExp: exp,
  };

  const encodingHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodingPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const msg = `${encodingHeader}.${encodingPayload}`;
  const signature = crypto.createHmac('sha256', sdkSecret).update(msg).digest('base64url');

  return `${msg}.${signature}`;
}

/**
 * Return the Zoom meeting details stored in a booking,
 * enriched with a valid Web SDK signature for embedding.
 */
export interface ZoomEmbedData {
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
  signature: string;
  sdkKey: string;
}

/**
 * Build embed data for a booking using the Zoom account's SDK credentials.
 */
export function buildZoomEmbedData(
  booking: {
    zoomMeetingId: string;
    zoomPassword: string;
    zoomAccountId: string;
  },
  zoomAccount: {
    zoomAccountId: string;
    zoomClientId: string;
    zoomClientSecret: string;
  },
  userName: string,
  userEmail: string,
  role: 0 | 1 = 0
): ZoomEmbedData {
  if (!zoomAccount.zoomClientId || !zoomAccount.zoomClientSecret) {
    throw new Error('SDK credentials not configured for this Zoom account');
  }

  const signature = generateZoomSignature(
    zoomAccount.zoomClientId,
    zoomAccount.zoomClientSecret,
    booking.zoomMeetingId,
    role
  );

  return {
    meetingNumber: booking.zoomMeetingId,
    password: booking.zoomPassword,
    userName,
    userEmail,
    signature,
    sdkKey: zoomAccount.zoomClientId,
  };
}
