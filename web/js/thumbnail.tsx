import { h, VNode, FunctionalComponent } from 'preact';
import { useRef } from 'preact/hooks';

import { MediaFile } from '@models/media';

interface ThumbnailProps {
  media?: MediaFile | null;
}

export const Thumbnail: FunctionalComponent<ThumbnailProps> = ({ media }): VNode => {
  const data = media?.url || '';
  // TODO: Only play video when focused/hovered
  const videoRef = useRef<HTMLVideoElement>();
  const playVideo = (): void => { videoRef.current?.play(); };
  const pauseVideo = (): void => { videoRef.current?.pause(); };
  return (
    media?.type === 'video' ?
      <video
        ref={videoRef}
        src={data}
        class="thumbnail"
        muted={true}
        controls={false}
        autoPlay={false}
        loop={true}
        onMouseEnter={playVideo}
        onFocus={playVideo}
        onMouseLeave={pauseVideo}
        onBlur={pauseVideo}
      >
      </video> :
      <object
        key={data} // Chrome doesn't update object elements when you change the data attribute
        data={data}
        class="thumbnail"
      >
        <div class="thumbnail-placeholder" />
      </object>
  );
};
