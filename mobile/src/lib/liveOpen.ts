// Native transport; time-specific checks and cache are shared and tested without Expo.
import { sb } from './auth';
import { createLiveChecker } from '../../../src/app/liveOpen';
export { checkedFor, closedWhy, needsCheck, type Live } from '../../../src/app/liveOpen';
const checker = createLiveChecker((body) => sb().functions.invoke('e-deschis', { body }));
export const checkOpen = checker.checkOpen;
export const isClosed = checker.isClosed;
