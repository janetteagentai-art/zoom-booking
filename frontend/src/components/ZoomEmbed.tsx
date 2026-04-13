import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { bookingsService } from '../services/bookingsService';

interface ZoomEmbedProps {
  bookingId: string;
  role?: 0 | 1; // 0 = attendee, 1 = host
}

declare global {
  interface Window {
    ZoomMtg?: any;
    ZoomMtgEmbedded?: any;
  }
}

export default function ZoomEmbed({ bookingId, role = 0 }: ZoomEmbedProps) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    const initZoom = async () => {
      try {
        // 1. Fetch embed data from backend
        const { data: embedData } = await bookingsService.getEmbedData(bookingId, role);

        // 2. Load Zoom Meeting SDK script
        const script = document.createElement('script');
        script.src = 'https://zoom.us/sdk-meetings/embedded/2.18.0/lib/lib-reduce.co.js';
        script.async = true;
        document.body.appendChild(script);

        script.onload = () => {
          if (!window.ZoomMtgEmbedded || !containerRef.current) return;

          clientRef.current = window.ZoomMtgEmbedded.createClient();

          clientRef.current.init({
            leaveUrl: window.location.origin,
            success: () => {
              clientRef.current.join({
                signature: embedData.signature,
                sdkKey: embedData.sdkKey,
                meetingNumber: embedData.meetingNumber,
                password: embedData.password,
                userName: embedData.userName,
                userEmail: embedData.userEmail,
                success: (res: any) => {
                  console.log('Zoom joined:', res);
                },
                error: (err: any) => {
                  console.error('Zoom join error:', err);
                },
              });
            },
          });
        };
      } catch (err) {
        console.error('Zoom embed error:', err);
      }
    };

    initZoom();

    return () => {
      if (clientRef.current) {
        try { clientRef.current.leaveMeeting(); } catch {}
      }
    };
  }, [bookingId, role]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={containerRef} id="meetingSDKEmbedded" style={{ flex: 1, minHeight: '500px' }} />
    </div>
  );
}
