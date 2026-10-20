/*!
 * wiki-cloud.js — 云服务客户端
 * 由 WikiCollab 协作层统一调用，负责加载 SDK、初始化客户端、读取登录态。
 * 下面三个值来自云服务 publicConfig，与当前应用一一对应，请勿手工改写。
 */
(function () {
  if (window.WikiCloud) return;

  var cfg = {
    endpoint: "https://xuanwu-wiki.app.workbuddy.host",
    oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
    publishableKey: "wbpk_GPwYWh70uv0hjrs5SqwXQN_RmiCq58RFw4SmqSUcc7Ss1pn7QBQzWLu"
  };

  var SDK_SRC =
    "https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js";

  var sdkPromise = null;
  var clientPromise = null;

  function loadSdk() {
    if (window.WorkBuddyCloud && window.WorkBuddyCloud.createWorkBuddyCloud) {
      return Promise.resolve(true);
    }
    if (!sdkPromise) {
      sdkPromise = new Promise(function (resolve) {
        var s = document.createElement("script");
        s.src = SDK_SRC;
        s.async = true;
        s.onload = function () {
          resolve(true);
        };
        s.onerror = function () {
          resolve(false);
        };
        document.head.appendChild(s);
      });
    }
    return sdkPromise;
  }

  function ready() {
    if (!clientPromise) {
      clientPromise = loadSdk().then(function (ok) {
        if (!ok || !window.WorkBuddyCloud || !window.WorkBuddyCloud.createWorkBuddyCloud) {
          return null;
        }
        try {
          return window.WorkBuddyCloud.createWorkBuddyCloud({
            endpoint: cfg.endpoint,
            oauthRelayBaseUrl: cfg.oauthRelayBaseUrl,
            publishableKey: cfg.publishableKey
          });
        } catch (e) {
          return null;
        }
      });
    }
    return clientPromise;
  }

  function session() {
    return ready().then(function (client) {
      if (!client) return null;
      return client.auth.getSession().then(
        function (res) {
          if (!res || res.error) return null;
          return res.data || null;
        },
        function () {
          return null;
        }
      );
    });
  }

  function unwrap(res) {
    if (res && res.error) throw res.error;
    return res ? res.data : null;
  }

  window.WikiCloud = {
    config: cfg,
    ready: ready,
    session: session,
    unwrap: unwrap
  };
})();
