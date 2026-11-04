import { router, type Href } from 'expo-router';

/** Go to a tab from a screen pushed on top of the tabs (profile, booking, settings…).
 *  Pops back to the tab bar first, so we never stack a second copy of the tabs. */
export function goToTab(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(href);
}
