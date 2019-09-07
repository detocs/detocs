import { h, VNode, FunctionalComponent } from 'preact';

export const Thumbnail: FunctionalComponent<{ src: string | null }> =
({ src }): VNode => (
  <object
    data={src || ''}
    class="thumbnail">
    <div class="thumbnail-placeholder" />
  </object>
);
