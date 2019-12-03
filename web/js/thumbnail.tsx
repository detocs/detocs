import { h, VNode, FunctionalComponent } from 'preact';

export const Thumbnail: FunctionalComponent<{ src: string | null }> =
({ src }): VNode => {
  const data = src || '';
  return (
    <object
      key={data} // Chrome doesn't update object elements when you change the data attribute
      data={data}
      class="thumbnail">
      <div class="thumbnail-placeholder" />
    </object>
  );
};
