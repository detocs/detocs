import { h, VNode, FunctionalComponent as FC } from 'preact';
import { useRef } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import { MediaFile, VideoFile, ImageFile } from '@models/media';
import { fromMillis } from '@util/timestamp';

interface ThumbnailProps extends Omit<JSXInternal.HTMLAttributes, 'media'> {
  media?: MediaFile | null;
}

interface VideoThumbnailProps extends ThumbnailProps {
  media: VideoFile;
}

interface ImageThumbnailProps extends ThumbnailProps {
  media?: ImageFile | null;
}

export const Thumbnail: FC<ThumbnailProps> = (props): VNode => {
  switch (props.media?.type) {
    case 'video':
      return <VideoThumbnail {...props as VideoThumbnailProps} />;
    case 'image':
      return <ImageThumbnail {...props as ImageThumbnailProps} />;
    default:
      return <ImageThumbnail media={null} />;
  }
};

const VideoThumbnail: FC<VideoThumbnailProps> = ({ media, ...additionalProps }): VNode => {
  const videoRef = useRef<HTMLVideoElement>();
  const playVideo = (): void => { videoRef.current?.play(); };
  const pauseVideo = (): void => { videoRef.current?.pause(); };
  // TODO: Show current playback progress?
  return (
    <div className="thumbnail" {...additionalProps}>
      <video
        ref={videoRef}
        src={media.url}
        class="thumbnail__media"
        muted={true}
        controls={false}
        {...{'disablePictureInPicture': true}}
        autoPlay={false}
        loop={true}
        onMouseEnter={playVideo}
        onFocus={playVideo}
        onMouseLeave={pauseVideo}
        onBlur={pauseVideo}
      >
      </video>
      <div className="thumbnail__metadata">
        {fromMillis(media.durationMs).slice(0, -4)}
      </div>
    </div>
  );
};

const ImageThumbnail: FC<ImageThumbnailProps> = ({ media, ...additionalProps }): VNode => {
  const data = media?.url || '';
  return (
    <div className="thumbnail" {...additionalProps}>
      <object
        key={data} // Chrome doesn't update object elements when you change the data attribute
        data={data}
        class="thumbnail__media"
      >
        <div class="thumbnail__placeholder" />
      </object>
    </div>
  );
};
