import { h, VNode, RenderableProps, Ref } from 'preact';
import { JSXInternal } from 'preact/src/jsx';

type CallbackFormProps<T> = Omit<JSXInternal.HTMLAttributes, 'onSubmit'> & RenderableProps<{
  onSubmit: (formData: T) => void;
  formRef: Ref<HTMLFormElement>;
}>;

export function CallbackForm<T>({
  children,
  onSubmit,
  formRef,
  class: className,
  ...attributes
}: CallbackFormProps<T>): VNode {
  const submitHandler = (event: Event): void => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());
    onSubmit(data as unknown as T);
  };
  return (<form
    {...attributes}
    class={`${className ?? ''} js-manual-form`}
    onSubmit={submitHandler}
    ref={formRef}
  >
    {children}
  </form>);
}
