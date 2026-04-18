/**
 * nueCode Console Bridge
 *
 * Add this script to your dev server's HTML to capture console and network output
 * in the nueCode browser panel.
 *
 * Usage: <script src="http://localhost:YOUR_T3_PORT/console-bridge.js"></script>
 */
(function () {
  "use strict";

  if (window.__t3ConsoleBridgeInstalled) return;
  window.__t3ConsoleBridgeInstalled = true;

  var SOURCE = "nuecode-console-bridge";
  var LEVELS = ["log", "info", "warn", "error", "debug"];
  var MAX_ARG_LENGTH = 2048;
  var networkRequestCounter = 0;

  function nextNetworkRequestId() {
    networkRequestCounter += 1;
    return "req-" + networkRequestCounter;
  }

  function now() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }

  function serialize(value) {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (value instanceof Error) {
      return value.stack || value.message || String(value);
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2).slice(0, MAX_ARG_LENGTH);
      } catch {
        return String(value);
      }
    }
    return String(value).slice(0, MAX_ARG_LENGTH);
  }

  function resolveRequestMethod(input, init) {
    if (init && typeof init.method === "string" && init.method.trim().length > 0) {
      return init.method.toUpperCase();
    }
    if (
      input &&
      typeof input === "object" &&
      typeof input.method === "string" &&
      input.method.length > 0
    ) {
      return input.method.toUpperCase();
    }
    return "GET";
  }

  function resolveRequestUrl(input) {
    try {
      if (typeof input === "string") {
        return new URL(input, location.href).href;
      }
      if (input && typeof input === "object" && typeof input.url === "string") {
        return new URL(input.url, location.href).href;
      }
    } catch {}
    return typeof input === "string" ? input : location.href;
  }

  function send(type, level, args) {
    try {
      window.parent.postMessage(
        {
          source: SOURCE,
          type: type,
          level: level,
          args: Array.prototype.map.call(args, serialize),
          timestamp: Date.now(),
          url: location.href,
        },
        "*",
      );
    } catch {
      // Silently fail if postMessage is blocked
    }
  }

  function sendNetwork(payload) {
    try {
      window.parent.postMessage(
        {
          source: SOURCE,
          type: "network",
          timestamp: Date.now(),
          ...payload,
        },
        "*",
      );
    } catch {}
  }

  // Wrap console methods
  LEVELS.forEach(function (level) {
    var original = console[level];
    if (!original) return;

    console[level] = function () {
      send("console", level, arguments);
      return original.apply(console, arguments);
    };
  });

  // Capture unhandled errors
  window.addEventListener("error", function (event) {
    send("error", "error", [
      event.message || "Unhandled error",
      event.filename ? event.filename + ":" + event.lineno + ":" + event.colno : "",
    ]);
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", function (event) {
    send("error", "error", ["Unhandled promise rejection: " + serialize(event.reason)]);
  });

  if (typeof window.fetch === "function") {
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      var requestId = nextNetworkRequestId();
      var startedAt = now();
      var method = resolveRequestMethod(input, init);
      var url = resolveRequestUrl(input);
      return originalFetch
        .apply(this, arguments)
        .then(function (response) {
          sendNetwork({
            requestId: requestId,
            kind: "fetch",
            method: method,
            url: url,
            ok: response.ok,
            statusCode: response.status,
            statusText: response.statusText || undefined,
            durationMs: now() - startedAt,
          });
          return response;
        })
        .catch(function (error) {
          sendNetwork({
            requestId: requestId,
            kind: "fetch",
            method: method,
            url: url,
            ok: false,
            statusCode: 0,
            errorMessage: serialize(error),
            durationMs: now() - startedAt,
          });
          throw error;
        });
    };
  }

  if (typeof XMLHttpRequest !== "undefined") {
    var originalOpen = XMLHttpRequest.prototype.open;
    var originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__nuecodeNetworkBridge = {
        requestId: nextNetworkRequestId(),
        method: typeof method === "string" && method.length > 0 ? method.toUpperCase() : "GET",
        url: resolveRequestUrl(url),
      };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var requestInfo = this.__nuecodeNetworkBridge || {
        requestId: nextNetworkRequestId(),
        method: "GET",
        url: location.href,
      };
      var startedAt = now();
      var failureReason;

      this.addEventListener(
        "error",
        function () {
          failureReason = "Network error";
        },
        { once: true },
      );
      this.addEventListener(
        "abort",
        function () {
          failureReason = "Request aborted";
        },
        { once: true },
      );
      this.addEventListener(
        "timeout",
        function () {
          failureReason = "Request timed out";
        },
        { once: true },
      );
      this.addEventListener(
        "loadend",
        function () {
          var statusCode = typeof this.status === "number" ? this.status : 0;
          var ok = !failureReason && statusCode >= 200 && statusCode < 400;
          sendNetwork({
            requestId: requestInfo.requestId,
            kind: "xhr",
            method: requestInfo.method,
            url: requestInfo.url,
            ok: ok,
            statusCode: statusCode,
            statusText: this.statusText || undefined,
            errorMessage: !ok
              ? failureReason || (statusCode === 0 ? "Request failed" : undefined)
              : undefined,
            durationMs: now() - startedAt,
          });
        },
        { once: true },
      );

      return originalSend.apply(this, arguments);
    };
  }

  // Notify parent of navigation events
  var lastUrl = location.href;
  function checkNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      try {
        window.parent.postMessage({ source: SOURCE, type: "navigation", url: lastUrl }, "*");
      } catch {}
    }
  }

  // Use both pushState/replaceState wrapping and popstate for SPA navigation detection
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;

  history.pushState = function () {
    originalPushState.apply(this, arguments);
    checkNavigation();
  };

  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    checkNavigation();
  };

  window.addEventListener("popstate", checkNavigation);
})();
