export const fakeOpfsPathRuntime = {
  source() {
    return createFakeOpfsPathRuntime.toString();
  },
};

function createFakeOpfsPathRuntime(filePrefix: string) {
  function normalizePath(path: string) {
    return path
      .split('/')
      .filter(Boolean)
      .join('/');
  }

  function fileKey(path: string) {
    return `${filePrefix}${normalizePath(path)}`;
  }

  function hasDirectory(path: string) {
    const prefix = `${filePrefix}${normalizePath(path)}/`;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      if (window.localStorage.key(index)?.startsWith(prefix)) return true;
    }
    return false;
  }

  return {
    fileKey,
    hasDirectory,
    normalizePath,
  };
}
