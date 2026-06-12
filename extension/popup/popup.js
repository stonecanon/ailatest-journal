(async function () {
  'use strict';

  const settings = await AILatestExt.lookup.getSettings();
  const inputs = Array.from(document.querySelectorAll('[data-setting]'));

  inputs.forEach((input) => {
    const key = input.dataset.setting;
    input.checked = Boolean(settings[key]);
    input.addEventListener('change', async () => {
      await AILatestExt.lookup.setSettings({ [key]: input.checked });
    });
  });
})();
