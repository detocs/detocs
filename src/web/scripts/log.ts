import { toast } from 'react-toastify';

import { objectFormData } from '@util/forms';
import { filterNullValues } from '@util/object';

import { errorEndpoint } from './api';

interface ErrorObj {
  message: string;
  stack?: string;
  lineNumber?: number;
  columnNumber?: number;
  fileName?: string;
}

interface ChromeError {
  message: string;
  stack: string;
}

interface FirefoxError {
  message: string;
  stack: string;
  lineNumber: number;
  columnNumber: number;
  fileName: string;
}

interface EdgeError {
  message: string;
  stack: string;
  lineNumber: number;
  columnNumber: number;
  fileUrl: string;
}

interface SafariError {
  message: string;
  stack: string;
  line: number;
  column: number;
}

type BrowserError = (ChromeError | FirefoxError | EdgeError | SafariError) &
Partial<ChromeError & FirefoxError & EdgeError & SafariError>;

const errorReportingEndpoint = errorEndpoint('/report').href;

export function logError(errorOrEvent: ErrorEvent | Error | string, print = true): void {
  if (print) {
    console.error(errorOrEvent instanceof ErrorEvent ? errorOrEvent.error : errorOrEvent);
  }
  let errorObj;
  if (typeof errorOrEvent === 'string') {
    errorObj = { message: errorOrEvent };
  } else if (errorOrEvent instanceof ErrorEvent) {
    errorObj = Object.assign(
      objFromError(errorOrEvent.error),
      {
        lineNumber: errorOrEvent.lineno,
        columnNumber: errorOrEvent.colno,
        fileName: errorOrEvent.filename,
      },
    );
  } else {
    errorObj = objFromError(errorOrEvent as BrowserError);
  }
  toast(errorObj.message, { type: 'error' });
  uploadError(errorObj);
}

// TODO: Consider using a lib like Edogawa for this?
// https://github.com/undrafted/edogawa
async function uploadError(err: ErrorObj): Promise<void> {
  window.navigator.sendBeacon(errorReportingEndpoint, objectFormData(err));
}

function objFromError(err: BrowserError): ErrorObj {
  return filterNullValues({
    message: err.message,
    stack: err.stack,
    lineNumber: err.lineNumber ?? err.line,
    columnNumber: err.columnNumber ?? err.column,
    fileName: err.fileName ?? err.fileUrl,
  });
}
