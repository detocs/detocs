declare module 'node-youtube-resumable-upload' {
  import { youtube_v3 as youtubeV3 } from '@google/youtube/v3';

  export default class ResumableUpload {
    public tokens: {
      access_token: string;
    };
    public filepath: string;
    public metadata: youtubeV3.Schema$Video;
    public monitor: boolean;
    public retry: number;
    public notifySubscribers: boolean;
    public upload(): void;
    public on(event: 'progress', callback: (progress: string) => void): void;
    public on(event: 'error', callback: (error: Error) => void): void;
    public on(event: 'fail', callback: (error: Error) => void): void;
    public on(event: 'success', callback: (response: string) => void): void;
  }
}


