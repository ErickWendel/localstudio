export function getStandaloneAppRedirectUrl({
  hash,
  pathname,
  search,
}: {
  hash: string;
  pathname: string;
  search: string;
}) {
  if (pathname !== '/editor' && pathname !== '/joystick') return undefined;
  return `${pathname}/${search}${hash}`;
}
