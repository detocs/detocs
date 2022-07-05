import memoize from 'micro-memoize';
import { h, VNode, FunctionalComponent as FC } from 'preact';
import { useRef, useEffect, useState, useContext } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';

import { MediaFile, VideoFile, ImageFile } from '@models/media';
import { fromMillis } from '@util/timestamp';
import { ThumbnailSettingsContext } from './hooks/settings';

interface ThumbnailProps extends Omit<JSXInternal.HTMLAttributes, 'media'> {
  media?: MediaFile | null;
  thumbnail?: ImageFile;
}

interface VideoThumbnailProps extends ThumbnailProps {
  media: VideoFile;
  thumbnail: ImageFile;
}

interface ImageThumbnailProps extends ThumbnailProps {
  media: ImageFile;
}

interface MediaIntersectionObserverEntry extends IntersectionObserverEntry {
  target: HTMLVideoElement;
}

interface ImageIntersectionObserverEntry extends IntersectionObserverEntry {
  target: HTMLImageElement;
}

export const Thumbnail: FC<ThumbnailProps> = (props): VNode => {
  switch (props.media?.type) {
    case 'video':
      return <VideoThumbnail {...props as VideoThumbnailProps} />;
    case 'image':
      return <ImageThumbnail {...props as ImageThumbnailProps} />;
    default:
      return <EmptyThumbnail {...props} />;
  }
};

function isVideoLoaded(elem: HTMLVideoElement): boolean {
  return !!elem.src &&
    elem.networkState === HTMLMediaElement.NETWORK_IDLE ||
    elem.networkState === HTMLMediaElement.NETWORK_LOADING;
}

function isImageLoaded(elem: HTMLImageElement): boolean {
  return !!elem.src;
}

function videoVisibilityHandler(entries: MediaIntersectionObserverEntry[]): void {
  entries
    .filter(entry => !entry.isIntersecting && isVideoLoaded(entry.target))
    .map(entry => entry.target)
    .forEach(video => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
  entries
    .filter(entry => entry.isIntersecting && !isVideoLoaded(entry.target))
    .map(entry => entry.target)
    .forEach(video => {
      video.src = video.dataset.src || '';
      video.load();
    });
}

function updateVideo(video: HTMLVideoElement): void {
  if (!video.src || video.src === video.dataset.src) {
    return;
  }
  if (video.networkState === HTMLMediaElement.NETWORK_IDLE ||
    video.networkState === HTMLMediaElement.NETWORK_LOADING)
  {
    video.pause();
  }
  video.src = video.dataset.src || '';
  video.load();
}

const getVideoObserver = memoize(() => new IntersectionObserver(
  videoVisibilityHandler  as unknown as IntersectionObserverCallback,
  { rootMargin: '10%' },
));

function imageVisibilityHandler(entries: ImageIntersectionObserverEntry[]): void {
  entries
    .filter(entry => !entry.isIntersecting && isImageLoaded(entry.target))
    .map(entry => entry.target)
    .forEach(image => {
      image.removeAttribute('src');
    });
  entries
    .filter(entry => entry.isIntersecting && !isImageLoaded(entry.target))
    .map(entry => entry.target)
    .forEach(image => {
      image.src = image.dataset.src || '';
    });
}

function updateImage(image: HTMLImageElement): void {
  if (!image.src || image.src === image.dataset.src) {
    return;
  }
  image.src = image.dataset.src || '';
}

const getImageObserver = memoize(() => new IntersectionObserver(
  imageVisibilityHandler  as unknown as IntersectionObserverCallback,
  { rootMargin: '10%' },
));

const VideoThumbnail: FC<VideoThumbnailProps> = ({
  media,
  thumbnail,
  ...additionalProps
}): VNode => {
  const [ playVideo, setPlayVideo ] = useState(false);
  const videoEnabled = useContext(ThumbnailSettingsContext);
  const play = (): void => setPlayVideo(true);
  const pause = (): void => setPlayVideo(false);
  return (
    <div className="thumbnail"
      {...additionalProps}
      onMouseEnter={play}
      onFocus={play}
      onMouseLeave={pause}
      onBlur={pause}
    >
      {videoEnabled && playVideo
        ? <ThumbVid media={media} />
        : (thumbnail ? <ThumbImg media={thumbnail} /> : <div class="thumbnail__placeholder" />)
      }
      <div className="thumbnail__metadata">
        {fromMillis(media.durationMs).slice(0, -4)}
      </div>
    </div>
  );
};

const ThumbVid: FC<{ media: VideoFile }> = ({ media }): VNode => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!videoRef.current) {
      console.warn('Unable to observe <video> element for thumbnail');
      return;
    }
    getVideoObserver().observe(videoRef.current);
    return () => {
      videoRef.current && getVideoObserver().unobserve(videoRef.current);
    };
  }, []);
  useEffect(() => {
    videoRef.current && updateVideo(videoRef.current);
  }, [ media.url ]);
  // TODO: Show current playback progress?
  return (
    <video
      ref={videoRef}
      data-src={media.url}
      class="thumbnail__media"
      muted={true}
      controls={false}
      {...{'disablePictureInPicture': true}}
      autoPlay={true}
      loop={true}
    >
    </video>
  );
};

const ImageThumbnail: FC<ImageThumbnailProps> = ({ media, ...additionalProps }): VNode => {
  const imageRef = useRef<HTMLImageElement>();
  useEffect(() => {
    if (!imageRef.current) {
      console.warn('Unable to observe <object> element for thumbnail');
      return;
    }
    getImageObserver().observe(imageRef.current);
    return () => {
      imageRef.current && getImageObserver().unobserve(imageRef.current);
    };
  }, []);
  useEffect(() => {
    imageRef.current && updateImage(imageRef.current);
  }, [ media.url ]);
  return (
    <div className="thumbnail" {...additionalProps}>
      <ThumbImg media={media} />
    </div>
  );
};

const ThumbImg: FC<{ media: ImageFile }> = ({ media }): VNode => {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!imageRef.current) {
      console.warn('Unable to observe <object> element for thumbnail');
      return;
    }
    getImageObserver().observe(imageRef.current);
    return () => {
      imageRef.current && getImageObserver().unobserve(imageRef.current);
    };
  }, []);
  useEffect(() => {
    imageRef.current && updateImage(imageRef.current);
  }, [ media.url ]);
  return (
    <img
      ref={imageRef}
      data-src={media.url}
      class="thumbnail__media"
    />
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const EmptyThumbnail: FC<ThumbnailProps> = ({ media, ...additionalProps }): VNode => {
  return (
    <div className="thumbnail" {...additionalProps}>
      <div class="thumbnail__placeholder" />
    </div>
  );
};
