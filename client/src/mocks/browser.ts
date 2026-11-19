import { setupWorker } from 'msw/browser';
import { handlers, mockState } from './handlers';

export const worker = setupWorker(...handlers);

Object.assign(window, { __devfeedMock: mockState });
