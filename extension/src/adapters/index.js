(function (root) {
  'use strict';

  const ns = root.AILatestExt = root.AILatestExt || {};

  function getAdapter(host) {
    return (ns.adapters || []).find((adapter) => {
      try {
        return adapter && adapter.match && adapter.match(host);
      } catch (e) {
        return false;
      }
    }) || null;
  }

  ns.getAdapter = getAdapter;
})(globalThis);
