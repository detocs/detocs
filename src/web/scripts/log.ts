import { ToastConsumer } from 'react-toast-notifications';
import { toast } from 'react-toastify';

export function logError(error: { message: string } | string): void {
  console.error(error);
  toast(typeof error === 'string' ? error : error.message, { type: 'error' });
}
