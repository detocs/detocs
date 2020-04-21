import { h, VNode, FunctionalComponent } from 'preact';

import { MediaFile } from '../../models/media';

interface ThumbnailProps {
  media?: MediaFile | null;
}

export const Thumbnail: FunctionalComponent<ThumbnailProps> = ({ media }): VNode => {
  const data = media?.url || '';
  // TODO: Only play video when focused/hovered
  return (
    media?.type === 'video' ?
      <video
        src={data}
        class="thumbnail"
        muted={true}
        controls={false}
        autoPlay={true}
        loop={true}
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
