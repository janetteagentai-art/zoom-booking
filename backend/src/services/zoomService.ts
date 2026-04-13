import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Zoom Server-to-Server OAuth
// Docs: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
// ─────────────────────────────────────────────────────────────────────────────

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface ZoomMeetingResponse {
  id: number;
  uuid: string;
  host_id: string;
  host_email: string;
  topic: string;
  type: number;
  status: string;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  start_url: string;
  join_url: string;
  password: string;
  settings: {
    host_video: boolean;
    participant_video: boolean;
    embed_password: boolean;
  };
}

export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

class ZoomService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  // Per-instance credentials (for account-specific zoom accounts)
  constructor(private credentials?: ZoomCredentials) {}

  private get accountId(): string {
    return this.credentials?.accountId || process.env.ZOOM_ACCOUNT_ID || '';
  }

  private get clientId(): string {
    return this.credentials?.clientId || process.env.ZOOM_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return this.credentials?.clientSecret || process.env.ZOOM_CLIENT_SECRET || '';
  }

  get isConfigured(): boolean {
    return !!(this.accountId && this.clientId && this.clientSecret);
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    if (!this.isConfigured) {
      throw new Error('Zoom credentials not configured');
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');

    const response = await axios.post<ZoomTokenResponse>(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.accountId}`,
      null,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    this.accessToken = response.data.access_token;
    // Zoom tokens expire in 1h, cache with 5min buffer
    this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;

    return this.accessToken!;
  }

  async createMeeting(params: {
    topic: string;
    startTime: Date;
    durationMinutes: number;
    hostEmail?: string;
    password?: string;
  }): Promise<ZoomMeetingResponse> {
    // Reset token cache when using per-account credentials
    if (this.credentials) {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
    }
    const token = await this.getAccessToken();

    const startISO = params.startTime.toISOString().replace('.000Z', 'Z');

    // Don't specify timezone when sending UTC - Zoom will use the UTC time as-is.
    // Previously we sent timezone: 'America/Buenos_Aires' which caused Zoom to add 3 hours
    // because it interpreted the UTC time as if it were ART.
    const meetingPayload = {
      topic: params.topic,
      type: 2, // scheduled meeting
      start_time: startISO,
      duration: params.durationMinutes,
      password: params.password || undefined,
      settings: {
        host_video: true,
        participant_video: true,
        embed_password: true,
        waiting_room: true,
        auto_recording: 'none',
      },
    };

    const response = await axios.post<ZoomMeetingResponse>(
      'https://api.zoom.us/v2/users/me/meetings',
      meetingPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    ).catch(err => {
      console.error('Zoom API Error:', err.response?.status, err.response?.data);
      throw err;
    });

    return response.data;
  }

  async getMeeting(meetingId: string): Promise<ZoomMeetingResponse> {
    const token = await this.getAccessToken();
    const response = await axios.get<ZoomMeetingResponse>(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    const token = await this.getAccessToken();
    await axios.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /**
   * Build the iframe embed URL from a join URL.
   * join_url format: https://zoom.us/j/MEETING_ID?pwd=XXXX
   * embed_url format: https://zoom.us/wc/MEETING_ID/embed?pwd=XXXX
   */
  buildEmbedUrl(joinUrl: string): string {
    return joinUrl
      .replace('/j/', '/wc/')
      .replace('?pwd=', '/embed?pwd=')
      .replace('&pwd=', '/embed?pwd=');
  }
}

// Named export of the class for creating instances with per-account credentials
export { ZoomService };
export const zoomService = new ZoomService();
